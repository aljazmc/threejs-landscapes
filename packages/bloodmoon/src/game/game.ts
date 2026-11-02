import * as THREE from "three";
import type { Castle } from "./castle";
import { Flare, Fx } from "./fx";
import { KINDS, Monster, POST_REACH, RADIUS, startHealth } from "./monster";

/**
 * The vampire hunter against the ten creatures of the night in the castle,
 * in first person. Distances are in meters, positions in map coordinates
 * (z up). The hunter walks 4 m/s like the monsters, sees from 1.65 m and
 * fights with the revolver (its silver bullet hits the first monster in
 * the line of fire) or the steampunk flamethrower (it burns every monster
 * in its cone of fire as long as the fuel lasts). Killing all monsters
 * wins.
 *
 * The game knows nothing of the page: the controls come in, the sounds
 * and the music go out, and the view draws it.
 */

export const PLAYER_HEALTH = 500;
export const SPEED = 4;
export const PLAYER_RADIUS = 0.3;
export const EYE = 1.65;
export const REVOLVER_DAMAGE = 40;
export const REVOLVER_INTERVAL = 0.5;
/** Per second. */
export const FLAME_DAMAGE = 150;
/** A bullet in the head does this many times the damage. */
const HEADSHOT = 3;
/** On the alert, this many of the nearest monsters (besides the small ones) rush the hunter. */
const RUSHERS = 2;
/** Monsters this near each other (m) gather in a pack. */
const PACK_AREA = 10;
/** The death shriek's loudness right beside the hunter (1: as recorded). */
const SHRIEK_VOLUME = 0.4;
/** Seconds the HEADSHOT text shows. */
const HEADSHOT_TIME = 0.9;
export const FLAME_REACH = 6;
/** Radians to each side of the aim. */
const FLAME_ARC = 0.3;
/** Seconds of fire in a full tank. */
export const FUEL_TIME = 4;
/** From empty to full. */
const REFUEL_TIME = 8;
/** The share of fuel an empty tank needs to fire again. */
const RELIGHT = 0.25;
const FIRE_EVERY = 0.025;
const FIRE_SPEED = 11;
/** Radians per pixel. */
const MOUSE_SPEED = 0.0025;
export const MAX_PITCH = 1.45;
const PATH_TIME = 0.25;
export const SWITCH_TIME = 0.3;
/** m, at which a sound has faded away. */
const HEARING = 30;

/** How loud a sound from distance meters away is heard. */
export function heard(distance: number): number {
    const near = Math.max(1 - distance / HEARING, 0);
    return near * near;
}

/** What the player does in a frame. */
export interface Controls {
    /** Forward and to the right, -1 to 1 each; a shorter tilt walks slower. */
    forward: number;
    side: number;
    /** Mouse pixels (or their like) to turn the view by. */
    lookX: number;
    lookY: number;
    fire: boolean;
    select: number | null;
}

export const NO_CONTROLS: Controls = {
    forward: 0,
    side: 0,
    lookX: 0,
    lookY: 0,
    fire: false,
    select: null,
};

const srgb = (r: number, g: number, b: number) =>
    new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

let games = 0;

export class Game {
    /** Tells this game from the ones before it. */
    readonly id = ++games;
    /** The hunter looks along (cos yaw, sin yaw) on the map. */
    pitch = 0;
    health = PLAYER_HEALTH;
    /** 0: revolver, 1: flamethrower. */
    weapon = 0;
    reload = 0;
    fuel = 1;
    /** The flamethrower ran dry and waits for some fuel. */
    dry = false;
    firing = false;
    private wasFiring = false;
    /** Sound effects to play (name and volume) and music to change to, taken by Main. */
    sounds: [string, number][] = [];
    music: { name: string; once: boolean } | null = null;
    private fireTime = 0;
    readonly monsters: Monster[] = [];
    readonly fx = new Fx();
    private toPlayer: number[] = [];
    /** The keep the game was last updated in, for the monsters' plans. */
    private castle: Castle | null = null;
    private packs = 0;
    private pathTime = 0;
    switchTime = 0;
    recoil = 0;
    /** The drum turns a chamber after each shot: its turn and the turn it heads for. */
    drum = 0;
    private drumGoal = 0;
    stride = 0;
    private shake = 0;
    readonly jitter = new THREE.Vector3();
    time = 0;
    private triggerBlocked = true;
    hurtTime = 0;
    hitTime = 0;
    /** Counts down from HEADSHOT_TIME after a hit in the head. */
    headshotTime = 0;
    /** true when won, false when lost. */
    result: boolean | null = null;
    /** Muzzles of the revolver and the flamethrower, as last drawn. */
    readonly muzzles: (THREE.Vector3 | null)[] = [null, null];

