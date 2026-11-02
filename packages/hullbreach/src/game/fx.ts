import * as THREE from "three";
import type { Light, LightPool } from "../lights";
import { fromThree, toThree, vecToThree } from "../space";
import * as Gfx from "./gfx";

export const Flare = {
    /** The laser hitting something. */
    Impact: 0,
    LaserFlash: 1,
    LauncherFlash: 2,
    /** Alien blood splashing from a hit. */
    Ichor: 3,
    Smoke: 4,
} as const;
export type FlareKind = (typeof Flare)[keyof typeof Flare];

/** Its fireball about 3.5 m across, as wide as the hallway. */
const EXPLOSION_SIZE = 5;
const EXPLOSION_TIME = 1.3;

/** A short-lived thing; x, y, z is its place in the game. */
export interface Item {
    obj?: THREE.Sprite | THREE.Mesh;
    mat?: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
    blend?: Gfx.Blend;
    beam?: boolean;
    light?: Light;
    frames?: THREE.Texture[];
    x: number;
    y: number;
    z: number;
    age: number;
    life: number;
    size: number;
    grow: number;
    spin: number;
    fade: boolean;
    vx: number;
    vy: number;
    vz: number;
    gravity: number;
    base?: THREE.Vector3;
    /** Drawn this much nearer to the camera than its place. */
    pull?: number;
    delay?: number;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const camGame = new THREE.Vector3();
const toCamera = new THREE.Vector3();

/**
 * Short-lived things drawn over the ship: laser beams, glow sprites
 * (res/shooter-flare.png), the grenade's explosion
 * (res/shooter-explosion.png) with its sparks, smoke and light, and
 * flashes of light.
 */
export class Fx {
    private readonly root = new THREE.Group();
    private readonly items: Item[] = [];
    private readonly flares: THREE.Texture[];
    private readonly explosion: THREE.Texture[];
    private readonly beams = new Map<number, THREE.Texture>();

    constructor(
        parent: THREE.Object3D,
        private readonly camera: THREE.Camera,
        private readonly lights: LightPool,
    ) {
        parent.add(this.root);
        this.flares = Gfx.sheet("flare", 64, 64, true)[0]!;
        this.explosion = Gfx.sheet("explosion", 128, 128).flat();
    }

    private sprite(
        tex: THREE.Texture,
        x: number,
        y: number,
        z: number,
        size: number,
        life: number,
        blend: Gfx.Blend = "add",
    ): Item {
        const mat = Gfx.spriteMaterial(tex, blend);
        const sprite = new THREE.Sprite(mat);
        this.root.add(sprite);
        const item: Item = {
            obj: sprite,
            mat,
            blend,
            x,
            y,
            z,
            age: 0,
            life,
            size,
            grow: 0,
            spin: Math.random() * Math.PI * 2,
            fade: true,
            vx: 0,
            vy: 0,
            vz: 0,
            gravity: 0,
        };
        this.place(item);
        this.items.push(item);
        return item;
    }

    flare(
        kind: FlareKind,
        x: number,
        y: number,
        z: number,
        size: number,
        life: number,
    ): Item {
        return this.sprite(
            this.flares[kind]!,
            x,
            y,
            z,
            size,
            life,
            kind === Flare.Smoke ? "alpha" : "add",
        );
    }

    light(
        x: number,
        y: number,
        z: number,
        color: number,
        power: number,
        life: number,
    ): void {
        const c = new THREE.Color(color).multiplyScalar(power);
        const light = this.lights.add({
            x,
            y,
            z,
            color: c,
            constant: 0.4,
            linear: 0.08,
            quadratic: 0.06,
        });
        this.items.push({
            light,
            x,
            y,
            z,
            age: 0,
            life,
            size: 1,
            grow: 0,
            spin: 0,
            fade: true,
            vx: 0,
            vy: 0,
            vz: 0,
            gravity: 0,
            base: new THREE.Vector3(c.r, c.g, c.b),
        });
    }

    /** Laser beam from the muzzle to the hit point (the game's), with its flashes. */
    beam(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
        let tex = this.beams.get(color);
        if (!tex) {
            tex = Gfx.beamTexture(color);
            this.beams.set(color, tex);
        }
        const d = to.clone().sub(from);
        const length = d.length();
        const mat = Gfx.glowMaterial(tex);
        const mesh = new THREE.Mesh(Gfx.beamGeometry(), mat);
        toThree(from.x, from.y, from.z, mesh.position);
        if (length > 0)
            mesh.quaternion.setFromUnitVectors(
                X_AXIS,
                vecToThree(d).divideScalar(length),
            );
        mesh.scale.x = length;
        this.root.add(mesh);
        this.items.push({
            obj: mesh,
            mat,
            beam: true,
            x: from.x,
            y: from.y,
            z: from.z,
            age: 0,
            life: 0.14,
            size: 0.07,
            grow: -0.3,
            spin: 0,
            fade: true,
            vx: 0,
            vy: 0,
            vz: 0,
            gravity: 0,
        });
        this.flare(Flare.LaserFlash, from.x, from.y, from.z, 0.35, 0.07);
        this.flare(Flare.Impact, to.x, to.y, to.z, 0.7, 0.18).grow = 1.5;
        const back = length > 0 ? 0.3 / length : 0;
        this.light(
            to.x - d.x * back,
            to.y - d.y * back,
            to.z - d.z * back,
            0x40f0ff,
            2.0,
            0.15,
        );
    }

