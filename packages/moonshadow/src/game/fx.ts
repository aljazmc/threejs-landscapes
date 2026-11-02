import * as THREE from "three";

/**
 * Short-lived things drawn in the keep: glow sprites (res/elven-flare.png),
 * the explosive arrow's blast (res/elven-explosion.png) with its embers,
 * smoke and light, and flashes of light. They are part of the game; the
 * view draws them. All positions are map coordinates.
 */

export const Flare = {
    /** The sword's spark where it bites. */
    Slash: 0,
    /** Moon runes sparking from a hit. */
    Rune: 1,
    /** The burning arrow and the blast's sparks. */
    Ember: 2,
    /** Monster blood from a hit. */
    Blood: 3,
    Smoke: 4,
} as const;
export type FlareKind = (typeof Flare)[keyof typeof Flare];

/** Its fireball about 3.5 m across, as wide as the gallery. */
const EXPLOSION_SIZE = 5;
const EXPLOSION_TIME = 1.3;

export interface Item {
    /** A flare, or null for a fireball of the blast. */
    flare: FlareKind | null;
    at: THREE.Vector3;
    velocity: THREE.Vector3;
    gravity: number;
    size: number;
    grow: number;
    age: number;
    life: number;
    /** Fades out as it ages (the fireballs don't: their frames do). */
    fade: boolean;
    /** A fireball: drawn this much nearer to the camera than its place. */
    pull: number;
    /** A fireball: seconds before it shows. */
    delay: number;
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

    private item(
        flare: FlareKind | null,
        at: THREE.Vector3,
        size: number,
        life: number,
    ): Item {
        const item: Item = {
            flare,
            at: at.clone(),
            velocity: new THREE.Vector3(),
            gravity: 0,
            size,
            grow: 0,
            age: 0,
            life,
            fade: true,
            pull: 0,
            delay: 0,
        };
        this.items.push(item);
        return item;
    }

    add(flare: FlareKind, at: THREE.Vector3, size: number, life: number): Item {
        return this.item(flare, at, size, life);
    }

    light(
        at: THREE.Vector3,
        color: THREE.Color,
        energy: number,
        life: number,
        range = 10,
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

    /** Blood and rune sparks bursting from a hit monster. */
    splash(at: THREE.Vector3, amount: number): void {
        this.add(Flare.Rune, at, 0.5, 0.15).grow = 1;
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

    /** The explosive arrow's blast: fireballs, embers, rolling smoke and a bright flash. */
    explode(at: THREE.Vector3): void {
        for (let i = 0; i < 3; i++) {
            // a big fireball with two smaller ones swelling a bit later beside it
            const a = Math.random() * Math.PI * 2;
            const off = i === 0 ? 0 : 0.7;
            const fire = this.item(
                null,
                at
                    .clone()
                    .add(
                        new THREE.Vector3(
                            Math.cos(a) * off,
                            Math.sin(a) * off,
                            0.6 + i * 0.3,
                        ),
                    ),
                EXPLOSION_SIZE * (i === 0 ? 1 : 0.6),
                EXPLOSION_TIME,
            );
            fire.fade = false;
            fire.pull = 1.5 - i * 0.3;
            fire.delay = i * 0.08;
        }
        this.add(Flare.Ember, at, 6, 0.25).grow = 2;
        for (let i = 0; i < 28; i++) {
            const s = this.add(
                i % 3 === 0 ? Flare.Rune : Flare.Ember,
                at,
                0.3 + Math.random() * 0.4,
                0.5 + Math.random() * 0.6,
            );
            const a = Math.random() * Math.PI * 2;
            const up = Math.random();
            const speed = 6 + Math.random() * 10;
            s.velocity.set(
                Math.cos(a) * speed * (1 - up * 0.5),
                Math.sin(a) * speed * (1 - up * 0.5),
                up * speed,
            );
            s.gravity = 12;
        }
        for (let i = 0; i < 10; i++) {
            const s = this.add(
                Flare.Smoke,
                at
                    .clone()
                    .add(
                        new THREE.Vector3(
                            Math.random() - 0.5,
                            Math.random() - 0.5,
                            0.5,
                        ),
                    ),
                1.5 + Math.random() * 1.5,
                2 + Math.random() * 1.5,
            );
            s.velocity.set(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                0.4 + Math.random() * 0.6,
            );
            s.grow = 0.8;
        }
        this.light(
            at.clone().add(new THREE.Vector3(0, 0, 1)),
            new THREE.Color().setRGB(1, 0.6, 0.25, THREE.SRGBColorSpace),
            9,
            1.0,
            18,
        );
    }

    update(dt: number): void {
        this.items = this.items.filter((it) => {
            it.age += dt;
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