    private constructor(
        public playerX: number,
        public playerY: number,
        public yaw: number,
    ) {}

    static create(castle: Castle): Game {
        const { x, y, angle } = castle.playerStart;
        const a = THREE.MathUtils.degToRad(angle);
        const game = new Game(x, y, Math.atan2(-Math.cos(a), Math.sin(a)));
        castle.monsterStarts.forEach((s, i) => {
            const kind = i % KINDS.length;
            const m = new Monster(
                kind,
                s.x,
                s.y,
                Math.random() * Math.PI * 2,
                startHealth(kind),
            );
            // if the start is in the way of a wall or prop, the nearest free cell
            if (!castle.circleFree(m.x, m.y, RADIUS)) {
                const c = castle.nearestFree(m.x, m.y);
                m.x = c.x + 0.5;
                m.y = c.y + 0.5;
            }
            game.monsters.push(m);
        });
        return game;
    }

    /** Called when the game is shown again: the click on Play must not fire, and the fight's music comes back. */
    resume(): void {
        this.triggerBlocked = true;
        if (this.result === null) this.music = { name: "combat", once: false };
    }

    update(dt: number, controls: Controls, castle: Castle): void {
        this.castle = castle;
        this.time += dt;
        this.hurtTime = Math.max(this.hurtTime - dt, 0);
        this.hitTime = Math.max(this.hitTime - dt, 0);
        this.headshotTime = Math.max(this.headshotTime - dt, 0);
        this.shake = Math.max(this.shake - dt, 0);
        this.recoil = Math.max(this.recoil - dt * 1.5, 0);
        this.switchTime = Math.max(this.switchTime - dt, 0);
        this.drum += (this.drumGoal - this.drum) * Math.min(dt * 18, 1);
        const jitter = this.shake * this.shake * 2;
        this.jitter
            .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .multiplyScalar(jitter);
        this.wasFiring = this.firing;
        this.firing = false;
        if (this.result !== null) {
            for (const m of this.monsters) m.update(dt);
            this.fx.update(dt);
            return;
        }

        this.yaw += controls.lookX * MOUSE_SPEED;
        this.pitch = THREE.MathUtils.clamp(
            this.pitch - controls.lookY * MOUSE_SPEED,
            -MAX_PITCH,
            MAX_PITCH,
        );
        this.movePlayer(dt, controls, castle);
        this.updateWeapons(dt, controls, castle);

        this.pathTime -= dt;
        if (this.pathTime <= 0 || this.toPlayer.length === 0) {
            this.pathTime = PATH_TIME;
            this.toPlayer = castle.distances(
                Math.floor(this.playerX),
                Math.floor(this.playerY),
                1000,
            );
        }
        for (const m of this.monsters) {
            m.think(dt, this, castle, this.toPlayer);
            m.update(dt);
        }
        this.updatePacks();
        this.updateFire(dt, castle);
        this.fx.update(dt);
        if (this.monsters.every((m) => m.dead())) this.finish(true);
    }

    private finish(victory: boolean): void {
        this.result = victory;
        this.music = { name: victory ? "victory" : "defeat", once: true };
    }

    /** Plays an effect from (x, y) on the map, quieter the further it is. */
    soundAt(name: string, x: number, y: number, volume: number): void {
        const distance = Math.hypot(x - this.playerX, y - this.playerY);
        this.sounds.push([name, volume * heard(distance)]);
    }

