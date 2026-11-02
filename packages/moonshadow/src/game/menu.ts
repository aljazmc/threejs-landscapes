import { Audio } from "./audio";
import { Lang, NAMES } from "./lang";
import type { Main } from "./main";
import * as Res from "./res";
import * as Ui from "./ui";

const BUTTON_W = 240;
const BUTTON_H = 52;
const FLAG_W = 60;
const FLAG_H = 40;
const TITLE_W = 640;
const TITLE_H = 150;
const BUTTONS_X = (Ui.WIDTH - BUTTON_W) / 2;
/** There is no Quit, as a page can't close its tab. */
const LABELS = ["Play", "Save", "Load", "Language"];
const LANGUAGE = 3;

/**
 * The main menu, drawn over the keep: the paused game as it was left, or a
 * slow flight around the throne hall.
 */
export class Menu {
    /** Whether the menu shows the languages (and Back) instead of its main buttons. */
    private languages = false;
    private selected = 0;
    private hovered = -1;
    /** The English message, or null for how to choose. */
    private status: string | null;

    constructor(
        private readonly main: Main,
        message: string | null,
    ) {
        this.status = message;
        Audio.playMusic("theme");
    }

    private get count(): number {
        return this.languages ? NAMES.length + 1 : LABELS.length;
    }

    /** Top edge of the index-th button in the 960x540 layout. */
    private buttonTop(index: number): number {
        return 186 + index * 58;
    }

    private buttonAt(x: number, y: number): number {
        if (x < BUTTONS_X || x >= BUTTONS_X + BUTTON_W) return -1;
        for (let i = 0; i < this.count; i++) {
            const top = this.buttonTop(i);
            if (y >= top && y < top + BUTTON_H) return i;
        }
        return -1;
    }

    update(): void {
        const input = this.main.input;
        const count = this.count;
        const before = this.selected;
        if (input.isPressed("ArrowUp"))
            this.selected = (this.selected + count - 1) % count;
        if (input.isPressed("ArrowDown"))
            this.selected = (this.selected + 1) % count;
        // like a TextureButton's mouse_entered
        // the mouse (or a finger) selects a button when it moves onto it
        const over = this.buttonAt(input.mouse.x, input.mouse.y);
        if (over !== this.hovered) {
            this.hovered = over;
            if (over >= 0) this.selected = over;
        }
        if (this.selected !== before) Audio.play("click", 0.6);

        const clicked = input.clicks.find((c) => this.buttonAt(c.x, c.y) >= 0);
        if (clicked) this.selected = this.buttonAt(clicked.x, clicked.y);
        if (!(clicked || input.isPressed("Enter") || input.isPressed("Space")))
            return;
        Audio.play("click");
        if (!this.languages) {
            switch (LABELS[this.selected]) {
                case "Play":
                    this.main.play();
                    break;
                case "Save":
                    this.status = this.main.save()
                        ? "Game saved."
                        : "There is no game in progress to save.";
                    break;
                case "Load":
                    if (!this.main.load())
                        this.status = "There is no saved game yet.";
                    break;
                default:
                    this.languages = true;
                    this.selected = Lang.current;
                    this.status = "Choose a language";
            }
            return;
        }
        // the language page: a language, or Back to the main buttons
        if (this.selected < NAMES.length) {
            Lang.choose(this.selected);
            this.status = "Choose a language";
        } else {
            this.languages = false;
            this.selected = LANGUAGE;
            this.status = null;
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = Ui.rgba(0.02, 0.03, 0.08, 0.45);
        ctx.fillRect(0, 0, Ui.WIDTH, Ui.HEIGHT);
        ctx.fillStyle = Ui.rgba(0.02, 0.03, 0.08, 0.5);
        ctx.fillRect((Ui.WIDTH - 300) / 2, 176, 300, 304);
        // the logo sheet has a row per language, with the subtitle translated
        Ui.tile(
            ctx,
            Res.image("title"),
            0,
            Lang.current * TITLE_H,
            TITLE_W,
            TITLE_H,
            (Ui.WIDTH - TITLE_W) / 2,
            20,
        );

        const sheet = Res.image("button");
        const flags = Res.image("flags");
        for (let i = 0; i < this.count; i++) {
            const top = this.buttonTop(i);
            Ui.tile(
                ctx,
                sheet,
                0,
                i === this.selected ? BUTTON_H : 0,
                BUTTON_W,
                BUTTON_H,
                BUTTONS_X,
                top,
            );
            // the main buttons, or the languages with their flags (the
            // current one brightest) and Back
            let label: string;
            let flag: { index: number; alpha: number } | null = null;
            if (!this.languages) {
                label = Lang.t(LABELS[i]!);
                if (i === LANGUAGE) flag = { index: Lang.current, alpha: 1 };
            } else if (i < NAMES.length) {
                label = NAMES[i]!;
                flag = { index: i, alpha: i === Lang.current ? 1 : 0.45 };
            } else label = Lang.t("Back");
            // a flag takes the left of the button, the label the rest (clear
            // of the ornament at the right end)
            const left = flag ? FLAG_W + 4 : 0;
            const right = flag ? 12 : 0;
            if (flag)
                Ui.tile(
                    ctx,
                    flags,
                    flag.index * FLAG_W,
                    0,
                    FLAG_W,
                    FLAG_H,
                    BUTTONS_X + 8,
                    top + (BUTTON_H - FLAG_H) / 2,
                    flag.alpha,
                );
            Ui.text(
                ctx,
                label,
                BUTTONS_X + left + (BUTTON_W - left - right) / 2,
                top + (BUTTON_H - 24 * Ui.LINE) / 2,
                { size: 24, align: "center", outline: 6 },
            );
        }

        const hint = this.main.input.touchMode
            ? "Tap to choose"
            : "Arrows + Enter or mouse to choose";
        Ui.text(ctx, Lang.t(this.status ?? hint), Ui.WIDTH / 2, 486, {
            size: 22,
            align: "center",
            outline: 5,
        });
    }
}
