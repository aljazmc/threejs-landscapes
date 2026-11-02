/**
 * The keys and the mouse: isDown while held, isPressed
 * in the first update after the press. Keys are KeyboardEvent.code values;
 * the left mouse button is MOUSE_LEFT. Fingers on a touchscreen are
 * followed on their own (touches), and a lifted finger counts as a click.
 */

export const MOUSE_LEFT = "Mouse0";

/** Keys the page itself must not act on (scrolling). */
const CAPTURED = new Set([
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
]);

/** A finger on the screen, in the 960x540 coordinates of the screens. */
export interface TouchPoint {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    /** Where it was at the previous update. */
    prevX: number;
    prevY: number;
    /** performance.now() when it touched down. */
    startedAt: number;
    /** What the screen made of it (a joystick, the fire button...). */
    role: string | null;
}

export interface Click {
    x: number;
    y: number;
    /** performance.now() when the button or finger went down. */
    startedAt: number;
}

export class Input {
    /** The pointer in the 960x540 coordinates of the screens. */
    readonly mouse = { x: -1, y: -1 };
    /** Where the left button was clicked, or a finger lifted, since the last update. */
    clicks: Click[] = [];
    /** The fingers on the screen. */
    readonly touches = new Map<number, TouchPoint>();
    /** The fingers that touched down since the last update. */
    began: TouchPoint[] = [];
    /** Played by touch: true from the first touch until keys or a mouse are used. */
    touchMode = false;

    private readonly down = new Set<string>();
    private pressed = new Set<string>();
    private lastTouch = -Infinity;
    private mouseDownAt = 0;

    constructor(
        target: HTMLElement,
        toScreen: (
            clientX: number,
            clientY: number,
        ) => { x: number; y: number },
    ) {
        window.addEventListener("keydown", (e) => {
            if (CAPTURED.has(e.code)) e.preventDefault();
            this.touchMode = false;
            if (e.repeat) return;
            this.press(e.code === "NumpadEnter" ? "Enter" : e.code);
        });
        window.addEventListener("keyup", (e) => {
            this.down.delete(e.code === "NumpadEnter" ? "Enter" : e.code);
        });
        window.addEventListener("blur", () => this.down.clear());
        target.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            this.mouseDownAt = performance.now();
            this.press(MOUSE_LEFT);
        });
        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) this.down.delete(MOUSE_LEFT);
        });
        target.addEventListener("mousemove", (e) => {
            // browsers may still send mouse moves after touches
            if (performance.now() - this.lastTouch > 1000)
                this.touchMode = false;
            const p = toScreen(e.clientX, e.clientY);
            this.mouse.x = p.x;
            this.mouse.y = p.y;
        });
        target.addEventListener("click", (e) => {
            if (e.button !== 0) return;
            const p = toScreen(e.clientX, e.clientY);
            this.clicks.push({ ...p, startedAt: this.mouseDownAt });
        });

        // fingers: the page neither scrolls nor zooms, nor makes mouse
        // events of them
        const touches = (
            e: TouchEvent,
            each: (t: Touch, p: { x: number; y: number }) => void,
        ) => {
            e.preventDefault();
            this.touchMode = true;
            this.lastTouch = performance.now();
            for (const t of Array.from(e.changedTouches))
                each(t, toScreen(t.clientX, t.clientY));
        };
        const options = { passive: false };
        target.addEventListener(
            "touchstart",
            (e) =>
                touches(e, (t, p) => {
                    const point: TouchPoint = {
                        id: t.identifier,
                        x: p.x,
                        y: p.y,
                        startX: p.x,
                        startY: p.y,
                        prevX: p.x,
                        prevY: p.y,
                        startedAt: performance.now(),
                        role: null,
                    };
                    this.touches.set(t.identifier, point);
                    this.began.push(point);
                    // a menu highlights what the finger is on
                    this.mouse.x = p.x;
                    this.mouse.y = p.y;
                }),
            options,
        );
        target.addEventListener(
            "touchmove",
            (e) =>
                touches(e, (t, p) => {
                    const point = this.touches.get(t.identifier);
                    if (!point) return;
                    point.x = p.x;
                    point.y = p.y;
                }),
            options,
        );
        const end = (e: TouchEvent, tap: boolean) =>
            touches(e, (t, p) => {
                const point = this.touches.get(t.identifier);
                this.touches.delete(t.identifier);
                if (tap && point)
                    this.clicks.push({ ...p, startedAt: point.startedAt });
            });
        target.addEventListener("touchend", (e) => end(e, true), options);
        target.addEventListener("touchcancel", (e) => end(e, false), options);
    }

    private press(code: string): void {
        this.down.add(code);
        this.pressed.add(code);
    }

    isDown(code: string): boolean {
        return this.down.has(code);
    }

    isPressed(code: string): boolean {
        return this.pressed.has(code);
    }

    /** After each update: the presses and clicks are old news. */
    endFrame(): void {
        this.pressed.clear();
        this.clicks = [];
        this.began = [];
        for (const t of this.touches.values()) {
            t.prevX = t.x;
            t.prevY = t.y;
        }
    }
}