    /** A monster hit: a splat, or its shriek as it is destroyed. */
    private hurtMonster(m: Monster, damage: number, splat: boolean): void {
        const wasDead = m.dead();
        const pack = m.pack;
        m.hurt(damage);
        if (pack) this.packCharge(pack);
        this.alertAll(m);
        if (m.dead() && !wasDead)
            this.soundAt("shriek", m.x, m.y, SHRIEK_VOLUME);
        else if (splat) this.soundAt("splat", m.x, m.y, 0.7);
    }

    // --- the monsters' plans ---------------------------------------------

    /**
     * A monster was hurt: the whole map turns hostile. The small, fast ones
     * and the two nearest of the others rush the hunter at once; the big
     * ones lie in wait around corners on the hunter's way; the rest gather
     * in packs of two or three at hidden spots and charge together, or lie
     * in wait too when none is near enough to gather with.
     */
    private alertAll(hit: Monster): void {
        const castle = this.castle;
        if (!castle) return;
        const far = (m: Monster) =>
            Math.hypot(m.x - this.playerX, m.y - this.playerY);
        const calm = this.monsters
            .filter((m) => m !== hit && !m.dead() && !m.angry)
            .sort((a, b) => far(a) - far(b));
        const taken = new Set<number>();
        const cover = (m: Monster) =>
            castle.cover(
                m.x,
                m.y,
                this.playerX,
                this.playerY,
                taken,
                POST_REACH,
            );
        const gatherers: Monster[] = [];
        let rushers = 0;
        for (const m of calm) {
            if (m.size === "small" || rushers < RUSHERS) {
                if (m.size !== "small") rushers++;
                m.alert("charge", null, castle);
            } else if (m.size === "big") m.alert("ambush", cover(m), castle);
            else gatherers.push(m);
        }
        while (gatherers.length > 0) {
            const leader = gatherers.shift()!;
            const near = gatherers
                .filter(
                    (m) =>
                        Math.hypot(m.x - leader.x, m.y - leader.y) < PACK_AREA,
                )
                .slice(0, 2);
            if (near.length === 0) {
                leader.alert("ambush", cover(leader), castle);
                continue;
            }
            for (const m of near) gatherers.splice(gatherers.indexOf(m), 1);
            const id = ++this.packs;
            const meet = cover(leader);
            for (const m of [leader, ...near])
                m.alert("pack", meet, castle, id);
        }
    }

    /** The pack charges together. */
    packCharge(pack: number): void {
        for (const m of this.monsters) if (m.pack === pack) m.charge();
    }

    /** A pack charges once all of it has gathered. */
    private updatePacks(): void {
        const gathered = new Map<number, boolean>();
        for (const m of this.monsters) {
            if (m.dead() || m.pack === 0) continue;
            gathered.set(m.pack, (gathered.get(m.pack) ?? true) && m.atPost);
        }
        for (const [pack, all] of gathered) if (all) this.packCharge(pack);
    }

    // --- the hunter -----------------------------------------------------

    private movePlayer(dt: number, controls: Controls, castle: Castle): void {
        const { forward, side } = controls;
        const len = Math.sqrt(forward * forward + side * side);
        if (len === 0) {
            this.stride *= 0.9;
            return;
        }
        // keys walk at full speed; a joystick tilted less, slower
        const pace = Math.min(len, 1);
        // right of the view is (-sin yaw, cos yaw), as the camera sees it
        const s = Math.sin(this.yaw);
        const c = Math.cos(this.yaw);
        const dx = ((c * forward - s * side) / len) * SPEED * pace * dt;
        const dy = ((s * forward + c * side) / len) * SPEED * pace * dt;
        if (
            this.placeFree(
                this.playerX + dx,
                this.playerY,
                PLAYER_RADIUS,
                null,
                castle,
            )
        )
            this.playerX += dx;
        if (
            this.placeFree(
                this.playerX,
                this.playerY + dy,
                PLAYER_RADIUS,
                null,
                castle,
            )
        )
            this.playerY += dy;
        // a footstep at the bottom of each bob of the view
        const step = Math.floor(this.stride / Math.PI);
        this.stride += dt * 10 * pace;
        if (Math.floor(this.stride / Math.PI) !== step)
            this.sounds.push(["step", 0.35]);
    }

