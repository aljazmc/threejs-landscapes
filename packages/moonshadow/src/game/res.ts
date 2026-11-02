import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * The files of src/res (copied next to the page, into res/), all loaded
 * before the game starts.
 */

const BASE = "res/";

/** The props, the weapons and the arrow (the monsters are listed in monster.ts's KINDS). */
const PROPS = [
    "throne",
    "bench",
    "table",
    "bookcase",
    "brazier",
    "crystal",
    "bed",
    "wardrobe",
    "desk",
    "tree",
    "fountain",
    "statue",
    "vines",
    "well",
    "sword",
    "bow",
    "arrow",
];

const MONSTERS = [
    "orc",
    "goblin",
    "troll",
    "ogre",
    "warg",
    "spider",
    "skeleton",
    "minotaur",
    "wraith",
    "golem",
];

const IMAGES = [
    "title",
    "button",
    "flags",
    "crosshair",
    "icons",
    "flare",
    "explosion",
    "tiles",
];

const SOUNDS = [
    "sword.wav",
    "swish.wav",
    "bow.wav",
    "blast.wav",
    "splat.wav",
    "headshot.wav",
    "roar.wav",
    "strike.wav",
    "hurt.wav",
    "step.wav",
    "click.wav",
    "theme.ogg",
    "combat.ogg",
    "victory.ogg",
    "defeat.ogg",
];

/**
 * The texts are drawn in Open Sans SemiBold; the page asks for it, or a
 * font like it.
 */
export const FONT = `600 SIZEpx "Open Sans", "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif`;

const models = new Map<string, THREE.Group>();
const images = new Map<string, HTMLImageElement>();
const sounds = new Map<string, AudioBuffer>();
let map = "";

function get<T>(from: Map<string, T>, name: string): T {
    const value = from.get(name);
    if (value === undefined) throw new Error(`moonshadow: no ${name} in res/`);
    return value;
}

/** The scene of res/elven-<name>.glb, to be cloned. */
export function model(name: string): THREE.Group {
    return get(models, name);
}

/** res/elven-<name>.png. */
export function image(name: string): HTMLImageElement {
    return get(images, name);
}

/** res/elven-<name>.wav or .ogg, by its name without the extension. */
export function sound(name: string): AudioBuffer {
    return get(sounds, name);
}

/** Whether a sound was loaded (see preload). */
export function hasSound(name: string): boolean {
    return sounds.has(name);
}

/** res/elven-map.txt. */
export function mapText(): string {
    return map;
}

/**
 * The files to try for a sound, best first: music is written as both .ogg
 * and .mp3, as Safari decodes no Ogg Vorbis.
 */
function soundFiles(file: string): string[] {
    if (!file.endsWith(".ogg")) return [file];
    const mp3 = file.replace(/\.ogg$/, ".mp3");
    const ogg = document
        .createElement("audio")
        .canPlayType('audio/ogg; codecs="vorbis"');
    return ogg ? [file, mp3] : [mp3];
}

/** Fetches and decodes the first of the files the browser can play. */
async function decodeSound(
    audio: BaseAudioContext,
    files: string[],
): Promise<AudioBuffer> {
    let error: unknown = null;
    for (const file of files) {
        try {
            const response = await fetchOk(`${BASE}elven-${file}`);
            return await audio.decodeAudioData(await response.arrayBuffer());
        } catch (e) {
            error = e;
        }
    }
    throw error;
}

async function fetchOk(url: string): Promise<Response> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`moonshadow: ${url}: ${response.status}`);
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
        PROPS.length + MONSTERS.length + IMAGES.length + SOUNDS.length + 1;
    let done = 0;
    const tick = () => progress(++done / total);
    const loader = new GLTFLoader();
    await Promise.all([
        ...[...PROPS, ...MONSTERS].map(async (name) => {
            const gltf = await loader.loadAsync(`${BASE}elven-${name}.glb`);
            models.set(name, gltf.scene);
            tick();
        }),
        ...IMAGES.map(async (name) => {
            const img = new Image();
            img.src = `${BASE}elven-${name}.png`;
            await img.decode();
            images.set(name, img);
            tick();
        }),
        ...SOUNDS.map(async (file) => {
            try {
                sounds.set(
                    file.replace(/\.[a-z]+$/, ""),
                    await decodeSound(audio, soundFiles(file)),
                );
            } catch (e) {
                console.warn(`moonshadow: ${file} stays silent`, e);
            }
            tick();
        }),
        (async () => {
            map = await (await fetchOk(`${BASE}elven-map.txt`)).text();
            tick();
        })(),
    ]);
}
