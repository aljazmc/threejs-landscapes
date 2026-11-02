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
    "headshot",
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

/** res/gothic-<name>.ogg (or .mp3 or .wav, see soundFiles). */
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

/** The music; the other sounds are effects. */
const MUSIC = new Set(["theme", "combat", "victory", "defeat"]);

/**
 * The files to try for a sound, best first: each is written as .ogg, and
 * for Safari, which decodes no Ogg Vorbis, the music as .mp3 and the
 * effects as .wav (an MP3 would start them a little late).
 */
function soundFiles(name: string): string[] {
    const other = `${name}.${MUSIC.has(name) ? "mp3" : "wav"}`;
    const ogg = document
        .createElement("audio")
        .canPlayType('audio/ogg; codecs="vorbis"');
    return ogg ? [`${name}.ogg`, other] : [other];
}

/** Fetches and decodes the first of the files the browser can play. */
async function decodeSound(
    audio: BaseAudioContext,
    files: string[],
): Promise<AudioBuffer> {
    let error: unknown = null;
    for (const file of files) {
        try {
            const response = await fetchOk(`${BASE}gothic-${file}`);
            return await audio.decodeAudioData(await response.arrayBuffer());
        } catch (e) {
            error = e;
        }
    }
    throw error;
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
                sounds.set(name, await decodeSound(audio, soundFiles(name)));
            } catch (e) {
                console.warn(`bloodmoon: ${name} stays silent`, e);
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
