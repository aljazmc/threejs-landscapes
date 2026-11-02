import * as Res from "./res";

/**
 * The screens' 2D layer: a canvas over the 3D view with the coordinates
 * of the game's 960x540 window, scaled to the letterboxed stage, and the
 * bitmap font.
 */

export const WIDTH = 960;
export const HEIGHT = 540;

interface Glyph {
    x: number;
    y: number;
    w: number;
    h: number;
    dx: number;
    dy: number;
    advance: number;
}

/**
 * The Pixel Operator pixel font with the Polish and Slovenian letters added
 * (res/shooter-font.fnt and .png, written by pillow-scripts/font.py).
 */
class Font {
    readonly lineHeight: number;
    private readonly glyphs = new Map<string, Glyph>();
    private readonly atlas: HTMLImageElement;
    /** The atlas in each text color (its glyphs are white). */
    private readonly tinted = new Map<string, HTMLCanvasElement>();

    constructor(xml: string, atlas: HTMLImageElement) {
        this.atlas = atlas;
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const font = doc.documentElement;
        this.lineHeight = Number(font.getAttribute("height") ?? 16);
        for (const c of Array.from(font.getElementsByTagName("Char"))) {
            const code = c.getAttribute("code");
            if (code === null) continue;
            const [x = 0, y = 0, w = 0, h = 0] = (c.getAttribute("rect") ?? "")
                .split(" ")
                .map(Number);
            const [dx = 0, dy = 0] = (c.getAttribute("offset") ?? "")
                .split(" ")
                .map(Number);
            const advance = Number(c.getAttribute("width") ?? 0);
            this.glyphs.set(code, { x, y, w, h, dx, dy, advance });
        }
    }

    glyph(char: string): Glyph | undefined {
        return this.glyphs.get(char) ?? this.glyphs.get("?");
    }

    lineWidth(line: string): number {
        let w = 0;
        for (const char of line) w += this.glyph(char)?.advance ?? 0;
        return w;
    }

    sheet(color: string): HTMLCanvasElement {
        let canvas = this.tinted.get(color);
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.width = this.atlas.width;
            canvas.height = this.atlas.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(this.atlas, 0, 0);
            ctx.globalCompositeOperation = "source-in";
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.tinted.set(color, canvas);
        }
        return canvas;
    }

    /** The lines of the text, wrapped at spaces to fit maxWidth. */
    wrap(text: string, maxWidth?: number): string[] {
        const lines: string[] = [];
        for (const paragraph of text.split("\n")) {
            if (maxWidth === undefined) {
                lines.push(paragraph);
                continue;
            }
            let line = "";
            for (const word of paragraph.split(" ")) {
                const next = line === "" ? word : `${line} ${word}`;
                if (line !== "" && this.lineWidth(next) > maxWidth) {
                    lines.push(line);
                    line = word;
                } else line = next;
            }
            lines.push(line);
        }
        return lines;
    }
}

let font: Font | null = null;

function getFont(): Font {
    font ??= new Font(Res.text("font.fnt"), Res.image("font"));
    return font;
}

/** 0xrrggbb as a CSS color. */
export function css(color: number, alpha = 1): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export interface TextStyle {
    scale?: number;
    color?: number;
    align?: "left" | "center" | "right";
    /** In the text's own (unscaled) pixels. */
    maxWidth?: number;
    shadow?: { dx: number; dy: number; color: number; alpha: number };
    alpha?: number;
}

/** The height of a line of text, unscaled. */
export function lineHeight(): number {
    return getFont().lineHeight;
}

/** Draws text placed at (x, y). */
export function text(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    style: TextStyle = {},
): void {
    const f = getFont();
    const scale = style.scale ?? 1;
    const lines = f.wrap(value, style.maxWidth);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;
    const pass = (sheet: HTMLCanvasElement, ox: number, oy: number) => {
        lines.forEach((line, row) => {
            let px = 0;
            const width = f.lineWidth(line);
            if (style.maxWidth !== undefined && style.align === "center")
                px = (style.maxWidth - width) / 2;
            else if (style.maxWidth !== undefined && style.align === "right")
                px = style.maxWidth - width;
            else if (style.align === "center") px = -width / 2;
            else if (style.align === "right") px = -width;
            const py = row * f.lineHeight;
            for (const char of line) {
                const g = f.glyph(char);
                if (!g) continue;
                if (g.w > 0 && g.h > 0)
                    ctx.drawImage(
                        sheet,
                        g.x,
                        g.y,
                        g.w,
                        g.h,
                        px + g.dx + ox,
                        py + g.dy + oy,
                        g.w,
                        g.h,
                    );
                px += g.advance;
            }
        });
    };
    const alpha = style.alpha ?? 1;
    if (style.shadow) {
        ctx.globalAlpha = alpha * style.shadow.alpha;
        pass(
            f.sheet(css(style.shadow.color)),
            style.shadow.dx,
            style.shadow.dy,
        );
    }
    ctx.globalAlpha = alpha;
    pass(f.sheet(css(style.color ?? 0xffffff)), 0, 0);
    ctx.restore();
}

/** Thin dark lines over the whole view every 3 pixels, a cyberpunk visor. */
export function scanlines(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = css(0x000000, 0.12);
    for (let y = 0; y < HEIGHT; y += 3) ctx.fillRect(0, y, WIDTH, 1);
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha = 1,
): void {
    ctx.fillStyle = css(color, alpha);
    ctx.fillRect(x, y, w, h);
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
