import type { Castle } from "./castle";
import {
    BOW_INTERVAL,
    type Controls,
    type Game,
    NO_CONTROLS,
    PLAYER_HEALTH,
    SWORD_INTERVAL,
} from "./game";
import { MOUSE_LEFT } from "./input";
import { Lang } from "./lang";
import type { Main } from "./main";
import * as Res from "./res";
import * as Ui from "./ui";
import { GOLD, SILVER, css, rgba } from "./ui";

/**
 * The playing screen: the controls driving the game, the HUD drawn over
 * the keep (health, monsters left, the section, the weapons with their
 * reload, the crosshair, red edges when hurt) and the end of the game. On
 * a touchscreen: a joystick under the left thumb, dragging on the right
 * half to look around, an attack button, the weapon panels to tap and a
 * pause button.
 */

const W = Ui.WIDTH;
const H = Ui.HEIGHT;

// touchscreens, in the 960x540 coordinates of the HUD
/** Like mouse pixels: a drag across half the screen turns some 70°. */
const TOUCH_LOOK = 2.4;
/** How far the joystick's knob goes from where the thumb landed. */
const STICK_RADIUS = 70;
const STICK_DEAD_ZONE = 0.15;
/** Where the joystick waits for the thumb. */
const STICK_HOME = { x: 170, y: 340 };
const ATTACK_BUTTON = { x: W - 110, y: 330, r: 56 };
const PAUSE_BUTTON = { x: W / 2 - 26, y: 8, w: 52, h: 36 };

/** The left edge of weapon k's panel, on the bottom right. */
function panelLeft(k: number): number {
    return W - 280 + k * 136;
}
const PANEL_TOP = H - 102;

const BAR_BACK = rgba(0.06, 0.08, 0.14);
const BIG = { size: 20, outline: 5 };
const SMALL = { size: 13, outline: 3, outlineColor: "#000" };

export class Play {
    /** The mouse moves since the last update, while it is captured. */
    private lookX = 0;
    private lookY = 0;
    /** The joystick's tilt, up to 1 each way: x to the right, y down. */
    private stick = { x: 0, y: 0 };
    private touchAttack = false;
    private tappedWeapon: number | null = null;
    /** performance.now() when the game ended, for the tap that leaves it. */
    private overAt = 0;

    constructor(
        private readonly main: Main,
        private readonly game: Game,
    ) {
        game.resume();
        if (!main.input.touchMode) this.capture();
    }

    private capture(): void {
        this.main.lockMouse((dx, dy) => {
            this.lookX += dx;
            this.lookY += dy;
        });
    }

