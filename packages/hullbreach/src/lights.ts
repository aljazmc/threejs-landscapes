import * as THREE from "three";
import { toThree } from "./space";

/**
 * A point light of the game, which fades as
 * 1 / (constant + linear d + quadratic d^2) with the distance d, without
 * a range. color is already scaled by the light's power.
 */
export interface Light {
    x: number;
    y: number;
    z: number;
    color: THREE.Color;
    constant: number;
    linear: number;
    quadratic: number;
}

const CALL =
    "light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );";

/**
 * Makes three.js point lights fade like the game's ones, as
 * 1 / (1 + decay d + distance d^2): a light's decay holds the linear
 * factor, its distance the quadratic one (both divided by the constant,
 * which goes into the intensity). Run before the first material compiles.
 */
export function patchAttenuation(): void {
    const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
    const chunk = chunks.lights_pars_begin ?? "";
    if (chunk.includes(CALL)) {
        chunks.lights_pars_begin = chunk.replace(
            CALL,
            "light.color /= 1.0 + pointLight.decay * lightDistance + pointLight.distance * lightDistance * lightDistance;",
        );
    } else if (!chunk.includes("pointLight.decay * lightDistance")) {
        console.warn("hullbreach: point lights keep three.js' falloff");
    }
}

const eyeGame = new THREE.Vector3();

/**
 * The ship has some 50 lights. three.js lights every pixel with every
 * light, and recompiles the shaders when their number changes, so a fixed
 * pool of point lights is given each frame to the lights that shine
 * brightest at the camera.
 */
export class LightPool {
    static readonly SIZE = 16;

    readonly sources = new Set<Light>();
    private readonly lights: THREE.PointLight[] = [];

    constructor(parent: THREE.Object3D) {
        for (let i = 0; i < LightPool.SIZE; i++) {
            const light = new THREE.PointLight(0x000000, 0);
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

    /** eye: the camera's place, in three.js. */
    update(eye: THREE.Vector3): void {
        eyeGame.set(eye.x, -eye.y, eye.z);
        const scored: { light: Light; score: number }[] = [];
        for (const light of this.sources) {
            const d = Math.hypot(
                light.x - eyeGame.x,
                light.y - eyeGame.y,
                light.z - eyeGame.z,
            );
            const c = light.color;
            const bright = Math.max(c.r, c.g, c.b);
            if (bright <= 0) continue;
            scored.push({
                light,
                score:
                    bright /
                    (light.constant +
                        light.linear * d +
                        light.quadratic * d * d),
            });
        }
        scored.sort((a, b) => b.score - a.score);
        for (let i = 0; i < this.lights.length; i++) {
            const target = this.lights[i]!;
            const source = scored[i]?.light;
            if (!source) {
                target.intensity = 0;
                continue;
            }
            toThree(source.x, source.y, source.z, target.position);
            target.color.copy(source.color);
            // three's Lambert divides the light by PI, the game's lights do not
            target.intensity = Math.PI / source.constant;
            target.decay = source.linear / source.constant;
            target.distance = source.quadratic / source.constant;
        }
    }
}
