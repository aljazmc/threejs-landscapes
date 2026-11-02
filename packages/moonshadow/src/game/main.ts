import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Audio } from "./audio";
import { Castle, srgb } from "./castle";
import { Game } from "./game";
import { Input } from "./input";
import { Lang } from "./lang";
import { LightPool } from "./lights";
import { Menu } from "./menu";
import { Play } from "./play";
import * as Res from "./res";
import * as Ui from "./ui";
import { View } from "./view";

/** Where the paused game is saved. */
const SAVE_KEY = "moonshadow.savegame";

/**
 * The fog is exponential, exp(-density d); three.js' FogExp2 squares
 * it, so the shader is made to leave the square out.
 */
function patchFog(): void {
    const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
    const squared = "exp( - fogDensity * fogDensity * vFogDepth * vFogDepth )";
    const chunk = chunks.fog_fragment ?? "";
    if (chunk.includes(squared))
        chunks.fog_fragment = chunk.replace(
            squared,
            "exp( - fogDensity * vFogDepth )",
        );
    else console.warn("moonshadow: the fog keeps three.js' falloff");
}

/**
 * A procedural night sky: dark blue above, a pale horizon and the
 * brown ground below, as a sphere for PMREMGenerator to look at.
 */
function nightSky(): THREE.Scene {
    const top = srgb(0.05, 0.08, 0.2);
    const horizon = srgb(0.35, 0.4, 0.55);
    const groundHorizon = srgb(0.35, 0.3, 0.25);
    const bottom = srgb(0.1, 0.07, 0.05);
    const geometry = new THREE.SphereGeometry(10, 32, 16);
    const positions = geometry.getAttribute("position");
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i) / 10;
        if (y >= 0) c.lerpColors(horizon, top, y ** 0.4);
        else c.lerpColors(groundHorizon, bottom, (-y) ** 0.4);
        colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Scene();
    sky.add(
        new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.BackSide,
            }),
        ),
    );
    return sky;
}

/**
 * The app: the 960x540 view of the game letterboxed in the window, the
 * keep drawn in 3D behind every screen and the screen switching, saving and
 * loading.
 */
