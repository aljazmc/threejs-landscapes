import type { Main } from "./main";
import * as Ui from "./ui";

/** A full-screen scene part (main menu or play area) driven by Main. */
export abstract class Screen {
    constructor(protected readonly main: Main) {}

    /** Called each time the screen becomes the shown one. */
    show(): void {}

    update(dt: number): void {}

    /** Draws the screen's 2D layer over the ship, every frame. */
    draw(ctx: CanvasRenderingContext2D): void {}

    /** Called when the screen is left for good: removes what it put in the ship. */
    dispose(): void {}

    /** Text centered across the whole screen width. */
    protected centeredText(
        ctx: CanvasRenderingContext2D,
        value: string,
        scale: number,
        y: number,
        style: Ui.TextStyle = {},
    ): void {
        Ui.text(ctx, value, 0, y, {
            ...style,
            scale,
            align: "center",
            maxWidth: Ui.WIDTH / scale,
        });
    }
}
