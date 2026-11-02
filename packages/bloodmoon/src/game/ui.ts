import { FONT } from "./res";

/**
 * The screens' 2D layer: a canvas over the 3D view with the coordinates
 * of the game's 960x540 window, scaled to the letterboxed stage, and its
 * texts in DejaVu Sans.
 */

export const WIDTH = 960;
export const HEIGHT = 540;

/** The line height: 1.2 times the font size. */
export const LINE = 1.2;

/** An sRGB color (0 to 1 each) with alpha, as CSS. */
export function rgba(r: number, g: number, b: number, a = 1): string {
    const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `rgba(${c(r)},${c(g)},${c(b)},${Math.min(1, Math.max(0, a))})`;
}

export const GOLD: [number, number, number] = [1, 0.75, 0.35];
export const SILVER: [number, number, number] = [0.8, 0.82, 0.9];
export const SHADE = rgba(0.03, 0.01, 0.02, 0.55);
export const BAR_BACK = rgba(0.1, 0.05, 0.06);

export function css(c: [number, number, number], a = 1): string {
    return rgba(c[0], c[1], c[2], a);
}

export interface TextStyle {
    size: number;
    color?: string;
    align?: CanvasTextAlign;
    /** A shadow 4 px down and right, black at 0.75. */
    shadow?: boolean;
}

/** Draws text with its top at y (lines split at \n). */
export function text(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    style: TextStyle,
): void {
    ctx.font = `${style.size}px "${FONT}"`;
    ctx.textAlign = style.align ?? "left";
    ctx.textBaseline = "middle";
    const height = style.size * LINE;
    value.split("\n").forEach((line, i) => {
        const ly = y + i * height + height / 2;
        if (style.shadow !== false) {
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillText(line, x + 4, ly + 4);
        }
        ctx.fillStyle = style.color ?? "#fff";
        ctx.fillText(line, x, ly);
    });
}

/** A dark box with a thin colored frame (2 px inside its size). */
export function frame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    border: string,
    background = SHADE,
): void {
    ctx.fillStyle = background;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
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
