import { Audio } from "./audio";
import { Lang, NAMES } from "./lang";
import type { Main } from "./main";
import * as Res from "./res";
import { Screen } from "./screen";
import * as Ui from "./ui";

const BUTTON_W = 240;
const BUTTON_H = 52;
const FLAG_W = 60;
const FLAG_H = 40;
const TITLE_H = 150;
const BUTTONS_X = (Ui.WIDTH - BUTTON_W) / 2;

interface Button {
    label: string;
    action: () => void;
    flag?: number;
    flagAlpha: number;
}

const SHADOW = { dx: 1, dy: 1, color: 0x000000, alpha: 0.9 };

/**
 * The main menu over the ship itself, dimmed: the paused game as it was
 * left, or a slow flight around the control room. There is no Quit
 * button, as a page can't close its tab.
 */
export class Menu extends Screen {
    private buttons: Button[] = [];
    private selected = 0;
    private hovered = -1;
    /** The English message, or null for how to choose. */
    private status: string | null = null;
    private time = 0;

    constructor(main: Main, message?: string) {
        super(main);
        this.showMain(0);
        this.setStatus(message);
    }

    override show(): void {
        this.main.freeMouse();
        Audio.playMusic("theme");
    }

    private showMain(index: number): void {
        this.buttons = [];
        this.addButton(Lang.t("Play"), () => this.main.play());
        this.addButton(Lang.t("Save"), () => {
            this.setStatus(
                this.main.save()
                    ? "Game saved."
                    : "There is no game in progress to save.",
            );
        });
        this.addButton(Lang.t("Load"), () => {
            if (!this.main.load())
                this.setStatus("There is no saved game yet.");
        });
        this.addButton(
            Lang.t("Language"),
            () => this.showLanguages(),
            Lang.current,
        );
        this.select(index);
    }

    /** The languages with their flags, the current one brightest. */
    private showLanguages(): void {
        this.buttons = [];
        NAMES.forEach((name, i) => {
            this.addButton(
                name,
                () => {
                    Lang.choose(i);
                    this.showLanguages();
                },
                i,
                i === Lang.current ? 1 : 0.45,
            );
        });
        this.addButton(Lang.t("Back"), () => {
            this.showMain(3);
            this.setStatus(undefined);
        });
        this.select(Lang.current);
        this.setStatus("Choose a language");
    }

    private addButton(
        label: string,
        action: () => void,
        flag?: number,
        flagAlpha = 1.0,
    ): void {
        const button: Button = { label, action, flagAlpha };
        if (flag !== undefined) button.flag = flag;
        this.buttons.push(button);
    }

    private buttonY(index: number): number {
        return 186 + index * 58;
    }

    private buttonAt(x: number, y: number): number {
        if (x < BUTTONS_X || x >= BUTTONS_X + BUTTON_W) return -1;
        for (let i = 0; i < this.buttons.length; i++) {
            const top = this.buttonY(i);
            if (y >= top && y < top + BUTTON_H) return i;
        }
        return -1;
    }

    private select(index: number): void {
        const n = this.buttons.length;
        this.selected = ((index % n) + n) % n | 0;
    }

    /** Moves the highlight to another button, with a blip. */
    private choose(index: number): void {
        const n = this.buttons.length;
        if (((index % n) + n) % n === this.selected) return;
        Audio.play("click", 0.6);
        this.select(index);
    }

    private press(index: number): void {
        Audio.play("click");
        this.buttons[index]?.action();
    }

    /** Shows the English message (or the controls) in the current language. */
    private setStatus(message: string | undefined): void {
        this.status = message ?? null;
    }

    override update(dt: number): void {
        this.time += dt;
        const main = this.main;
        main.ship.update(dt);
        if (main.game === null) main.ship.flyby(main.camera, this.time);

        const input = main.input;
        // entering a button highlights it
        const over = this.buttonAt(input.mouse.x, input.mouse.y);
        if (over !== this.hovered) {
            this.hovered = over;
            if (over >= 0) this.choose(over);
        }
        if (input.isPressed("ArrowUp")) this.choose(this.selected - 1);
        if (input.isPressed("ArrowDown")) this.choose(this.selected + 1);
        if (input.isPressed("Enter") || input.isPressed("Space")) {
            this.press(this.selected);
            return;
        }
        for (const click of input.clicks) {
            const i = this.buttonAt(click.x, click.y);
            if (i >= 0) {
                this.press(i);
                return;
            }
        }
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        // the ship, dimmed, behind the title and the buttons
        Ui.fillRect(ctx, 0, 0, Ui.WIDTH, Ui.HEIGHT, 0x05060c, 0.5);
        const px = (Ui.WIDTH - 300) / 2;
        Ui.fillRect(ctx, px, 176, 300, 304, 0x0a0418, 0.6);
        ctx.strokeStyle = Ui.css(0x2af0ff, 0.5);
        ctx.lineWidth = 2;
        ctx.strokeRect(px, 176, 300, 304);
        Ui.scanlines(ctx);

        // the logo sheet has a row per language, with the subtitle translated
        const titles = Res.image("title");
        Ui.tile(
            ctx,
            titles,
            0,
            Lang.current * TITLE_H,
            titles.width,
            TITLE_H,
            (Ui.WIDTH - titles.width) / 2,
            20,
        );

        const status =
            this.status ??
            (this.main.input.touchMode
                ? "Tap to choose"
                : "Arrows + Enter or mouse to choose");
        this.centeredText(ctx, Lang.t(status), 2, 490, {
            color: 0x9ff4ff,
            shadow: { dx: 1, dy: 1, color: 0x000000, alpha: 0.8 },
        });

        const sheet = Res.image("button");
        const flags = Res.image("flags");
        this.buttons.forEach((b, i) => {
            const y = this.buttonY(i);
            const selected = i === this.selected;
            Ui.tile(
                ctx,
                sheet,
                0,
                selected ? BUTTON_H : 0,
                BUTTON_W,
                BUTTON_H,
                BUTTONS_X,
                y,
            );
            // a flag takes the left of the button, the label the rest
            let left = 0;
            if (b.flag !== undefined) {
                Ui.tile(
                    ctx,
                    flags,
                    b.flag * FLAG_W,
                    0,
                    FLAG_W,
                    FLAG_H,
                    BUTTONS_X + 8,
                    y + (BUTTON_H - FLAG_H) / 2,
                    b.flagAlpha,
                );
                left = FLAG_W + 4;
            }
            Ui.text(
                ctx,
                b.label,
                BUTTONS_X + left,
                y + (BUTTON_H - Ui.lineHeight() * 2) / 2,
                {
                    scale: 2,
                    align: "center",
                    maxWidth: (BUTTON_W - left) / 2,
                    color: selected ? 0xffe0fa : 0x9ff4ff,
                    shadow: SHADOW,
                },
            );
        });
    }
}
