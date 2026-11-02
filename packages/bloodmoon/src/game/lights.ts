import * as THREE from "three";

/** Light intensity (lumens) of a light of energy 1, for the camera's exposure. */
export const LUMENS = 450;

/**
 * A point light of the castle, in three.js coordinates: a physical point
 * light (lumens, a range it fades to), for three.js in candela
 * (lumens / 4π) with a distance it is cut off at.
 */
export interface Light {
    position: THREE.Vector3;
    color: THREE.Color;
    lumens: number;
    range: number;
}

const scored: { light: Light; score: number }[] = [];

/**
 * The castle has some 50 lights. three.js lights every pixel with every
 * light, so a fixed pool of point lights is given each frame to the lights
 * that shine brightest at the camera.
 */
export class LightPool {
    static readonly SIZE = 16;

    readonly sources = new Set<Light>();
    private readonly lights: THREE.PointLight[] = [];
    private limit = LightPool.SIZE;

    constructor(parent: THREE.Object3D) {
        for (let i = 0; i < LightPool.SIZE; i++) {
            const light = new THREE.PointLight(0x000000, 0, 1, 2);
            parent.add(light);
            this.lights.push(light);
        }
    }

    /**
     * Uses only the first n of the point lights. The others are hidden,
     * which three.js leaves out of the shaders (recompiling them once).
     */
    setLimit(n: number): void {
        this.limit = Math.max(0, Math.min(n, LightPool.SIZE));
        this.lights.forEach((light, i) => {
            light.visible = i < this.limit;
        });
    }

    add(light: Light): Light {
        this.sources.add(light);
        return light;
    }

    remove(light: Light): void {
        this.sources.delete(light);
    }

    update(eye: THREE.Vector3): void {
        scored.length = 0;
        for (const light of this.sources) {
            if (light.lumens <= 0) continue;
            const d = light.position.distanceTo(eye);
            // lights whose reach is far from the eye light nothing it sees well
            const beyond = Math.max(0, d - light.range);
            scored.push({
                light,
                score: light.lumens / (1 + d * d) / (1 + beyond),
            });
        }
        scored.sort((a, b) => b.score - a.score);
        this.lights.forEach((target, i) => {
            const source = i < this.limit ? scored[i]?.light : undefined;
            if (!source) {
                target.intensity = 0;
                return;
            }
            target.position.copy(source.position);
            target.color.copy(source.color);
            target.intensity = source.lumens / (4 * Math.PI);
            target.distance = source.range;
        });
    }
}
