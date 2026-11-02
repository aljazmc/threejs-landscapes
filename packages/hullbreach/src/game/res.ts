import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * The files of src/res (copied next to the page, into res/), all loaded
 * before the game starts.
 */

const BASE = "res/";

const MODELS = [
    "arachnid",
    "brute",
    "bunk",
    "chair",
    "console",
    "crawler",
    "cyclops",
    "ghoul",
    "grenade",
    "helm",
    "holotable",
    "laser",
    "launcher",
    "locker",
    "mantis",
    "pipes",
    "piston",
    "pod",
    "rack",
    "raptor",
    "reactor",
    "scanner",
    "scorpion",
    "squid",
    "stalker",
    "terminal",
    "turbine",
];

const IMAGES = [
    "button",
    "crosshair",
    "explosion",
    "flags",
    "flare",
    "font",
    "icons",
    "tiles",
    "title",
];

const SOUNDS = [
    "claw.wav",
    "click.wav",
    "explosion.wav",
    "hurt.wav",
    "laser.wav",
    "launch.wav",
    "screech.wav",
    "splat.wav",
    "step.wav",
    "combat.ogg",
    "defeat.ogg",
    "theme.ogg",
    "victory.ogg",
];

const TEXTS = ["map.txt", "font.fnt"];

const models = new Map<string, THREE.Group>();
const images = new Map<string, HTMLImageElement>();
const sounds = new Map<string, AudioBuffer>();
const texts = new Map<string, string>();

function get<T>(map: Map<string, T>, name: string): T {
    const value = map.get(name);
    if (value === undefined) throw new Error(`hullbreach: no ${name} in res/`);
    return value;
}

/** The scene of res/shooter-<name>.glb, to be cloned. */
export function model(name: string): THREE.Group {
    return get(models, name);
}

/** res/shooter-<name>.png. */
export function image(name: string): HTMLImageElement {
    return get(images, name);
}

/** res/shooter-<name>.wav or .ogg, by its name without the extension. */
export function sound(name: string): AudioBuffer {
    return get(sounds, name);
}

/** res/shooter-<file>, a text file. */
export function text(file: string): string {
    return get(texts, file);
}

async function fetchOk(url: string): Promise<Response> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`hullbreach: ${url}: ${response.status}`);
    return response;
}

/**
 * Loads everything, telling the share done (0 to 1) after each file. A
 * sound the browser can't decode stays silent instead of stopping the game.
 */
export async function preload(
    audio: BaseAudioContext,
    progress: (share: number) => void,
): Promise<void> {
    const total = MODELS.length + IMAGES.length + SOUNDS.length + TEXTS.length;
    let done = 0;
    const tick = () => progress(++done / total);
    const loader = new GLTFLoader();

    const jobs: Promise<void>[] = [
        ...MODELS.map(async (name) => {
            const gltf = await loader.loadAsync(`${BASE}shooter-${name}.glb`);
            models.set(name, gltf.scene);
            tick();
        }),
        ...IMAGES.map(async (name) => {
            const img = new Image();
            img.src = `${BASE}shooter-${name}.png`;
            await img.decode();
            images.set(name, img);
            tick();
        }),
        ...SOUNDS.map(async (file) => {
            try {
                const response = await fetchOk(`${BASE}shooter-${file}`);
                const data = await response.arrayBuffer();
                const buffer = await audio.decodeAudioData(data);
                sounds.set(file.replace(/\.[a-z]+$/, ""), buffer);
            } catch (e) {
                console.warn(`hullbreach: ${file} stays silent`, e);
            }
            tick();
        }),
        ...TEXTS.map(async (file) => {
            const response = await fetchOk(`${BASE}shooter-${file}`);
            texts.set(file, await response.text());
            tick();
        }),
    ];
    await Promise.all(jobs);
}

/** Whether a sound was loaded (see preload). */
export function hasSound(name: string): boolean {
    return sounds.has(name);
}
