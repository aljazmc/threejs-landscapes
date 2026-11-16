import * as THREE from "three";
import { banned } from "./map";
import { extent, FALLBACK, MODELS, SKULL, type Wire, wire } from "./models";

// how many pixels high an icon stands at least, however far it is
export const ICON_PIXELS = 30;
// radians a second the icons turn round
const SPIN = 0.35;

export interface IconPlace {
    at: THREE.Vector3;
    icon: string;
    /** Landmarks glow brighter. */
    bright: boolean;
    /**
     * The last day (yyyy-mm-dd) of a ban on employing foreigners: until
     * then, the icon turns into a skull and back now and again.
     */
    ban?: string | undefined;
}

/**
 * The icons of all the places on the map as slowly turning 3D wireframe
 * models (see models.ts), one draw call for each model, brightness and
 * whether it turns into a skull, standing on the ground; any place can be
 * hidden, to keep icons from crowding. A skull stops when its ban ends,
 * even with the map open.
 */
export class Icons {
    readonly group = new THREE.Group();
    /** Where each place's icon is: its wire and its copy there. */
    private readonly slots: { wire: Wire; index: number }[] = [];
    /** How tall each place's model is, and its largest size. */
    private readonly sizes: { height: number; size: number }[] = [];
    private readonly visible: Uint8Array;
    /** The places still turning into skulls, with the end of their ban. */
    private skulls: { place: number; until: string }[] = [];
    /** When to look again whether a ban has ended (performance.now). */
    private nextCheck = 0;

    constructor(
        places: IconPlace[],
        colors: { bright: string; dim: string },
        order: number,
    ) {
        const kinds = new Map<string, number[]>();
        places.forEach(({ icon, bright, ban }, k) => {
            const skull = banned(ban);
            if (skull) {
                this.skulls.push({ place: k, until: ban! });
            }
            const key = `${icon}|${bright ? 1 : 0}|${skull ? 1 : 0}`;
            kinds.set(key, [...(kinds.get(key) ?? []), k]);
        });
        for (const [key, members] of kinds) {
            const [icon = "", bright, skull] = key.split("|");
            const lines = MODELS[icon] ?? FALLBACK;
            const made = wire(lines, members.length, {
                color: bright === "1" ? colors.bright : colors.dim,
                pixels: ICON_PIXELS,
                spin: SPIN,
                // dim from afar, yet still there to find the places by
                fade: { near: 1000, far: 6000, floor: 0.25 },
                ...(skull === "1" ? { morph: SKULL } : {}),
            });
            made.object.renderOrder = order;
            const size = extent(lines);
            if (skull === "1") {
                size.size = Math.max(size.size, extent(SKULL).size);
            }
            members.forEach((place, index) => {
                const at = places[place]!.at;
                made.offsets.setXYZ(index, at.x, at.y, at.z);
                // each turned its own way
                made.headings.setX(index, (place * 2.4) % (Math.PI * 2));
                this.slots[place] = { wire: made, index };
                this.sizes[place] = size;
            });
            this.group.add(made.object);
        }
        this.visible = new Uint8Array(places.length).fill(1);
    }

    /**
     * Stops the skulls of the bans that have ended; cheap to call every
     * frame, it looks only once a minute.
     */
    expire(now = performance.now()) {
        if (now < this.nextCheck || this.skulls.length === 0) {
            return;
        }
        this.nextCheck = now + 60_000;
        this.skulls = this.skulls.filter(({ place, until }) => {
            if (banned(until)) {
                return true;
            }
            const slot = this.slots[place]!;
            slot.wire.morphs.setX(slot.index, 0);
            slot.wire.morphs.needsUpdate = true;
            return false;
        });
    }

    /** Shows or hides the icon of a place. */
    show(index: number, shown: boolean) {
        const value = shown ? 1 : 0;
        const slot = this.slots[index];
        if (slot && this.visible[index] !== value) {
            this.visible[index] = value;
            slot.wire.alphas.setX(slot.index, value);
            slot.wire.alphas.needsUpdate = true;
        }
    }

    /**
     * How many pixels wide and high a place's icon shows at a distance,
     * given the meters a pixel spans at a meter (as the shader scales it).
     */
    pixels(index: number, distance: number, perPixel: number) {
        const { height, size } = this.sizes[index] ?? { height: 1, size: 1 };
        const across = Math.max(ICON_PIXELS, size / (distance * perPixel));
        return { width: across, height: (across * height) / size };
    }
}
