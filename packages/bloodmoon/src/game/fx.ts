import * as THREE from "three";

/**
 * Short-lived things drawn in the castle: glow sprites
 * (res/gothic-flare.png), the flamethrower's fire (res/gothic-fire.png),
 * smoke and blood, and flashes of light. They are part of the game and
 * stand still with it while the menu covers it; the view draws them. All
 * positions are map coordinates.
 */

export const Flare = {
    /** The revolver's muzzle flash. */
    Flash: 0,
    /** A silver bullet striking. */
    Spark: 1,
    /** Sparks of the fire. */
    Ember: 2,
    /** Monster blood from a hit. */
    Blood: 3,
    Smoke: 4,
} as const;
export type FlareKind = (typeof Flare)[keyof typeof Flare];

export interface Item {
    /** A flare, or null for the fire's billow. */
    flare: FlareKind | null;
    at: THREE.Vector3;
    velocity: THREE.Vector3;
    gravity: number;
    /** Slowing down: the share of the velocity lost per second. */
    drag: number;
    size: number;
    grow: number;
    age: number;
    life: number;
}

export interface FxLight {
    at: THREE.Vector3;
    /** Linear RGB. */
    color: THREE.Color;
    energy: number;
    range: number;
    age: number;
    life: number;
}

export class Fx {
    items: Item[] = [];
    lights: FxLight[] = [];

    add(flare: FlareKind, at: THREE.Vector3, size: number, life: number): Item {
        const item: Item = {
            flare,
            at: at.clone(),
            velocity: new THREE.Vector3(),
            gravity: 0,
            drag: 0,
            size,
            grow: 0,
            age: 0,
            life,
        };
        this.items.push(item);
        return item;
    }

    /** A billow of burning fuel flying from the nozzle. */
    fire(at: THREE.Vector3, velocity: THREE.Vector3, life: number): Item {
        const item: Item = {
            flare: null,
            at: at.clone(),
            velocity: velocity.clone(),
            gravity: -1.5,
            drag: 1.2,
            size: 0.35,
            grow: 4,
            age: 0,
            life,
        };
        this.items.push(item);
        return item;
    }

    light(
        at: THREE.Vector3,
        color: THREE.Color,
        energy: number,
        life: number,
        range: number,
    ): void {
        this.lights.push({
            at: at.clone(),
            color,
            energy,
            range,
            age: 0,
            life,
        });
    }

    /** Blood and silver sparks bursting from a hit monster. */
    splash(at: THREE.Vector3, amount: number): void {
        this.add(Flare.Spark, at, 0.5, 0.15).grow = 1;
        for (let i = 0; i < amount; i++) {
            const s = this.add(
                Flare.Blood,
                at,
                0.25 + Math.random() * 0.3,
                0.5 + Math.random() * 0.3,
            );
            s.velocity.set(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                Math.random() * 2.5,
            );
            s.gravity = 9;
        }
    }

    update(dt: number): void {
        this.items = this.items.filter((it) => {
            it.age += dt;
            it.velocity.multiplyScalar(Math.max(1 - it.drag * dt, 0));
            it.velocity.z -= it.gravity * dt;
            it.at.addScaledVector(it.velocity, dt);
            it.at.z = Math.max(it.at.z, 0.05);
            return it.age < it.life;
        });
        this.lights = this.lights.filter((light) => {
            light.age += dt;
            return light.age < light.life;
        });
    }
}