export class Main {
    /** The game in progress, kept while the main menu is shown. */
    game: Game | null = null;
    castle!: Castle;
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
        70,
        Ui.WIDTH / Ui.HEIGHT,
        0.05,
        150,
    );
    readonly lights: LightPool;
    readonly input: Input;
    private view!: View;
    private screen: Menu | Play | null = null;

    private readonly stage = document.createElement("div");
    private readonly renderer: THREE.WebGLRenderer;
    private readonly composer: EffectComposer;
    private readonly bloom: UnrealBloomPass;
    private readonly hud = document.createElement("canvas");
    private readonly ctx: CanvasRenderingContext2D;
    private hudScale = 1;
    private last = 0;
    private elapsed = 0;
    private onMouseMove: ((dx: number, dy: number) => void) | null = null;

    constructor(root: HTMLElement) {
        patchFog();
        this.stage.className = "stage";
        root.appendChild(this.stage);
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setClearColor(srgb(0.02, 0.03, 0.06));
        // ACES at an exposure of 0.9, biased by 1.8, and by 1 / 0.6 for
        // three.js' ACES
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9 * 1.8 * 0.6;
        this.renderer = renderer;
        this.stage.appendChild(renderer.domElement);
        this.hud.className = "hud";
        this.stage.appendChild(this.hud);
        this.ctx = this.hud.getContext("2d")!;

        // glow (bloom) above an HDR threshold of 1.2, so only the brightly
        // emissive runes, flames and explosions bloom, before the tone mapping
        const target = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
            samples: 4,
        });
        this.composer = new EffectComposer(renderer, target);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(
            new THREE.Vector2(1, 1),
            0.3,
            0.05,
            1.2,
        );
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());

        // a thin blue fog, ambient light, and a night sky only for the gold
        // and silver to reflect (three.js lights with it a little too)
        this.scene.fog = new THREE.FogExp2(srgb(0.12, 0.15, 0.25), 0.012);
        this.scene.add(
            new THREE.AmbientLight(srgb(0.45, 0.55, 0.8), 0.3 * Math.PI),
        );
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.scene.environment = pmrem.fromScene(nightSky()).texture;
        this.scene.environmentIntensity = 0.5;
        pmrem.dispose();

        this.lights = new LightPool(this.scene);
        this.input = new Input(this.hud, (cx, cy) => {
            const r = this.hud.getBoundingClientRect();
            return {
                x: ((cx - r.left) / r.width) * Ui.WIDTH,
                y: ((cy - r.top) / r.height) * Ui.HEIGHT,
            };
        });
        // browsers play sound only once the page was used (Safari on iOS
        // only on the end of a touch)
        const resume = () => {
            if (Audio.context.state !== "running") void Audio.context.resume();
        };
        for (const event of ["pointerdown", "pointerup", "touchend", "keydown"])
            window.addEventListener(event, resume);

        document.addEventListener("mousemove", (e) => {
            if (this.mouseLocked && this.onMouseMove)
                this.onMouseMove(e.movementX, e.movementY);
        });
        document.addEventListener("pointerlockchange", () => {
            // the browser let the mouse go (Esc): pause like Esc in the game
            if (
                !this.mouseLocked &&
                this.screen instanceof Play &&
                this.game?.result === null
            )
                this.pause();
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
        const anisotropy = Math.min(
            8,
            this.renderer.capabilities.getMaxAnisotropy(),
        );
        this.castle = new Castle(this.scene, this.lights, anisotropy);
        this.view = new View(this.scene, this.camera, this.lights);
        this.showMenu(null);
        this.last = performance.now();
        this.renderer.setAnimationLoop((now) => this.frame(now));
    }

    private drawLoading(share: number, error?: string): void {
        const ctx = this.ctx;
        ctx.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
        ctx.clearRect(0, 0, Ui.WIDTH, Ui.HEIGHT);
        ctx.fillStyle = "#ffcc59";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
            error ?? "MOONSHADOW KEEP",
            Ui.WIDTH / 2,
            Ui.HEIGHT / 2 - 16,
        );
        ctx.strokeStyle = "#ffcc59";
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
        // phones have 3x screens and small GPUs: the 3D view at most 2x
        const ratio = Math.min(dpr, 2);
        this.renderer.setPixelRatio(ratio);
        this.renderer.setSize(w, h, false);
        this.composer.setPixelRatio(ratio);
        this.composer.setSize(w, h);
        this.hud.width = Math.round(w * dpr);
        this.hud.height = Math.round(h * dpr);
        this.hudScale = this.hud.width / Ui.WIDTH;
    }

    // --- screens --------------------------------------------------------

    private showMenu(message: string | null): void {
        this.freeMouse();
        this.screen = new Menu(this, message);
    }

    /** Resume the game in progress, or start a new one. */
    play(): void {
        if (this.input.touchMode) this.fullscreen();
        if (!this.game || this.game.result !== null)
            this.game = Game.create(this.castle);
        this.screen = new Play(this, this.game);
    }

    /** Esc, the pause button, or the browser let the mouse go. */
    pause(): void {
        this.showMenu("Paused. Play continues the fight.");
    }

    /** After the end of a game: back to the menu, without it. */
    endGame(): void {
        this.game = null;
        this.showMenu(null);
    }

    /** Returns false when there is no game in progress to save. */
    save(): boolean {
        if (!this.game || this.game.result !== null) return false;
        try {
            localStorage.setItem(SAVE_KEY, this.game.saveString());
        } catch {
            return false;
        }
        return true;
    }

    /** Returns false when there is no saved game. */
    load(): boolean {
        let game: Game | null = null;
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) game = Game.fromSaveString(saved);
        } catch {
            game = null;
        }
        if (!game) return false;
        this.game = game;
        this.screen = new Play(this, game);
        return true;
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

    // --- the mouse ------------------------------------------------------

    get mouseLocked(): boolean {
        return document.pointerLockElement === this.hud;
    }

    /**
     * Captures the mouse for looking around: its moves go to onMove.
     * Browsers allow it only right after a click or a key, and not just
     * after Esc let it go; then a click into the view takes it (see Play).
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

    /** Gives the mouse back. */
    freeMouse(): void {
        this.onMouseMove = null;
        this.hud.style.cursor = "";
        if (this.mouseLocked) document.exitPointerLock();
    }

    // --- the frame ------------------------------------------------------

    private frame(now: number): void {
        // a stalled frame mustn't push anyone through a wall
        const dt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 30);
        this.last = now;
        this.elapsed += dt;
        const screen = this.screen;
        if (screen instanceof Play) screen.update(dt, this.castle);
        else screen?.update();
        this.input.endFrame();

        // the game's effects go on behind the menu
        const game = this.game;
        if (game && !(screen instanceof Play)) game.fx.update(dt);
        // the game's sounds and music
        if (game) {
            for (const [name, volume] of game.sounds) Audio.play(name, volume);
            game.sounds = [];
            if (game.music) Audio.playMusic(game.music.name, game.music.once);
            game.music = null;
        }

        this.castle.animate(dt, this.elapsed);
        this.view.update(game, this.elapsed);
        this.lights.update(this.camera.position);
        this.composer.render(dt);

        const ctx = this.ctx;
        ctx.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
        ctx.clearRect(0, 0, Ui.WIDTH, Ui.HEIGHT);
        ctx.imageSmoothingEnabled = true;
        if (this.screen instanceof Play) this.screen.draw(ctx, this.castle);
        else this.screen?.draw(ctx);
    }
}
