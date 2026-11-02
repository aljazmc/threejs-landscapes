import * as THREE from "three";

/**
 * A light of the keep, in three.js coordinates: an omni light fading as
 * d^-attenuation, cut off smoothly at its range, as three.js' point
 * lights do with that decay and distance. The energy is scaled by π
 * (three.js' Lambert divides by π).
 */
export interface Light {
    position: THREE.Vector3;
    /** Linear RGB. */
    color: THREE.Color;
    energy: number;
    range: number;
    attenuation: number;
}

const scored: { light: Light; score: number }[] = [];

/**
 * The keep has some 50 lights. three.js lights every pixel with every
 * light, so a fixed pool of point lights is given each frame to the
 * lights that shine brightest at the camera.
 */
export class LightPool {
    static readonly SIZE = 16;

    readonly sources = new Set<Light>();
    private readonly lights: THREE.PointLight[] = [];

    constructor(parent: THREE.Object3D) {
        for (let i = 0; i < LightPool.SIZE; i++) {
            const light = new THREE.PointLight(0x000000, 0, 1, 1);
            parent.add(light);
            this.lights.push(light);
        }
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
            if (light.energy <= 0) continue;
            const d = light.position.distanceTo(eye);
            // lights whose reach is far from the eye light nothing it sees well
            const beyond = Math.max(0, d - light.range);
            scored.push({
                light,
                score: light.energy / (1 + d * d) / (1 + beyond),
            });
        }
        scored.sort((a, b) => b.score - a.score);
        this.lights.forEach((target, i) => {
            const source = scored[i]?.light;
            if (!source) {
                target.intensity = 0;
                return;
            }
            target.position.copy(source.position);
            target.color.copy(source.color);
            target.intensity = source.energy * Math.PI;
            target.distance = source.range;
            target.decay = source.attenuation;
        });
    }
}