    /**
     * True when a figure of radius r at (x, y) overlaps no wall, prop,
     * monster nor the hunter; me is the monster moving, or null for the hunter.
     */
    private placeFree(
        x: number,
        y: number,
        r: number,
        me: Monster | null,
        castle: Castle,
    ): boolean {
        if (!castle.circleFree(x, y, r)) return false;
        const fromX = me ? me.x : this.playerX;
        const fromY = me ? me.y : this.playerY;
        if (me) {
            const d = PLAYER_RADIUS + r;
            if ((x - this.playerX) ** 2 + (y - this.playerY) ** 2 < d * d)
                return false;
        }
        for (const m of this.monsters) {
            if (m === me || m.dead()) continue;
            const d = r + RADIUS;
            const now = (m.x - fromX) ** 2 + (m.y - fromY) ** 2;
            const next = (m.x - x) ** 2 + (m.y - y) ** 2;
            // moving away from someone it already overlaps is allowed
            if (next < d * d && next < now) return false;
        }
        return true;
    }

    /** Moves the monster by (dx, dy), sliding along what is in the way; returns the distance moved. */
    moveMonster(m: Monster, dx: number, dy: number, castle: Castle): number {
        const x0 = m.x;
        const y0 = m.y;
        if (this.placeFree(x0 + dx, y0, RADIUS, m, castle)) m.x += dx;
        if (this.placeFree(m.x, y0 + dy, RADIUS, m, castle)) m.y += dy;
        return Math.hypot(m.x - x0, m.y - y0);
    }

    hurtPlayer(damage: number): void {
        if (this.result !== null) return;
        this.sounds.push(["hurt", 0.7]);
        this.health = Math.max(this.health - damage, 0);
        this.hurtTime = 0.5;
        this.shake = Math.max(this.shake, 0.12);
        if (this.health <= 0) this.finish(false);
    }

    forward(): THREE.Vector3 {
        const cp = Math.cos(this.pitch);
        return new THREE.Vector3(
            Math.cos(this.yaw) * cp,
            Math.sin(this.yaw) * cp,
            Math.sin(this.pitch),
        );
    }

    eye(): THREE.Vector3 {
        return new THREE.Vector3(
            this.playerX,
            this.playerY,
            EYE + Math.sin(this.stride) * 0.04 * Math.min(this.stride, 1),
        );
    }

    // --- weapons --------------------------------------------------------

    private updateWeapons(
        dt: number,
        controls: Controls,
        castle: Castle,
    ): void {
        this.reload = Math.max(this.reload - dt, 0);
        if (controls.select !== null && controls.select !== this.weapon) {
            this.weapon = controls.select;
            this.switchTime = SWITCH_TIME;
        }
        if (!controls.fire) this.triggerBlocked = false;
        const ready =
            controls.fire && !this.triggerBlocked && this.switchTime <= 0.15;
        if (this.weapon === 0) {
            if (ready && this.reload <= 0) this.shoot(castle);
        } else if (ready && !this.dry && this.fuel > 0) this.burn(dt, castle);
        if (!this.firing) {
            this.fuel = Math.min(this.fuel + dt / REFUEL_TIME, 1);
            if (this.fuel >= RELIGHT) this.dry = false;
        }
    }

    /** A hit in the head: its sound and the HEADSHOT text. */
    private headshot(): void {
        this.sounds.push(["headshot", 0.8]);
        this.headshotTime = HEADSHOT_TIME;
    }

