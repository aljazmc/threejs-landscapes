import * as THREE from "three";
import type { Castle } from "./castle";
import { Flare, Fx } from "./fx";
import {
    KINDS,
    Monster,
    POST_REACH,
    RADIUS,
    startHealth,
    wrap,
} from "./monster";

/**
 * The elf against the ten monsters in the keep, in first person. Distances
 * are in meters, positions in map coordinates (z up). The elf walks 4 m/s
 * like the monsters, sees from 1.65 m and fights with the sword (strikes
 * the nearest monster within reach in front) or the bow (its explosive
 * arrow bursts where it hits; the monster hit takes the full damage, the
 * others around less with the distance, up to 5 elf heights away).
 * Killing all monsters wins.
 *
 * The game knows nothing of the page: the controls come in, the sounds
 * and the music go out, and the view draws it.
 */

export const PLAYER_HEALTH = 500;
export const SPEED = 4;
export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.8;
const EYE = 1.65;
const SWORD_DAMAGE = 75;
export const SWORD_INTERVAL = 0.6;
const SWORD_REACH = 2.2;
/** Radians to each side of the view. */
const SWORD_ARC = 0.8;
export const SWING_TIME = 0.3;
/** Into the swing, when the blade bites. */
const STRIKE_AT = 0.12;
const ARROW_DAMAGE = 500;
/** A blow or an arrow to the head does this many times the damage. */
const HEADSHOT = 3;
/** On the alert, this many of the nearest monsters (besides the small ones) rush the elf. */
const RUSHERS = 2;
/** Monsters this near each other (m) gather in a pack. */
const PACK_AREA = 10;
/** Seconds the HEADSHOT text shows. */
const HEADSHOT_TIME = 0.9;
export const BOW_INTERVAL = 3;
const BLAST_RADIUS = 5 * PLAYER_HEIGHT;
const ARROW_SPEED = 30;
const ARROW_GRAVITY = 4;
/** The blast's loudness right beside the elf (1: as recorded). */
const BLAST_VOLUME = 0.4;
/** The dying roar's loudness right beside the elf (1: as recorded). */
const ROAR_VOLUME = 0.4;
/** Radians per pixel. */
const MOUSE_SPEED = 0.0025;
const MAX_PITCH = 1.45;
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

/** An explosive arrow in flight. */
export interface Arrow {
    at: THREE.Vector3;
    velocity: THREE.Vector3;
    age: number;
}

let games = 0;

export class Game {
    /** Tells this game from the ones before it. */
    readonly id = ++games;
    pitch = 0;
    health = PLAYER_HEALTH;
    /** 0: sword, 1: bow. */
    weapon = 0;
    readonly reload = [0, 0];
    /** Sound effects to play (name and volume) and music to change to, taken by Main. */
    sounds: [string, number][] = [];
    music: { name: string; once: boolean } | null = null;
    readonly monsters: Monster[] = [];
    readonly arrows: Arrow[] = [];
    readonly fx = new Fx();
    private toPlayer: number[] = [];
    /** The keep the game was last updated in, for the monsters' plans. */
    private castle: Castle | null = null;
    private packs = 0;
    private pathTime = 0;
    /** Into the sword's swing, or -1. */
    swing = -1;
    private struck = false;
    switchTime = 0;
    recoil = 0;
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
    /** The bow's muzzle, as last drawn. */
    muzzle: THREE.Vector3 | null = null;

    /** The elf looks along (cos yaw, sin yaw) on the map. */
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

    /** Called when the game is shown again: the click on Play must not attack, and the fight's music comes back. */
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
        this.fx.update(dt);
        if (this.result !== null) {
            for (const m of this.monsters) m.update(dt);
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
        this.updateArrows(dt, castle);
        // the eye shakes, the bow kicks and the weapons come up after switching
        this.shake = Math.max(this.shake - dt, 0);
        const jitter = this.shake * this.shake * 2;
        this.jitter
            .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .multiplyScalar(jitter);
        this.recoil = Math.max(this.recoil - dt * 1.5, 0);
        this.switchTime = Math.max(this.switchTime - dt, 0);
        if (this.monsters.every((m) => m.dead())) this.finish(true);
    }

    private finish(victory: boolean): void {
        this.result = victory;
        this.music = { name: victory ? "victory" : "defeat", once: true };
    }

    /** Plays an effect from (x, y) on the map, quieter the further it is. */
    soundAt(name: string, x: number, y: number, volume: number): void {
        this.sounds.push([name, volume * heard(this.distanceTo(x, y))]);
    }

    /** How far (m) a point on the floor plan is from the elf. */
    distanceTo(x: number, y: number): number {
        return Math.hypot(x - this.playerX, y - this.playerY);
    }

