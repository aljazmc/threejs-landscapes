import * as Res from "./res";

const MUSIC_VOLUME = 0.45;
/** Seconds. */
const FADE = 0.8;
/** m, at which a sound has faded away. */
const HEARING = 30;

interface Channel {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

/**
 * Sound effects and music (res/elven-*.wav and .ogg, written by
 * fluidsynth-scripts/): effects play once and may overlap; sounds far from
 * the elf are quieter. One piece of music plays at a time, looping or once,
 * and fades into the next.
 *
 * Browsers start audio only after the page was clicked, touched or a key
 * pressed, so the context is resumed then (see Main).
 */
export class Audio {
    static readonly context = new AudioContext();
    static musicName: string | null = null;
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used via the class name
    private static music: Channel | null = null;

    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used via the class name
    private static start(
        name: string,
        volume: number,
        loop: boolean,
    ): Channel | null {
        if (!Res.hasSound(name)) return null;
        const ctx = Audio.context;
        const source = ctx.createBufferSource();
        source.buffer = Res.sound(name);
        source.loop = loop;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(ctx.destination);
        source.start();
        return { source, gain };
    }

    /** Plays the effect res/elven-name.wav once; volume is linear, 1 is full. */
    static play(name: string, volume = 1): void {
        if (volume > 0.01) Audio.start(name, volume, false);
    }

    /** Plays an effect heard from distance meters away. */
    static playAt(name: string, distance: number, volume = 1): void {
        const near = Math.max(0, 1 - distance / HEARING);
        Audio.play(name, volume * near * near);
    }

    /**
     * Fades the music over to res/elven-name.ogg, looping unless once; the
     * same music keeps playing.
     */
    static playMusic(name: string, once = false): void {
        if (name === Audio.musicName) return;
        Audio.musicName = name;
        const now = Audio.context.currentTime;
        const old = Audio.music;
        if (old) {
            const g = old.gain.gain;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.linearRampToValueAtTime(0, now + FADE);
            old.source.stop(now + FADE);
            Audio.music = null;
        }
        const music = Audio.start(name, 0, !once);
        if (!music) return;
        const g = music.gain.gain;
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(MUSIC_VOLUME, now + (once ? 0.05 : FADE));
        Audio.music = music;
    }
}
