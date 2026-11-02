import { FONT } from "./res";

/**
 * The screens' 2D layer: a canvas over the 3D view with the coordinates of the game's 960x540 window, scaled to
 * the letterboxed stage.
 */

export const WIDTH = 960;
export const HEIGHT = 540;

/** The height of a line of the font: about 1.37 times its size. */
export const LINE = 1.37;

/** A color (0 to 1 each) with alpha, as CSS. */
export function rgba(r: number, g: number, b: number, a = 1): string {
    const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `rgba(${c(r)},${c(g)},${c(b)},${Math.min(1, Math.max(0, a))})`;
}

export type Rgb = [number, number, number];

export const GOLD: Rgb = [1, 0.8, 0.35];
export const SILVER: Rgb = [0.75, 0.85, 1];
/** The dark blue of the text outlines. */
export const NIGHT: Rgb = [0.03, 0.04, 0.1];

export function css(c: Rgb, a = 1): string {
    return rgba(c[0], c[1], c[2], a);
}

export interface TextStyle {
    size: number;
    color?: string;
    align?: CanvasTextAlign;
    /** The outline: its width and color. */
    outline?: number;
    outlineColor?: string;
}

/** Draws text with its top at y (lines split at \n). */
export function text(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    style: TextStyle,
): void {
    ctx.font = FONT.replace("SIZE", String(style.size));
    ctx.textAlign = style.align ?? "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    const height = style.size * LINE;
    value.split("\n").forEach((line, i) => {
        const ly = y + i * height + height / 2;
        const outline = style.outline ?? 0;
        if (outline > 0) {
            ctx.strokeStyle = style.outlineColor ?? css(NIGHT);
            ctx.lineWidth = outline;
            ctx.strokeText(line, x, ly);
        }
        ctx.fillStyle = style.color ?? "#fff";
        ctx.fillText(line, x, ly);
    });
}

/** Frame with cut corners, in the keep's gold or silver. */
export function frame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: Rgb,
    alpha = 1,
): void {
    const k = 8;
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w - k, y);
    ctx.lineTo(x + w, y + k);
    ctx.lineTo(x + w, y + h - k);
    ctx.lineTo(x + w - k, y + h);
    ctx.lineTo(x + k, y + h);
    ctx.lineTo(x, y + h - k);
    ctx.lineTo(x, y + k);
    ctx.closePath();
    ctx.fillStyle = rgba(0.02, 0.03, 0.08, 0.55 * alpha);
    ctx.fill();
    ctx.strokeStyle = css(color, alpha);
    ctx.lineWidth = 2;
    ctx.stroke();
}

/** Draws the part (sx, sy, w, h) of an image at (x, y). */
export function tile(
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    sx: number,
    sy: number,
    w: number,
    h: number,
    x: number,
    y: number,
    alpha = 1,
): void {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, w, h, x, y, w, h);
    ctx.globalAlpha = 1;
}