    /** Green ichor bursting from a hit alien. */
    splash(x: number, y: number, z: number, amount: number): void {
        for (let i = 0; i < amount; i++) {
            const s = this.flare(
                Flare.Ichor,
                x,
                y,
                z,
                0.25 + Math.random() * 0.3,
                0.5 + Math.random() * 0.3,
            );
            s.vx = (Math.random() - 0.5) * 3;
            s.vy = (Math.random() - 0.5) * 3;
            s.vz = Math.random() * 2.5;
            s.gravity = 9;
        }
    }

    /** The grenade's explosion: fireball, sparks, rolling smoke and a bright flash. */
    explode(x: number, y: number, z: number): void {
        for (let i = 0; i < 3; i++) {
            // a big fireball with two smaller ones swelling a bit later beside it
            const a = Math.random() * Math.PI * 2;
            const off = i === 0 ? 0 : 0.7;
            const fire = this.sprite(
                this.explosion[0]!,
                x + Math.cos(a) * off,
                y + Math.sin(a) * off,
                z + 0.6 + i * 0.3,
                EXPLOSION_SIZE * (i === 0 ? 1 : 0.6),
                EXPLOSION_TIME,
                "alpha",
            );
            fire.frames = this.explosion;
            fire.fade = false;
            fire.spin = i === 0 ? 0 : (Math.random() - 0.5) * 0.6;
            fire.pull = 1.5 - i * 0.3;
            fire.delay = i * 0.08;
            fire.base = new THREE.Vector3(fire.x, fire.y, fire.z);
            fire.obj!.visible = false;
        }
        const core = this.flare(Flare.LauncherFlash, x, y, z, 6, 0.25);
        core.grow = 2;
        for (let i = 0; i < 28; i++) {
            const s = this.flare(
                Flare.LauncherFlash,
                x,
                y,
                z,
                0.3 + Math.random() * 0.4,
                0.5 + Math.random() * 0.6,
            );
            const a = Math.random() * Math.PI * 2;
            const up = Math.random();
            const speed = 6 + Math.random() * 10;
            s.vx = Math.cos(a) * speed * (1 - up * 0.5);
            s.vy = Math.sin(a) * speed * (1 - up * 0.5);
            s.vz = up * speed;
            s.gravity = 12;
        }
        for (let i = 0; i < 10; i++) {
            const s = this.flare(
                Flare.Smoke,
                x + (Math.random() - 0.5),
                y + (Math.random() - 0.5),
                z + 0.5,
                1.5 + Math.random() * 1.5,
                2 + Math.random() * 1.5,
            );
            s.vx = (Math.random() - 0.5) * 1.5;
            s.vy = (Math.random() - 0.5) * 1.5;
            s.vz = 0.4 + Math.random() * 0.6;
            s.grow = 0.8;
        }
        this.light(x, y, z + 1, 0xff9030, 9, 1.0);
    }

    private place(it: Item): void {
        if (it.obj) toThree(it.x, it.y, it.z, it.obj.position);
    }

    private remove(it: Item): void {
        if (it.light) this.lights.remove(it.light);
        if (it.obj) it.obj.removeFromParent();
        it.mat?.dispose();
    }

    update(dt: number): void {
        fromThree(this.camera.position, camGame);
        let i = 0;
        while (i < this.items.length) {
            const it = this.items[i]!;
            it.age += dt;
            const u = it.age / it.life;
            if (u >= 1) {
                this.remove(it);
                this.items.splice(i, 1);
                continue;
            }
            i++;
            if (it.light) {
                const f = (1 - u) * (1 - u);
                const b = it.base!;
                it.light.color.setRGB(b.x * f, b.y * f, b.z * f);
                continue;
            }
            it.vz -= it.gravity * dt;
            it.x += it.vx * dt;
            it.y += it.vy * dt;
            it.z = Math.max(0.05, it.z + it.vz * dt);
            const size = it.size * (1 + it.grow * u);
            const obj = it.obj!;
            if (it.frames) {
                const delay = it.delay ?? 0;
                const f = (it.age - delay) / (it.life - delay);
                obj.visible = f >= 0;
                const frame = Math.trunc(
                    THREE.MathUtils.clamp(f, 0, 0.999) * it.frames.length,
                );
                const mat = it.mat as THREE.SpriteMaterial;
                mat.map = it.frames[frame]!;
                const base = it.base!;
                toCamera.subVectors(camGame, base).normalize();
                const pull = it.pull ?? 0;
                it.x = base.x + toCamera.x * pull;
                it.y = base.y + toCamera.y * pull;
                it.z = base.z + toCamera.z * pull;
            }
            this.place(it);
            if (it.beam) obj.scale.y = obj.scale.z = size;
            else {
                obj.scale.set(size, size, 1);
                (it.mat as THREE.SpriteMaterial).rotation = it.spin;
            }
            if (it.fade) {
                const a = 1 - u;
                const mat = it.mat!;
                if (it.blend === "alpha") {
                    mat.color.setRGB(1, 1, 1);
                    mat.opacity = a * 0.85;
                } else mat.color.setRGB(a, a, a);
            }
        }
    }

    /** Removes everything, its lights too. */
    dispose(): void {
        for (const it of this.items) this.remove(it);
        this.items.length = 0;
        this.root.removeFromParent();
    }
}
