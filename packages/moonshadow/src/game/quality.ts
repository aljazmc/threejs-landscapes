/**
 * How much the GPU is asked to draw. Phones and tablets start with the low
 * quality; any other device drops to it when the game runs slowly (see
 * FrameMeter).
 */
export interface Quality {
    /** Most pixels of the 3D view per CSS pixel. */
    pixelRatio: number;
    /** Most pixels of the HUD per CSS pixel. */
    hudRatio: number;
    /** Multisampling of the 3D view, 0 for none. */
    samples: number;
    /** Size of the bloom, as a share of the 3D view. */
    bloomScale: number;
    /** Point lights given to the brightest lights (see LightPool). */
    lights: number;
}

export const HIGH: Quality = {
    pixelRatio: 2,
    hudRatio: Infinity,
    samples: 4,
    bloomScale: 1,
    lights: 16,
};

export const LOW: Quality = {
    pixelRatio: 1,
    hudRatio: 2,
    samples: 0,
    bloomScale: 0.5,
    lights: 6,
};

/** The low quality where a finger is the main pointer (phones, tablets). */
export function initialQuality(): Quality {
    try {
        if (window.matchMedia("(pointer: coarse)").matches) return LOW;
    } catch {
        // no media queries: the high quality
    }
    return HIGH;
}

/** Frames of play skipped while the shaders compile and the game settles. */
const WARMUP = 60;
/** Frames of play averaged. */
const FRAMES = 120;
/** The slowest average frame (s) the high quality is kept at: 45 fps. */
const SLOW = 1 / 45;
/** Longer frames (s), like a stall, count as this long. */
const LONGEST = 0.1;

/** Tells from the frames of play whether they run too slowly. */
export class FrameMeter {
    private frames = 0;
    private total = 0;

    /** Adds a frame of play of dt (s); true when the last ones ran slowly. */
    slow(dt: number): boolean {
        this.frames++;
        if (this.frames <= WARMUP) return false;
        this.total += Math.min(dt, LONGEST);
        if (this.frames < WARMUP + FRAMES) return false;
        const slow = this.total / FRAMES > SLOW;
        this.frames = WARMUP;
        this.total = 0;
        return slow;
    }
}
