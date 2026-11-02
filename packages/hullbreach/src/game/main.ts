import * as THREE from "three";
import { LightPool, patchAttenuation } from "../lights";
import { Audio } from "./audio";
import { Game, type SaveData } from "./game";
import { Input } from "./input";
import { Lang } from "./lang";
import { Menu } from "./menu";
import { FrameMeter, initialQuality, LOW, type Quality } from "./quality";
import * as Res from "./res";
import type { Screen } from "./screen";
import { Ship } from "./ship";
import * as Ui from "./ui";

/** The longest step of the game (s): nothing passes through a wall in it. */
const MAX_STEP = 1 / 30;
/**
 * The longest frame (s) the game catches up on in steps; after a longer
 * stall (or a hidden tab) it rather slows down.
 */
const MAX_FRAME = 0.25;

/** Where the paused game is saved. */
const SAVE_KEY = "hullbreach.savegame";

/**
 * The app: the 960x540 view of the game letterboxed in the window, the
 * ship drawn in 3D behind every screen and the screen switching, saving
 * and loading.
 */
export class Main {
    /** The game in progress, kept while the main menu is shown. */
    game: Game | null = null;
    ship!: Ship;
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
        70,
        Ui.WIDTH / Ui.HEIGHT,
        0.05,
        150,
    );
    readonly lights: LightPool;
    readonly input: Input;
    private screen: Screen | null = null;

    private readonly stage = document.createElement("div");
    private readonly renderer: THREE.WebGLRenderer;
    private readonly hud = document.createElement("canvas");
    private readonly ctx: CanvasRenderingContext2D;
    private hudScale = 1;
    private quality: Quality = initialQuality();
    private readonly meter = new FrameMeter();
    private last = 0;
    private onMouseMove: ((dx: number, dy: number) => void) | null = null;

    constructor(root: HTMLElement) {
        // colors are blended as they are stored, without sRGB conversion
        THREE.ColorManagement.enabled = false;
        patchAttenuation();

        this.stage.className = "stage";
        root.appendChild(this.stage);
        // antialiasing is set with the context: off on phones and tablets
        // from the start, kept if the game drops to the low quality later
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.quality.samples > 0,
        });
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        this.renderer.setClearColor(0x020308);
        this.stage.appendChild(this.renderer.domElement);
        this.hud.className = "hud";
        this.stage.appendChild(this.hud);
        this.ctx = this.hud.getContext("2d")!;

        this.scene.add(
            new THREE.AmbientLight(new THREE.Color(0.1, 0.1, 0.16), Math.PI),
        );
        this.lights = new LightPool(this.scene);
        this.lights.setLimit(this.quality.lights);
        this.camera.up.set(0, 0, 1);

        this.input = new Input(this.hud, (cx, cy) => {
            const r = this.hud.getBoundingClientRect();
            return {
                x: ((cx - r.left) / r.width) * Ui.WIDTH,
                y: ((cy - r.top) / r.height) * Ui.HEIGHT,
            };
        });
        // browsers play sound only once the page was used
        const resume = () => {
            if (Audio.context.state !== "running") void Audio.context.resume();
        };
        // (Safari on iOS only on the end of a touch)
        for (const event of ["pointerdown", "pointerup", "touchend", "keydown"])
            window.addEventListener(event, resume);

        document.addEventListener("mousemove", (e) => {
            if (this.mouseLocked && this.onMouseMove)
                this.onMouseMove(e.movementX, e.movementY);
        });
        document.addEventListener("pointerlockchange", () => {
            // the browser let the mouse go (Esc): pause like Esc in the game
            const shown = this.screen;
            if (!this.mouseLocked && shown instanceof Game && !shown.over)
                shown.pause();
        });

        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    /** Loads res/, then shows the main menu and runs the game. */
    async start(): Promise<void> {
        let share = 0;
        let loading = true;
        const progress = () => {
            this.drawLoading(share);
            if (loading) requestAnimationFrame(progress);
        };
        progress();
        try {
            await Res.preload(Audio.context, (s) => {
                share = s;
            });
        } catch (e) {
            loading = false;
            this.drawLoading(share, String(e));
            throw e;
        }
        loading = false;
        Lang.load();
        this.ship = new Ship(this.scene, this.lights);
        this.showMenu();
        this.last = performance.now();
        this.renderer.setAnimationLoop((now) => this.frame(now));
    }

    private drawLoading(share: number, error?: string): void {
        const ctx = this.ctx;
        ctx.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
        ctx.clearRect(0, 0, Ui.WIDTH, Ui.HEIGHT);
        ctx.fillStyle = "#2af0ff";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(error ?? "HULL BREACH", Ui.WIDTH / 2, Ui.HEIGHT / 2 - 16);
        ctx.strokeStyle = "#2af0ff";
        ctx.strokeRect(Ui.WIDTH / 2 - 150, Ui.HEIGHT / 2, 300, 10);
        ctx.fillRect(Ui.WIDTH / 2 - 150, Ui.HEIGHT / 2, 300 * share, 10);
    }

    /** Fits the 16:9 stage into the window, centered, with black bars. */
    private resize(): void {
        const scale = Math.min(
            window.innerWidth / Ui.WIDTH,
            window.innerHeight / Ui.HEIGHT,
        );
        const w = Math.max(1, Math.round(Ui.WIDTH * scale));
        const h = Math.max(1, Math.round(Ui.HEIGHT * scale));
        Object.assign(this.stage.style, {
            width: `${w}px`,
            height: `${h}px`,
            left: `${Math.round((window.innerWidth - w) / 2)}px`,
            top: `${Math.round((window.innerHeight - h) / 2)}px`,
        });
        const dpr = window.devicePixelRatio || 1;
        // phones have 3x screens and small GPUs: the views at most at the
        // quality's pixel ratios
        this.renderer.setPixelRatio(Math.min(dpr, this.quality.pixelRatio));
        this.renderer.setSize(w, h, false);
        const hudRatio = Math.min(dpr, this.quality.hudRatio);
        this.hud.width = Math.round(w * hudRatio);
        this.hud.height = Math.round(h * hudRatio);
        this.hudScale = this.hud.width / Ui.WIDTH;
    }

    /** Switches to the low quality, on a device too slow for the high one. */
    private lowerQuality(): void {
        if (this.quality === LOW) return;
        this.quality = LOW;
        this.lights.setLimit(LOW.lights);
        this.resize();
    }

    private setScreen(next: Screen): void {
        if (this.screen) {
            if (this.screen !== this.game) this.screen.dispose();
        }
        this.screen = next;
        next.show();
    }

    showMenu(message?: string): void {
        this.setScreen(new Menu(this, message));
    }

    /** Resume the game in progress, or start a new one. */
    play(): void {
        if (this.input.touchMode) this.fullscreen();
        this.game ??= new Game(this);
        this.setScreen(this.game);
    }

    /**
     * On a phone or tablet, the whole screen, turned sideways where the
     * browser allows it (not on iPhones, which play in the page).
     */
    private fullscreen(): void {
        // Safari before 16.4, and on the iPad, only knows the webkit names;
        // the iPhone has no fullscreen for pages at all
        const root = document.documentElement as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | undefined;
        };
        const doc = document as Document & {
            webkitFullscreenElement?: Element | null;
        };
        if (document.fullscreenElement || doc.webkitFullscreenElement) return;
        let request: Promise<void> | undefined;
        try {
            if (root.requestFullscreen)
                request = root.requestFullscreen({ navigationUI: "hide" });
            else request = root.webkitRequestFullscreen?.();
        } catch {
            return;
        }
        if (!(request instanceof Promise)) return;
        request
            .then(() => {
                const orientation = screen.orientation as ScreenOrientation & {
                    lock?: (o: string) => Promise<void>;
                };
                return orientation.lock?.("landscape");
            })
            .catch(() => {
                // not allowed: the game stays in the page
            });
    }

    /** Returns false when there is no game in progress to save. */
    save(): boolean {
        if (!this.game) return false;
        try {
            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(this.game.getState()),
            );
        } catch {
            return false;
        }
        return true;
    }

    /** Returns false when there is no saved game. */
    load(): boolean {
        let state: SaveData | null = null;
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) state = JSON.parse(saved) as SaveData;
        } catch {
            state = null;
        }
        if (!state) return false;
        this.game?.dispose();
        this.game = new Game(this, state);
        this.setScreen(this.game);
        return true;
    }

    get mouseLocked(): boolean {
        return document.pointerLockElement === this.hud;
    }

    /**
     * Captures the mouse for looking around (relative mouse mode):
     * its moves go to onMove. Browsers allow it only right after a click
     * or a key, and not just after Esc let it go; then a click into the
     * view takes it (see Game).
     */
    lockMouse(onMove: (dx: number, dy: number) => void): void {
        this.onMouseMove = onMove;
        this.hud.style.cursor = "none";
        if (this.mouseLocked) return;
        try {
            const request = this.hud.requestPointerLock() as unknown;
            if (request instanceof Promise) request.catch(() => {});
        } catch {
            // not allowed now: a click into the view will take it
        }
    }

    /** Gives the mouse back (absolute mouse mode). */
    freeMouse(): void {
        this.onMouseMove = null;
        this.hud.style.cursor = "";
        if (this.mouseLocked) document.exitPointerLock();
    }

    private frame(now: number): void {
        const real = Math.max((now - this.last) / 1000, 0);
        this.last = now;
        if (!this.screen) return;
        // a long frame (a slow phone) is played in steps short enough that
        // nothing passes through a wall, so the game keeps its speed
        const dt = Math.min(real, MAX_FRAME);
        const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
        for (let i = 0; i < steps; i++) {
            this.screen.update(dt / steps);
            // presses, clicks and finger moves count in the first step only
            this.input.endFrame();
        }
        if (this.screen instanceof Game && this.meter.slow(real))
            this.lowerQuality();

        this.lights.update(this.camera.position);
        this.renderer.render(this.scene, this.camera);

        const ctx = this.ctx;
        ctx.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
        ctx.clearRect(0, 0, Ui.WIDTH, Ui.HEIGHT);
        ctx.imageSmoothingEnabled = true;
        this.screen?.draw(ctx);
    }
}