    /** Distance along a ray to where it enters the monster's cylinder. */
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used via the class name
    private static rayMonster(
        m: Monster,
        o: THREE.Vector3,
        d: THREE.Vector3,
    ): number | null {
        const fx = o.x - m.x;
        const fy = o.y - m.y;
        const r = m.hitRadius;
        const qa = d.x * d.x + d.y * d.y;
        if (qa > 1e-9) {
            const qb = 2 * (fx * d.x + fy * d.y);
            const qc = fx * fx + fy * fy - r * r;
            const disc = qb * qb - 4 * qa * qc;
            if (disc >= 0) {
                let t = (-qb - Math.sqrt(disc)) / (2 * qa);
                if (t < 0 && qc < 0) t = 0; // starting inside
                const z = o.z + d.z * t;
                if (t >= 0 && z >= 0 && z <= m.height) return t;
            }
        }
        if (d.z !== 0) {
            const t = (m.height - o.z) / d.z;
            const px = fx + d.x * t;
            const py = fy + d.y * t;
            if (t > 0 && px * px + py * py <= r * r) return t;
        }
        return null;
    }

    /** The nearest living monster along the ray within maxDist, and how far. */
    private monsterOnRay(
        o: THREE.Vector3,
        d: THREE.Vector3,
        maxDist: number,
    ): { hit: Monster | null; dist: number } {
        let hit: Monster | null = null;
        let dist = maxDist;
        for (const m of this.monsters) {
            if (m.dead()) continue;
            const t = Game.rayMonster(m, o, d);
            if (t !== null && t < dist) {
                hit = m;
                dist = t;
            }
        }
        return { hit, dist };
    }

    private muzzle(weapon: number): THREE.Vector3 {
        return (
            this.muzzles[weapon]?.clone() ??
            this.eye()
                .addScaledVector(this.forward(), 0.6)
                .add(new THREE.Vector3(0, 0, -0.15))
        );
    }

    /** The revolver fires a silver bullet along the line of sight. */
    private shoot(castle: Castle): void {
        this.reload = REVOLVER_INTERVAL;
        this.sounds.push(["revolver", 0.6]);
        this.recoil = 0.12;
        this.drumGoal += (Math.PI * 2) / 6;
        this.shake = Math.max(this.shake, 0.05);
        const e = this.eye();
        const f = this.forward();
        const muzzle = this.muzzle(0);
        this.fx.add(Flare.Flash, muzzle, 0.35, 0.06);
        this.fx.add(Flare.Smoke, muzzle, 0.2, 0.5).velocity.set(0, 0, 0.4);
        this.fx.light(muzzle, srgb(1, 0.8, 0.5), 4, 0.08, 8);
        const wall = castle.raycast(e, f, 60);
        const { hit, dist } = this.monsterOnRay(e, f, wall);
        const at = e.clone().addScaledVector(f, dist - 0.05);
        if (hit) {
            const headshot = hit.headOnRay(e, f);
            if (headshot) this.headshot();
            this.hurtMonster(
                hit,
                REVOLVER_DAMAGE * (headshot ? HEADSHOT : 1),
                true,
            );
            this.fx.splash(at, 5);
            this.hitTime = 0.15;
        } else {
            this.fx.add(Flare.Spark, at, 0.4, 0.12);
            this.fx.add(Flare.Smoke, at, 0.3, 0.6).velocity.set(0, 0, 0.3);
        }
    }