    /** A monster hit: the blow's sound, or its roar as it dies. */
    private hurtMonster(m: Monster, damage: number, hit: string): void {
        const pack = m.pack;
        m.hurt(damage);
        if (pack) this.packCharge(pack);
        this.alertAll(m);
        this.soundAt(
            m.dead() ? "roar" : hit,
            m.x,
            m.y,
            m.dead() ? ROAR_VOLUME : 0.7,
        );
    }

    // --- the monsters' plans ---------------------------------------------

    /**
     * A monster was hurt: the whole map turns hostile. The small, fast ones
     * and the two nearest of the others rush the elf at once; the big
     * ones lie in wait around corners on the elf's way; the rest gather
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

    // --- the elf --------------------------------------------------------

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
     * monster nor the elf; me is the monster moving, or null for the elf.
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
        if (this.placeFree(m.x + dx, m.y, RADIUS, m, castle)) m.x += dx;
        if (this.placeFree(m.x, m.y + dy, RADIUS, m, castle)) m.y += dy;
        return Math.hypot(m.x - x0, m.y - y0);
    }

    hurtPlayer(damage: number): void {
        if (this.result !== null) return;
        this.sounds.push(["hurt", 0.8]);
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
        for (let i = 0; i < 2; i++)
            this.reload[i] = Math.max(this.reload[i]! - dt, 0);
        if (controls.select !== null && controls.select !== this.weapon) {
            this.weapon = controls.select;
            this.switchTime = SWITCH_TIME;
        }
        if (this.swing >= 0) {
            this.swing += dt;
            if (!this.struck && this.swing >= STRIKE_AT) {
                this.struck = true;
                this.strike(castle);
            }
            if (this.swing >= SWING_TIME) this.swing = -1;
        }
        if (!controls.fire) this.triggerBlocked = false;
        if (
            !controls.fire ||
            this.triggerBlocked ||
            this.switchTime > 0.15 ||
            this.reload[this.weapon]! > 0
        )
            return;
        if (this.weapon === 0) {
            this.reload[0] = SWORD_INTERVAL;
            this.swing = 0;
            this.struck = false;
        } else this.loose(castle);
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

    /** The sword bites the nearest monster within reach in front of the elf. */
    private strike(castle: Castle): void {
        let best: Monster | null = null;
        let bestDist = Number.MAX_VALUE;
        for (const m of this.monsters) {
            if (m.dead()) continue;
            const dx = m.x - this.playerX;
            const dy = m.y - this.playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist - m.hitRadius > SWORD_REACH || dist >= bestDist) continue;
            const off = Math.abs(wrap(Math.atan2(dy, dx) - this.yaw));
            if (off > SWORD_ARC && dist > m.hitRadius + PLAYER_RADIUS) continue;
            if (
                dist > 0.01 &&
                castle.raycast(
                    new THREE.Vector3(this.playerX, this.playerY, 1.2),
                    new THREE.Vector3(dx / dist, dy / dist, 0),
                    dist,
                ) <
                    dist - m.hitRadius
            )
                continue; // a wall between them
            best = m;
            bestDist = dist;
        }
        const f = this.forward();
        if (!best) {
            // the blade cuts the air, or rings against a wall
            this.sounds.push(["swish", 0.6]);
            const e = this.eye();
            const wall = castle.raycast(e, f, SWORD_REACH);
            if (wall < SWORD_REACH)
                this.fx.add(
                    Flare.Slash,
                    e.addScaledVector(f, wall - 0.1),
                    0.6,
                    0.15,
                );
            return;
        }
        const away = new THREE.Vector3(
            best.x - this.playerX,
            best.y - this.playerY,
            0,
        ).normalize();
        const at = new THREE.Vector3(
            best.x,
            best.y,
            Math.min(best.height * 0.6, EYE),
        ).addScaledVector(away, -best.hitRadius);
        // aimed at its head: a headshot
        const headshot = best.headOnRay(this.eye(), f);
        if (headshot) this.headshot();
        this.hurtMonster(
            best,
            SWORD_DAMAGE * (headshot ? HEADSHOT : 1),
            "sword",
        );
        this.fx.add(Flare.Slash, at, 0.9, 0.18);
        this.fx.splash(at, 5);
        this.hitTime = 0.15;
        this.shake = Math.max(this.shake, 0.06);
    }

    /** The bow looses an explosive arrow along the line of sight to what the elf aims at. */
    private loose(castle: Castle): void {
        this.reload[1] = BOW_INTERVAL;
        this.recoil = 0.08;
        this.sounds.push(["bow", 0.8]);
        const e = this.eye();
        const f = this.forward();
        const m =
            this.muzzle?.clone() ??
            e
                .clone()
                .addScaledVector(f, 0.6)
                .add(new THREE.Vector3(0, 0, -0.15));
        const target = e.clone().addScaledVector(f, castle.raycast(e, f, 50));
        const dir = target.sub(m).normalize();
        this.arrows.push({
            at: m.clone(),
            velocity: dir
                .multiplyScalar(ARROW_SPEED)
                .add(new THREE.Vector3(0, 0, 0.6)),
            age: 0,
        });
        this.fx.add(Flare.Ember, m, 0.4, 0.1);
    }

    private updateArrows(dt: number, castle: Castle): void {
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const a = this.arrows[i]!;
            a.age += dt;
            a.velocity.z -= ARROW_GRAVITY * dt;
            const step = a.velocity.length() * dt;
            const d = a.velocity.clone().normalize();
            const wall = castle.raycast(a.at, d, step);
            const { hit, dist } = this.monsterOnRay(a.at, d, wall);
            if (hit || wall < step || a.age > 6) {
                this.explode(
                    a.at.clone().addScaledVector(d, Math.max(0, dist - 0.1)),
                    hit,
                    hit?.headOnRay(a.at, d) ?? false,
                );
                this.arrows.splice(i, 1);
                continue;
            }
            a.at.addScaledVector(d, step);
            this.fx.add(Flare.Ember, a.at, 0.22, 0.15);
        }
    }

    /**
     * The target (the monster hit, if any) takes the full damage, three times
     * that in the head; every other monster within the blast radius the
     * more, the nearer it is.
     */
    private explode(
        p: THREE.Vector3,
        target: Monster | null,
        headshot = false,
    ): void {
        this.fx.explode(new THREE.Vector3(p.x, p.y, Math.max(0, p.z - 0.4)));
        this.sounds.push([
            "blast",
            BLAST_VOLUME * heard(this.distanceTo(p.x, p.y) * 0.5),
        ]);
        for (const m of this.monsters) {
            if (m.dead()) continue;
            let damage = 0;
            if (m === target) {
                damage = ARROW_DAMAGE * (headshot ? HEADSHOT : 1);
                if (headshot) this.headshot();
            } else {
                const horizontal = Math.max(
                    0,
                    Math.hypot(m.x - p.x, m.y - p.y) - m.hitRadius,
                );
                const vertical = p.z - THREE.MathUtils.clamp(p.z, 0, m.height);
                const d = Math.hypot(horizontal, vertical);
                if (d < BLAST_RADIUS)
                    damage = ARROW_DAMAGE * (1 - d / BLAST_RADIUS);
            }
            if (damage > 0) {
                this.hurtMonster(m, damage, "splat");
                this.fx.splash(new THREE.Vector3(m.x, m.y, m.height * 0.6), 4);
                this.hitTime = 0.15;
            }
        }
        const near = this.distanceTo(p.x, p.y);
        this.shake = Math.max(
            this.shake,
            0.45 * THREE.MathUtils.clamp(1 - near / 25, 0.15, 1),
        );
    }

    // --- saving ---------------------------------------------------------

    saveString(): string {
        return JSON.stringify({
            player: [
                this.playerX,
                this.playerY,
                this.yaw,
                this.pitch,
                this.health,
                this.weapon,
            ].join(","),
            // one line per monster: kind, position, turn, health and whether it hunts the elf
            monsters: this.monsters
                .map((m) =>
                    [m.kind, m.x, m.y, m.angle, m.health, m.angry ? 1 : 0].join(
                        ",",
                    ),
                )
                .join(";"),
        });
    }

    static fromSaveString(text: string): Game | null {
        try {
            const s = JSON.parse(text) as {
                player?: unknown;
                monsters?: unknown;
            };
            if (typeof s.player !== "string" || typeof s.monsters !== "string")
                return null;
            const numbers = (line: string) => {
                const v = line.split(",").map(Number);
                if (v.some(Number.isNaN)) throw new Error("bad save");
                return v;
            };
            const [x = 0, y = 0, yaw = 0, pitch = 0, health = 0, weapon = 0] =
                numbers(s.player);
            const game = new Game(x, y, yaw);
            game.pitch = pitch;
            game.health = health;
            game.weapon = Math.min(Math.max(Math.trunc(weapon), 0), 1);
            for (const line of s.monsters
                .split(";")
                .filter((l) => l.length > 0)) {
                const [kind = 0, mx = 0, my = 0, angle = 0, mh = 0, angry = 0] =
                    numbers(line);
                const m = new Monster(
                    Math.min(Math.max(Math.trunc(kind), 0), KINDS.length - 1),
                    mx,
                    my,
                    angle,
                    mh,
                );
                m.angry = angry === 1;
                game.monsters.push(m);
            }
            return game.monsters.length > 0 ? game : null;
        } catch {
            return null;
        }
    }
}
