import * as THREE from "three";
import type { Castle } from "./castle";
import {
    type Controls,
    type Game,
    NO_CONTROLS,
    PLAYER_HEALTH,
    REVOLVER_INTERVAL,
} from "./game";
import { MOUSE_LEFT } from "./input";
import { Lang } from "./lang";
import type { Main } from "./main";
import * as Res from "./res";
import * as Ui from "./ui";
import { BAR_BACK, GOLD, SILVER, css, rgba } from "./ui";

/**
 * The playing screen: the controls driving the game, the HUD drawn over
 * the castle (health, monsters left, the section, the weapons with their
 * reload and fuel, the crosshair, red edges when hurt) and the end of the
 * game. On a touchscreen: a joystick under the left thumb, dragging on the
 * right half to look around, a fire button, the weapon panels to tap and a
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
const FIRE_BUTTON = { x: W - 110, y: 335, r: 56 };
const PAUSE_BUTTON = { x: W / 2 - 26, y: 8, w: 52, h: 36 };

/** The left edge of weapon k's panel; the panels stand on the bottom right. */
function panelLeft(k: number): number {
    return W - (12 + (1 - k) * 136) - 124;
}
const PANEL_TOP = H - 26 - 76;

export class Play {
    /** The mouse moves since the last update, while it is captured. */
    private lookX = 0;
    private lookY = 0;
    /** The joystick's tilt, up to 1 each way: x to the right, y down. */
    private stick = { x: 0, y: 0 };
    private touchFire = false;
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
                this.touchFire,
            select,
        };
        this.lookX = 0;
        this.lookY = 0;
        game.update(dt, controls, castle);
    }

    private tappedWeapon: number | null = null;

    /**
     * Gives each finger that touched down its job: the pause button, a
     * weapon panel, the fire button, the joystick (the first finger on the
     * left half, where it lands) or looking around (any other). Returns
     * true when the game was paused.
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
            const f = FIRE_BUTTON;
            if (Math.hypot(t.x - f.x, t.y - f.y) <= f.r * 1.25) {
                t.role = "fire";
                continue;
            }
            const steering = [...input.touches.values()].some(
                (o) => o.role === "move",
            );
            t.role = t.x < W / 2 && !steering ? "move" : "look";
        }
        this.stick = { x: 0, y: 0 };
        this.touchFire = false;
        for (const t of input.touches.values()) {
            if (t.role === "fire") this.touchFire = true;
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
        const share = game.health / PLAYER_HEALTH;
        const low =
            share < 0.25 && game.result === null
                ? 0.12 + 0.08 * Math.sin(game.time * 6)
                : 0;
        const hurt = Math.max(game.hurtTime, low);

        // struck: red edges over the view
        if (hurt > 0) {
            ctx.fillStyle = rgba(0.8, 0.03, 0.03, hurt * 0.25);
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = rgba(0.8, 0.03, 0.03, hurt * 0.8);
            ctx.fillRect(0, 0, W, 24);
            ctx.fillRect(0, H - 24, W, 24);
            ctx.fillRect(0, 24, 24, H - 48);
            ctx.fillRect(W - 24, 24, 24, H - 48);
        }
        if (game.result === null) {
            const ready = game.weapon === 0 ? game.reload <= 0 : !game.dry;
            Ui.tile(
                ctx,
                Res.image("crosshair"),
                game.weapon * 128,
                0,
                128,
                128,
                W / 2 - 64,
                H / 2 - 64,
                ready ? 1 : 0.45,
            );
        }
        // a hit: four ticks around the aiming mark
        if (game.hitTime > 0) {
            ctx.fillStyle = rgba(1, 1, 1, game.hitTime / 0.15);
            for (const sx of [-1, 1])
                for (const sy of [-1, 1])
                    ctx.fillRect(
                        W / 2 + sx * 14 - 2,
                        H / 2 + sy * 14 - 2,
                        5,
                        5,
                    );
        }

        const left = game.monsters.filter((m) => !m.dead()).length;
        Ui.frame(ctx, 12, 8, 250, 36, css(GOLD, 0.85));
        Ui.text(
            ctx,
            Lang.t("CREATURES {0}/{1}", [left, game.monsters.length]),
            26,
            14,
            {
                size: 20,
                color: css(GOLD),
            },
        );
        Ui.frame(ctx, W - 262, 8, 250, 36, css(SILVER, 0.85));
        Ui.text(
            ctx,
            Lang.t(castle.sectionName(game.playerX, game.playerY)),
            W - 26,
            14,
            {
                size: 20,
                color: css(SILVER),
                align: "right",
            },
        );

        // health
        const top = H - 26 - 66;
        Ui.frame(ctx, 16, top, 300, 66, css(SILVER));
        Ui.text(
            ctx,
            Lang.t("HEALTH {0}", [Math.ceil(game.health)]),
            30,
            top + 8,
            {
                size: 20,
                color: css(SILVER),
            },
        );
        ctx.fillStyle = BAR_BACK;
        ctx.fillRect(28, top + 42, 276, 12);
        ctx.fillStyle =
            share > 0.5
                ? rgba(0.4, 0.9, 0.5)
                : share > 0.25
                  ? rgba(1, 0.7, 0.2)
                  : rgba(1, 0.25, 0.25);
        ctx.fillRect(28, top + 42, 276 * share, 12);

        // the weapons, with the revolver's reload and the flamethrower's fuel
        const icons = Res.image("icons");
        for (let k = 0; k < 2; k++) {
            const x = panelLeft(k);
            const y = PANEL_TOP;
            const current = k === game.weapon;
            Ui.frame(
                ctx,
                x,
                y,
                124,
                76,
                current ? css(GOLD) : css(SILVER, 0.5),
            );
            Ui.tile(
                ctx,
                icons,
                k * 112,
                0,
                112,
                56,
                x + 6,
                y + 2,
                current ? 1 : 0.45,
            );
            Ui.text(
                ctx,
                Lang.t(k === 0 ? "1 REVOLVER" : "2 FLAMER"),
                x + 8,
                y + 58,
                {
                    size: 11,
                    color: current ? rgba(1, 0.9, 0.6) : rgba(0.65, 0.6, 0.65),
                },
            );
            const [ready, full] =
                k === 0
                    ? [1 - game.reload / REVOLVER_INTERVAL, game.reload <= 0]
                    : [game.fuel, !game.dry];
            ctx.fillStyle = BAR_BACK;
            ctx.fillRect(x + 78, y + 62, 40, 5);
            ctx.fillStyle = full ? rgba(0.4, 0.9, 0.5) : rgba(1, 0.7, 0.2);
            ctx.fillRect(
                x + 78,
                y + 62,
                40 * THREE.MathUtils.clamp(ready, 0, 1),
                5,
            );
        }

        Ui.text(
            ctx,
            Lang.t(
                touch
                    ? "Left thumb: move   Right thumb: aim   FIRE: shoot   Tap a weapon to choose it   II: menu"
                    : "WASD / arrows: move   Mouse: aim   Space / left click: fire   1: revolver   2: flamethrower   Esc: menu",
            ),
            W / 2,
            H - 2 - 13 * Ui.LINE,
            { size: 13, color: rgba(0.8, 0.75, 0.75), align: "center" },
        );

        if (touch && game.result === null) this.drawTouchControls(ctx);
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
            Ui.rgba(0.03, 0.01, 0.02, 0.35 * a),
            css(SILVER, 0.6 * a),
        );
        circle(
            base.x + this.stick.x * STICK_RADIUS,
            base.y + this.stick.y * STICK_RADIUS,
            28,
            css(SILVER, 0.3 * a),
            css(SILVER, 0.9 * a),
        );
        // the fire button
        const game = this.game;
        const f = FIRE_BUTTON;
        const ready = game.weapon === 0 ? game.reload <= 0 : !game.dry;
        circle(
            f.x,
            f.y,
            f.r,
            Ui.rgba(0.6, 0.05, 0.05, this.touchFire ? 0.55 : 0.25),
            css(GOLD, ready ? 0.9 : 0.4),
        );
        Ui.text(ctx, Lang.t("FIRE"), f.x, f.y - 10, {
            size: 18,
            align: "center",
            color: ready ? css(GOLD) : css(GOLD, 0.5),
        });
        // the pause button: two bars in a frame
        const p = PAUSE_BUTTON;
        Ui.frame(ctx, p.x, p.y, p.w, p.h, css(SILVER, 0.85));
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
        const message = `${Lang.t(
            victory
                ? "All ten creatures of the night are destroyed. Bloodmoon Manor is free."
                : "The creatures of the night have overwhelmed you.",
        )}\n${Lang.t(
            touch
                ? "Tap to return to the main menu"
                : "Press Enter to return to the main menu",
        )}`;
        // a column in the middle: the title, 30 px, the message
        const titleH = 60 * Ui.LINE;
        const messageH = 2 * 22 * Ui.LINE;
        const y = (H - titleH - 30 - messageH) / 2;
        Ui.text(
            ctx,
            Lang.t(victory ? "THE MANOR IS CLEANSED" : "FALLEN"),
            W / 2,
            y,
            {
                size: 60,
                align: "center",
                color: victory ? css(GOLD) : rgba(1, 0.3, 0.3),
            },
        );
        Ui.text(ctx, message, W / 2, y + titleH + 30, {
            size: 22,
            align: "center",
        });
    }
}
