import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * The files of src/res (copied next to the page, into res/), all loaded
 * before the game starts.
 */

const BASE = "res/";

/** The props and weapons (the creatures are listed in monster.ts's KINDS). */
const PROPS = [
    "bed",
    "wardrobe",
    "dresser",
    "organ",
    "chair",
    "table",
    "piano",
    "bookcase",
    "armor",
    "altar",
    "tomb",
    "gargoyle",
    "candles",
    "coffin",
    "revolver",
    "flamethrower",
];

const CREATURES = [
    "vampire",
    "bride",
    "nosferatu",
    "ghoul",
    "zombie",
    "werewolf",
    "bat",
    "rat",
    "hunchback",
    "fiend",
];

const IMAGES = [
    "title",
    "button",
    "flags",
    "crosshair",
    "icons",
    "flare",
    "fire",
    "tiles",
];

const SOUNDS = [
    "revolver",
    "ignite",
    "flame",
    "dry",
    "splat",
    "shriek",
    "claw",
    "hurt",
    "step",
    "click",
    "theme",
    "combat",
    "victory",
    "defeat",
];

/** The font of every text, which has the Polish and Slovenian letters. */
export const FONT = "DejaVu Sans";

const models = new Map<string, THREE.Group>();
const images = new Map<string, HTMLImageElement>();
const sounds = new Map<string, AudioBuffer>();
let map = "";

function get<T>(from: Map<string, T>, name: string): T {
    const value = from.get(name);
    if (value === undefined) throw new Error(`bloodmoon: no ${name} in res/`);
    return value;
}

/** The scene of res/gothic-<name>.glb, to be cloned. */
export function model(name: string): THREE.Group {
    return get(models, name);
}

/** res/gothic-<name>.png. */
export function image(name: string): HTMLImageElement {
    return get(images, name);
}

/** res/gothic-<name>.ogg. */
export function sound(name: string): AudioBuffer {
    return get(sounds, name);
}

/** Whether a sound was loaded (see preload). */
export function hasSound(name: string): boolean {
    return sounds.has(name);
}

/** res/gothic-map.txt. */
export function mapText(): string {
    return map;
}

async function fetchOk(url: string): Promise<Response> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`bloodmoon: ${url}: ${response.status}`);
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
    const total =
        PROPS.length + CREATURES.length + IMAGES.length + SOUNDS.length + 2;
    let done = 0;
    const tick = () => progress(++done / total);
    const loader = new GLTFLoader();
    await Promise.all([
        ...[...PROPS, ...CREATURES].map(async (name) => {
            const gltf = await loader.loadAsync(`${BASE}gothic-${name}.glb`);
            models.set(name, gltf.scene);
            tick();
        }),
        ...IMAGES.map(async (name) => {
            const img = new Image();
            img.src = `${BASE}gothic-${name}.png`;
            await img.decode();
            images.set(name, img);
            tick();
        }),
        ...SOUNDS.map(async (name) => {
            try {
                const response = await fetchOk(`${BASE}gothic-${name}.ogg`);
                const data = await response.arrayBuffer();
                sounds.set(name, await audio.decodeAudioData(data));
            } catch (e) {
                console.warn(`bloodmoon: ${name}.ogg stays silent`, e);
            }
            tick();
        }),
        (async () => {
            map = await (await fetchOk(`${BASE}gothic-map.txt`)).text();
            tick();
        })(),
        (async () => {
            const font = new FontFace(FONT, `url(${BASE}DejaVuSans.ttf)`);
            document.fonts.add(await font.load());
            tick();
        })(),
    ]);
}