    update(dt: number, castle: Castle): void {
        const game = this.game;
        const input = this.main.input;
        if (game.result !== null) {
            if (this.overAt === 0) {
                this.overAt = performance.now();
                this.main.freeMouse();
            }
            game.update(dt, NO_CONTROLS, castle);
            const tapped =
                input.touchMode &&
                input.clicks.some((c) => c.startedAt > this.overAt);
            if (input.isPressed("Enter") || input.isPressed("Escape") || tapped)
                this.main.endGame();
            return;
        }
        if (input.isPressed("Escape")) {
            this.main.pause();
            return;
        }
        if (this.touchControls()) return;
        // a click into the view takes the mouse again (the game's trigger
        // stays blocked until it is let go)
        if (
            !input.touchMode &&
            !this.main.mouseLocked &&
            input.isPressed(MOUSE_LEFT)
        ) {
            this.capture();
            game.resume();
        }

        const axis = (plus: string[], minus: string[]) =>
            (plus.some((k) => input.isDown(k)) ? 1 : 0) -
            (minus.some((k) => input.isDown(k)) ? 1 : 0);
        let forward = axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
        let side = axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]);
        if (forward === 0 && side === 0) {
            const tilt = Math.hypot(this.stick.x, this.stick.y);
            if (tilt > STICK_DEAD_ZONE) {
                forward = -this.stick.y;
                side = this.stick.x;
            }
        }
        let select: number | null = null;
        if (input.isPressed("Digit1") || input.isPressed("Numpad1")) select = 0;
        else if (input.isPressed("Digit2") || input.isPressed("Numpad2"))
            select = 1;
        select = this.tappedWeapon ?? select;
        this.tappedWeapon = null;
        const controls: Controls = {
            forward,
            side,
            lookX: this.lookX,
            lookY: this.lookY,
            fire:
                input.isDown("Space") ||
                input.isDown(MOUSE_LEFT) ||
                this.touchAttack,
            select,
        };
        this.lookX = 0;
        this.lookY = 0;
        game.update(dt, controls, castle);
    }

    /**
     * Gives each finger that touched down its job: the pause button, a
     * weapon panel, the attack button, the joystick (the first finger on
     * the left half, where it lands) or looking around (any other).
     * Returns true when the game was paused.
     */
    private touchControls(): boolean {
        const input = this.main.input;
        for (const t of input.began) {
            const p = PAUSE_BUTTON;
            if (
                t.x >= p.x &&
                t.x < p.x + p.w &&
                t.y >= p.y &&
                t.y < p.y + p.h
            ) {
                this.main.pause();
                return true;
            }
            const panel = [0, 1].find(
                (k) =>
                    t.x >= panelLeft(k) &&
                    t.x < panelLeft(k) + 124 &&
                    t.y >= PANEL_TOP &&
                    t.y < PANEL_TOP + 76,
            );
            if (panel !== undefined) {
                t.role = "weapon";
                this.tappedWeapon = panel;
                continue;
            }
            const a = ATTACK_BUTTON;
            if (Math.hypot(t.x - a.x, t.y - a.y) <= a.r * 1.25) {
                t.role = "attack";
                continue;
            }
            const steering = [...input.touches.values()].some(
                (o) => o.role === "move",
            );
            t.role = t.x < W / 2 && !steering ? "move" : "look";
        }
        this.stick = { x: 0, y: 0 };
        this.touchAttack = false;
        for (const t of input.touches.values()) {
            if (t.role === "attack") this.touchAttack = true;
            else if (t.role === "look") {
                this.lookX += (t.x - t.prevX) * TOUCH_LOOK;
                this.lookY += (t.y - t.prevY) * TOUCH_LOOK;
            } else if (t.role === "move") {
                const x = (t.x - t.startX) / STICK_RADIUS;
                const y = (t.y - t.startY) / STICK_RADIUS;
                const k = Math.max(1, Math.hypot(x, y));
                this.stick = { x: x / k, y: y / k };
            }
        }
        return false;
    }

    // --- HUD ------------------------------------------------------------

    draw(ctx: CanvasRenderingContext2D, castle: Castle): void {
        const game = this.game;
        const touch = this.main.input.touchMode;
        const over = game.result !== null;

        // struck: the edges of the view flash red (and pulse when health runs low)
        const share = game.health / PLAYER_HEALTH;
        const low =
            share < 0.25 && !over ? 0.12 + 0.08 * Math.sin(game.time * 6) : 0;
        const hurt = Math.max(game.hurtTime, low);
        if (hurt > 0) {
            ctx.fillStyle = rgba(0.8, 0.05, 0.05, hurt * 0.8);
            ctx.fillRect(0, 0, W, 24);
            ctx.fillRect(0, H - 24, W, 24);
            ctx.fillRect(0, 24, 24, H - 48);
            ctx.fillRect(W - 24, 24, 24, H - 48);
            ctx.fillStyle = rgba(0.8, 0.05, 0.05, hurt * 0.25);
            ctx.fillRect(0, 0, W, H);
        }

        // health
        Ui.frame(ctx, 16, H - 92, 300, 66, SILVER);
        ctx.fillStyle = BAR_BACK;
        ctx.fillRect(28, H - 48, 276, 12);
        ctx.fillStyle =
            share > 0.5
                ? rgba(0.4, 0.9, 0.5)
                : share > 0.25
                  ? rgba(1, 0.7, 0.2)
                  : rgba(1, 0.25, 0.25);
        ctx.fillRect(28, H - 48, 276 * share, 12);

        // weapons with their reload bars
        for (let i = 0; i < 2; i++) {
            const x = panelLeft(i);
            const current = i === game.weapon;
            Ui.frame(
                ctx,
                x,
                PANEL_TOP,
                124,
                76,
                current ? GOLD : SILVER,
                current ? 1 : 0.6,
            );
            const ready =
                1 - game.reload[i]! / (i === 0 ? SWORD_INTERVAL : BOW_INTERVAL);
            ctx.fillStyle = BAR_BACK;
            ctx.fillRect(x + 66, H - 34, 50, 5);
            ctx.fillStyle =
                ready >= 1 ? rgba(0.4, 0.9, 0.5) : rgba(1, 0.7, 0.2);
            ctx.fillRect(x + 66, H - 34, 50 * ready, 5);
        }
        Ui.frame(ctx, 12, 8, 250, 36, GOLD, 0.85);
        Ui.frame(ctx, W - 262, 8, 250, 36, SILVER, 0.85);

        // a hit: four ticks around the aiming mark
        if (game.hitTime > 0) {
            ctx.strokeStyle = rgba(1, 1, 1, game.hitTime / 0.15);
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const sx of [-1, 1])
                for (const sy of [-1, 1]) {
                    ctx.moveTo(W / 2 + sx * 10, H / 2 + sy * 10);
                    ctx.lineTo(W / 2 + sx * 18, H / 2 + sy * 18);
                }
            ctx.stroke();
        }
        // a hit in the head: HEADSHOT under the aiming mark, fading out
        if (game.headshotTime > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(game.headshotTime / 0.3, 1);
            Ui.text(ctx, Lang.t("HEADSHOT"), W / 2, H / 2 + 34, {
                size: 26,
                outline: 6,
                align: "center",
                color: rgba(1, 0.85, 0.4),
            });
            ctx.restore();
        }

        if (!over)
            Ui.tile(
                ctx,
                Res.image("crosshair"),
                game.weapon * 128,
                0,
                128,
                128,
                W / 2 - 64,
                H / 2 - 64,
                game.reload[game.weapon]! > 0 ? 0.5 : 1,
            );

        const left = game.monsters.filter((m) => !m.dead()).length;
        Ui.text(
            ctx,
            Lang.t("HEALTH {0}", [Math.ceil(game.health)]),
            30,
            H - 84,
            {
                ...BIG,
                color: rgba(0.85, 0.93, 1),
            },
        );
        Ui.text(
            ctx,
            Lang.t("MONSTERS {0}/{1}", [left, game.monsters.length]),
            26,
            14,
            {
                ...BIG,
                color: rgba(1, 0.85, 0.5),
            },
        );
        Ui.text(
            ctx,
            Lang.t(castle.sectionName(game.playerX, game.playerY)),
            W - 26,
            14,
            {
                ...BIG,
                color: rgba(0.85, 0.93, 1),
                align: "right",
            },
        );
        Ui.text(
            ctx,
            Lang.t(
                touch
                    ? "Left thumb: move   Right thumb: aim   ATTACK: strike, shoot   Tap a weapon to choose it   II: menu"
                    : "WASD / arrows: move   Mouse: aim   Space / left click: strike, shoot   1: sword   2: bow   Esc: menu",
            ),
            W / 2,
            H - 19,
            { ...SMALL, color: rgba(0.75, 0.8, 0.9), align: "center" },
        );
        const icons = Res.image("icons");
        for (let i = 0; i < 2; i++) {
            const x = panelLeft(i);
            const current = i === game.weapon;
            Ui.tile(
                ctx,
                icons,
                i * 112,
                0,
                112,
                56,
                x + 6,
                H - 96,
                current ? 1 : 0.45,
            );
            Ui.text(ctx, Lang.t(i === 0 ? "1 SWORD" : "2 BOW"), x + 8, H - 42, {
                ...SMALL,
                color: current ? rgba(1, 0.9, 0.6) : rgba(0.6, 0.7, 0.85),
            });
        }

        if (touch && !over) this.drawTouchControls(ctx);
        if (game.result !== null) this.drawEnd(ctx, game.result, touch);
    }

    private drawTouchControls(ctx: CanvasRenderingContext2D): void {
        const circle = (
            x: number,
            y: number,
            r: number,
            fill: string,
            line: string,
        ) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = line;
            ctx.lineWidth = 2;
            ctx.stroke();
        };
        // the joystick, where the thumb landed, or waiting at home
        const thumb = [...this.main.input.touches.values()].find(
            (t) => t.role === "move",
        );
        const base = thumb ? { x: thumb.startX, y: thumb.startY } : STICK_HOME;
        const a = thumb ? 1 : 0.45;
        circle(
            base.x,
            base.y,
            STICK_RADIUS,
            rgba(0.02, 0.03, 0.08, 0.35 * a),
            css(SILVER, 0.6 * a),
        );
        circle(
            base.x + this.stick.x * STICK_RADIUS,
            base.y + this.stick.y * STICK_RADIUS,
            28,
            css(SILVER, 0.3 * a),
            css(SILVER, 0.9 * a),
        );
        // the attack button
        const game = this.game;
        const b = ATTACK_BUTTON;
        const ready = game.reload[game.weapon]! <= 0;
        circle(
            b.x,
            b.y,
            b.r,
            rgba(0.25, 0.2, 0.05, this.touchAttack ? 0.6 : 0.3),
            css(GOLD, ready ? 0.9 : 0.4),
        );
        Ui.text(ctx, Lang.t("ATTACK"), b.x, b.y - 11, {
            size: 16,
            outline: 4,
            align: "center",
            color: ready ? css(GOLD) : css(GOLD, 0.5),
        });
        // the pause button: two bars in a frame
        const p = PAUSE_BUTTON;
        Ui.frame(ctx, p.x, p.y, p.w, p.h, SILVER, 0.85);
        ctx.fillStyle = css(SILVER);
        ctx.fillRect(p.x + 18, p.y + 9, 5, 18);
        ctx.fillRect(p.x + 29, p.y + 9, 5, 18);
    }

    private drawEnd(
        ctx: CanvasRenderingContext2D,
        victory: boolean,
        touch: boolean,
    ): void {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        Ui.text(
            ctx,
            Lang.t(victory ? "THE KEEP IS FREE" : "FALLEN"),
            W / 2,
            140,
            {
                size: 64,
                outline: 16,
                align: "center",
                color: victory ? rgba(1, 0.85, 0.4) : rgba(1, 0.3, 0.3),
            },
        );
        const message = `${Lang.t(
            victory
                ? "All ten monsters lie slain. Moonshadow Keep is elven again."
                : "The monsters have overwhelmed you.",
        )}\n${Lang.t(
            touch
                ? "Tap to return to the main menu"
                : "Press Enter to return to the main menu",
        )}`;
        Ui.text(ctx, message, W / 2, 300, {
            size: 22,
            outline: 5,
            align: "center",
        });
    }
}