    /** The flamethrower burns every monster in its cone, and throws its fire. */
    private burn(dt: number, castle: Castle): void {
        this.firing = true;
        if (!this.wasFiring) this.sounds.push(["ignite", 0.8]);
        this.fuel -= dt / FUEL_TIME;
        if (this.fuel <= 0) {
            this.fuel = 0;
            this.dry = true;
            this.sounds.push(["dry", 0.8]);
        }
        this.shake = Math.max(this.shake, 0.03);
        const e = this.eye();
        const f = this.forward();
        for (const m of this.monsters) {
            if (m.dead()) continue;
            const center = new THREE.Vector3(
                m.x,
                m.y,
                Math.min(m.height * 0.5, EYE),
            );
            const to = center.sub(e);
            const dist = to.length();
            if (dist - m.hitRadius > FLAME_REACH || dist < 1e-3) continue;
            const dir = to.divideScalar(dist);
            const off = f.angleTo(dir);
            if (off > FLAME_ARC + Math.atan(m.hitRadius / dist)) continue;
            if (castle.raycast(e, dir, dist) < dist - m.hitRadius) continue; // a wall between them
            this.hurtMonster(m, FLAME_DAMAGE * dt, false);
            m.flash = 0;
            m.burning = 0.4;
            this.hitTime = 0.1;
        }
        // the fire flies from the nozzle towards what the hunter aims at
        const muzzle = this.muzzle(1);
        const aim = e
            .clone()
            .addScaledVector(f, castle.raycast(e, f, FLAME_REACH));
        const toAim = aim.sub(muzzle);
        const dir = toAim.lengthSq() > 1e-12 ? toAim.normalize() : f.clone();
        this.fireTime -= dt;
        while (this.fireTime <= 0) {
            this.fireTime += FIRE_EVERY;
            const spread = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5,
            ).multiplyScalar(1.6);
            const life = 0.45 + Math.random() * 0.2;
            this.fx.fire(
                muzzle.clone().addScaledVector(dir, 0.05),
                dir.clone().multiplyScalar(FIRE_SPEED).add(spread),
                life,
            );
            if (Math.random() < 0.3) {
                const s = this.fx.add(Flare.Ember, muzzle, 0.12, 0.5);
                s.velocity
                    .copy(dir)
                    .multiplyScalar(FIRE_SPEED * 0.8)
                    .addScaledVector(spread, 2);
                s.drag = 1;
                s.gravity = 3;
            }
        }
        if (Math.random() < dt * 25) {
            const flicker = 0.8 + Math.random() * 0.6;
            this.fx.light(
                muzzle.clone().addScaledVector(dir, 2),
                srgb(1, 0.55, 0.2),
                3.5 * flicker,
                0.08,
                10,
            );
        }
    }

    /** The fire stops at walls, and burning monsters throw sparks. */
    private updateFire(dt: number, castle: Castle): void {
        for (const it of this.fx.items) {
            if (it.flare !== null) continue;
            const speed = it.velocity.length();
            const step = speed * dt;
            if (
                step > 1e-4 &&
                castle.raycast(
                    it.at,
                    it.velocity.clone().divideScalar(speed),
                    step + 0.2,
                ) <
                    step + 0.2
            ) {
                // it spreads along the wall instead
                it.velocity.multiplyScalar(0.15);
                it.drag = 3;
            }
        }
        for (const m of this.monsters) {
            if (m.burning <= 0 || Math.random() > dt * 30) continue;
            const a = Math.random() * Math.PI * 2;
            const at = new THREE.Vector3(
                m.x + Math.cos(a) * m.hitRadius * 0.8,
                m.y + Math.sin(a) * m.hitRadius * 0.8,
                Math.random() * m.height,
            );
            const s = this.fx.add(
                Flare.Ember,
                at,
                0.2 + Math.random() * 0.2,
                0.4,
            );
            s.velocity.set(0, 0, 1.5);
        }
    }

    // --- saving ---------------------------------------------------------

    saveString(): string {
        let text = `player ${this.playerX} ${this.playerY} ${this.yaw} ${this.pitch} ${this.health} ${this.weapon} ${this.fuel}\n`;
        for (const m of this.monsters) text += `monster ${m.saveString()}\n`;
        return text;
    }

    static fromSaveString(text: string): Game | null {
        let game: Game | null = null;
        for (const line of text.split("\n")) {
            const t = line.split(" ");
            const f = (i: number): number => {
                const v = Number.parseFloat(t[i] ?? "");
                if (Number.isNaN(v)) throw new Error("bad save");
                return v;
            };
            try {
                if (t[0] === "player") {
                    const g = new Game(f(1), f(2), f(3));
                    g.pitch = f(4);
                    g.health = f(5);
                    g.weapon = Math.min(Math.trunc(f(6)), 1);
                    g.fuel = THREE.MathUtils.clamp(f(7), 0, 1);
                    game = g;
                } else if (t[0] === "monster") {
                    if (!game) return null;
                    const kind = Math.min(Math.trunc(f(1)), KINDS.length - 1);
                    const m = new Monster(kind, f(2), f(3), f(4), f(5));
                    m.angry = f(6) !== 0;
                    game.monsters.push(m);
                }
            } catch {
                return null;
            }
        }
        return game && game.monsters.length > 0 ? game : null;
    }
}
