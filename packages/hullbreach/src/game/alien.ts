import * as THREE from "three";
import {
    fromThree,
    joint,
    jointRotation,
    joints,
    nodeName,
    place,
} from "../space";
import { Audio } from "./audio";
import type { Game } from "./game";
import * as Gfx from "./gfx";
import {
    bendAxis,
    bendJoint,
    bendScale,
    easeGait,
    HEAVY,
    heavyCooldown,
    LIGHT,
    motion,
} from "./motion";
import type { Ship } from "./ship";

export const SPECIES = [
    "stalker",
    "brute",
    "crawler",
    "mantis",
    "arachnid",
    "raptor",
    "squid",
    "scorpion",
    "ghoul",
    "cyclops",
];
/** The starting health of one the size of the player (see startHealth). */
const HEALTH = 300;
/** The damage of the commando's laser (LASER_DAMAGE in game.ts). */
const PLAYER_DAMAGE = 30;
/**
 * How big an alien is next to the commando: a small one strikes for a
 * quarter of the laser's damage and moves twice as fast as the commando, one
 * of the commando's size strikes as hard as the laser and moves as fast, and
 * a big one strikes twice as hard at half the pace.
 */
export type Size = "small" | "player" | "big";
const SIZE_DAMAGE: Record<Size, number> = { small: 0.25, player: 1, big: 2 };
const SIZE_SPEED: Record<Size, number> = { small: 2, player: 1, big: 0.5 };
/** A small one starts with half the health, a big one with double. */
const SIZE_HEALTH: Record<Size, number> = { small: 0.5, player: 1, big: 2 };
/** The size of each species, measured against the commando's 1.8 m. */
const SIZES: Record<string, Size> = {
    // small
    crawler: "small",
    raptor: "small",
    // about the size of the player
    stalker: "player",
    squid: "player",
    ghoul: "player",
    arachnid: "player",
    cyclops: "player",
    // big
    brute: "big",
    mantis: "big",
    scorpion: "big",
};

/** The health a species starts with, by its size. */
export function startHealth(species: number): number {
    const size = SIZES[SPECIES[species]!] ?? "player";
    return HEALTH * SIZE_HEALTH[size];
}
/** For walking: fits through the cabin doors. */
export const RADIUS = 0.35;
/** Seconds after a blow before the next. */
const ATTACK_INTERVAL = 1.2;
/** The heavy blow lunges in from this much beyond its reach (m), this fast (m/s). */
const LUNGE = 0.8;
const LUNGE_SPEED = 4;
const DEATH_TIME = 1.1;
const TURN_SPEED = 8;
/** Lying in wait, it springs out when the commando comes this near in sight. */
const AMBUSH_SPOT = 5;
/** Gathering, the pack charges when the commando comes this near in sight. */
const PACK_SPOT = 7;
/** Steps an ambusher or a pack member may go to its post, across the ship. */
export const POST_REACH = 100;
/** Seconds (counted from the alert, the way there included) before an ambusher or a pack attacks anyway. */
const AMBUSH_TIME = 30;
const PACK_TIME = 20;

/**
 * What a hostile alien does: attack at once, lie in wait in a cover the
 * commando can't see, or gather with its pack at a hidden spot and charge
 * together.
 */
export type Role = "charge" | "ambush" | "pack";

export interface AlienData {
    species: number;
    x: number;
    y: number;
    angle: number;
    health: number;
    angry: boolean;
}

/** An angle in -PI..PI. */
export function wrapAngle(a: number): number {
    const tau = Math.PI * 2;
    a %= tau;
    if (a > Math.PI) a -= tau;
    else if (a <= -Math.PI) a += tau;
    return a;
}

const delta = new THREE.Quaternion();

/** A knee or an elbow, bent along the axis of its natural bend (see motion.ts). */
interface Bend {
    joint: THREE.Object3D;
    rest: THREE.Quaternion;
    axis: THREE.Vector3;
    /** See bendScale. */
    scale: number;
}
const scratch = new THREE.Vector3();
/** The smallest and the largest ball around a head, for headshots. */
const HEAD_RADIUS = { min: 0.2, max: 0.4 };

/**
 * One of the ten alien boarders: its model (res/shooter-<species>.glb),
 * the animation of its joints (see blender-scripts/aliens.py for their
 * names) and its mind. Aliens roam the ship aimlessly, each on its own,
 * until the player hurts them; then they hunt the player and strike with
 * their claws.
 */
export class Alien {
    readonly species: number;
    x: number;
    y: number;
    /** Turn of the model around Z; it faces (sin a, -cos a). */
    angle: number;
    health: number;
    angry = false;
    /** Size for the shots: a standing cylinder. */
    readonly hitRadius: number;
    readonly height: number;
    readonly obj: THREE.Object3D;

    private readonly body: THREE.Object3D;
    private readonly bodyZ: number;
    private readonly head: THREE.Object3D | null;
    /** The ball around its head for headshots: its centre on the head joint. */
    private readonly headCentre = new THREE.Vector3();
    private readonly headRadius: number = HEAD_RADIUS.max;
    private readonly claws: THREE.Object3D[] = [];
    /** The elbow of each claw (null for a claw without one). */
    private readonly elbows: (Bend | null)[] = [];
    private readonly legsA: THREE.Object3D[] = [];
    private readonly legsB: THREE.Object3D[] = [];
    /** The knees of the LegA and of the LegB legs. */
    private readonly kneesA: Bend[] = [];
    private readonly kneesB: Bend[] = [];
    private readonly tails: THREE.Object3D[] = [];
    private hover = false;
    private readonly rest = new Map<THREE.Object3D, THREE.Quaternion>();
    private readonly materials: (
        | THREE.MeshBasicMaterial
        | THREE.MeshLambertMaterial
    )[];

    private time = Math.random() * 10;
    private walk = 0;
    private moving = 0;
    /** The pace eased (see easeGait), for the animation. */
    private gait = 0;
    private attackTime = -1;
    /** Whether the blow under way is the heavy one. */
    private heavy = false;
    private heavyCooldown = heavyCooldown() / 2;
    private struck = false;
    private cooldown = 0;
    private deathTime = 0;
    private flash = 0;
    /** Once hostile: attacking, lying in wait, or gathering with its pack. */
    role: Role = "charge";
    /** The cell it waits in: its cover, or its pack's meeting point (-1: none). */
    post = -1;
    private toPost: number[] | null = null;
    private waited = 0;
    /** Its pack (0: none). */
    pack = 0;
    // roaming
    private path: number[] = [];
    private wait = Math.random() * 2;

    constructor(
        species: number,
        x: number,
        y: number,
        angle: number,
        health: number,
        parent: THREE.Object3D,
    ) {
        this.species = species;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.health = health;
        this.obj = Gfx.model(SPECIES[species]!, true);
        const bounds = Gfx.bounds(this.obj);
        const size = bounds.getSize(new THREE.Vector3());
        this.hitRadius = THREE.MathUtils.clamp(
            Math.max(size.x, size.y) * 0.32,
            0.35,
            0.8,
        );
        this.height = bounds.max.z;
        this.materials = Gfx.materials(this.obj);
        parent.add(this.obj);

        const body = joint(this.obj, "Body");
        if (!body)
            throw new Error(`hullbreach: ${SPECIES[species]} has no Body`);
        this.body = body;
        this.bodyZ = body.position.z;
        this.head = joint(this.obj, "Head");
        if (this.head) {
            const box = Gfx.bounds(this.head);
            const size = box.getSize(new THREE.Vector3());
            this.head.worldToLocal(box.getCenter(this.headCentre));
            this.headRadius = THREE.MathUtils.clamp(
                Math.max(size.x, size.y, size.z) / 2,
                HEAD_RADIUS.min,
                HEAD_RADIUS.max,
            );
        }
        const bend = (name: string): Bend | null => {
            const o = joint(this.obj, name);
            const axis = o && bendAxis(o.quaternion);
            return o && axis
                ? {
                      joint: o,
                      rest: o.quaternion.clone(),
                      axis,
                      scale: bendScale(name),
                  }
                : null;
        };
        for (const name of ["ClawR", "ClawL"]) {
            const claw = joint(this.obj, name);
            if (!claw) continue;
            this.claws.push(claw);
            this.elbows.push(bend(`${name} Elbow`));
        }
        for (const o of joints(this.obj)) {
            const name = nodeName(o);
            // the hips; an insect's leg bends below its knee
            const leg = /^Leg([AB]) \d+$/.exec(name);
            if (leg) {
                (leg[1] === "A" ? this.legsA : this.legsB).push(o);
                const knee = bend(`${name} Down`) ?? bend(`${name} Knee`);
                if (knee)
                    (leg[1] === "A" ? this.kneesA : this.kneesB).push(knee);
            }
            if (name.startsWith("Tail ")) this.tails.push(o);
            if (name === "Hover") this.hover = true;
        }
        for (const o of [
            this.body,
            this.head,
            ...this.claws,
            ...this.legsA,
            ...this.legsB,
            ...this.tails,
        ])
            if (o) this.rest.set(o, o.quaternion.clone());
        if (this.dead) this.deathTime = DEATH_TIME;
        this.pose();
    }

    get size(): Size {
        return SIZES[SPECIES[this.species]!] ?? "player";
    }

    /** The damage of its strike, by its size. */
    get damage(): number {
        return Math.round(PLAYER_DAMAGE * SIZE_DAMAGE[this.size]);
    }

    /** Its pace (m/s) next to the commando's, by its size. */
    speed(game: Game): number {
        return game.speed * SIZE_SPEED[this.size];
    }

    /** Whether the ray from o along d (a unit vector) goes through its head. */
    headOnRay(o: THREE.Vector3, d: THREE.Vector3): boolean {
        if (!this.head) return false;
        const head = this.head.localToWorld(scratch.copy(this.headCentre));
        const c = fromThree(head);
        const v = c.sub(o);
        const t = v.dot(d);
        if (t < 0) return false;
        return v.lengthSq() - t * t <= this.headRadius * this.headRadius;
    }

    get dead(): boolean {
        return this.health <= 0;
    }

    /** Hurt, it fights back at once. */
    hurt(damage: number): void {
        if (this.dead) return;
        this.health -= damage;
        if (this.dead) {
            // drops where it stands: no more steps or strikes
            this.moving = 0;
            this.attackTime = -1;
        }
        this.angry = true;
        this.charge();
        this.flash = 0.12;
        this.path = [];
    }

    /** Turns hostile in that role; an ambusher or a pack member heads for its post (a cell). */
    alert(role: Role, post: number, ship: Ship, pack = 0): void {
        this.angry = true;
        this.path = [];
        if (role === "charge" || post < 0) {
            this.charge();
            return;
        }
        this.role = role;
        this.post = post;
        this.toPost = ship.distances(
            post % ship.width,
            Math.trunc(post / ship.width),
            POST_REACH,
        );
        this.waited = 0;
        this.pack = pack;
    }

    /** Attacks now. */
    charge(): void {
        this.role = "charge";
        this.post = -1;
        this.toPost = null;
        this.pack = 0;
    }

    /** Whether it waits where it was sent: in its cover, or near its pack's meeting point. */
    atPost(ship: Ship): boolean {
        if (this.role === "charge" || this.post < 0) return false;
        const px = (this.post % ship.width) + 0.5;
        const py = Math.trunc(this.post / ship.width) + 0.5;
        return (
            Math.hypot(px - this.x, py - this.y) <
            (this.role === "pack" ? 1.2 : 0.15)
        );
    }

    // --- mind -----------------------------------------------------------

    /**
     * Roams, or hunts the player when angry. toPlayer holds the steps from
     * each cell to the player's cell (Ship.distances).
     */
    think(dt: number, game: Game, ship: Ship, toPlayer: number[]): void {
        if (this.dead) return;
        this.cooldown -= dt;
        let goalX = this.x;
        let goalY = this.y;
        const dx = game.playerX - this.x;
        const dy = game.playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const reach = RADIUS + game.playerRadius + 0.55;

        if (this.heavyCooldown > 0 && this.angry) this.heavyCooldown -= dt;
        if (this.attackTime >= 0) {
            // the blow lands if the player is still within reach; the heavy
            // one lunges in first, and hits twice as hard a bit further
            const blow = this.heavy ? HEAVY : LIGHT;
            this.face(dx, dy, dt);
            this.attackTime += dt;
            this.moving = 0;
            const u = this.attackTime / blow.time;
            const close = RADIUS + game.playerRadius + 0.1;
            if (this.heavy && u > 0.35 && u < blow.strikeAt && dist > close) {
                const step = Math.min(dist - close, LUNGE_SPEED * dt);
                game.moveCircle(this, (dx / dist) * step, (dy / dist) * step);
            }
            if (!this.struck && u >= blow.strikeAt) {
                this.struck = true;
                if (this.heavy) Audio.playAt("claw", dist);
                if (dist <= reach + (this.heavy ? 0.6 : 0.3))
                    game.hurtPlayer(this.damage * (this.heavy ? 2 : 1));
            }
            if (u >= 1) this.attackTime = -1;
            return;
        }

        // lying in wait, or gathering with its pack, until the commando comes near
        let planned = false;
        if (this.angry && this.role !== "charge") {
            const ambush = this.role === "ambush";
            this.waited += dt;
            const spotted =
                dist < reach + 1 ||
                (dist < (ambush ? AMBUSH_SPOT : PACK_SPOT) &&
                    ship.sees(this.x, this.y, game.playerX, game.playerY));
            if (
                this.post < 0 ||
                spotted ||
                this.waited > (ambush ? AMBUSH_TIME : PACK_TIME)
            ) {
                if (this.pack) game.packCharge(this.pack);
                else this.charge();
            } else {
                if (this.atPost(ship)) {
                    this.face(dx, dy, dt);
                    this.moving = 0;
                    return;
                }
                goalX = (this.post % ship.width) + 0.5;
                goalY = Math.trunc(this.post / ship.width) + 0.5;
                const here =
                    Math.floor(this.y) * ship.width + Math.floor(this.x);
                if (here !== this.post && this.toPost) {
                    const next = ship.downhill(
                        this.toPost,
                        Math.floor(this.x),
                        Math.floor(this.y),
                    );
                    if (next >= 0) {
                        goalX = (next % ship.width) + 0.5;
                        goalY = Math.trunc(next / ship.width) + 0.5;
                    }
                }
                planned = true;
            }
        }

        if (planned) {
            // on its way to its post
        } else if (this.angry) {
            // the heavy blow when it is ready (lunging in from a bit
            // further), else the quick one
            const heavy = this.heavyCooldown <= 0;
            if (dist <= reach + (heavy ? LUNGE : 0)) {
                this.face(dx, dy, dt);
                this.moving = 0;
                if (
                    this.cooldown <= 0 &&
                    Math.abs(this.angleTo(dx, dy)) < 0.6
                ) {
                    if (!heavy) Audio.playAt("claw", dist);
                    this.heavy = heavy;
                    if (heavy) this.heavyCooldown = heavyCooldown();
                    this.attackTime = 0;
                    this.struck = false;
                    this.cooldown =
                        ATTACK_INTERVAL + (heavy ? HEAVY.time - LIGHT.time : 0);
                }
                return;
            }
            if (
                dist < 6 &&
                ship.raycast(
                    this.x,
                    this.y,
                    1.0,
                    dx / dist,
                    dy / dist,
                    0,
                    dist,
                ) >=
                    dist - 0.01
            ) {
                goalX = game.playerX;
                goalY = game.playerY;
            } else {
                const next = ship.downhill(
                    toPlayer,
                    Math.floor(this.x),
                    Math.floor(this.y),
                );
                if (next >= 0) {
                    goalX = (next % ship.width) + 0.5;
                    goalY = Math.trunc(next / ship.width) + 0.5;
                }
            }
        } else {
            if (this.path.length === 0) {
                this.wait -= dt;
                if (this.wait <= 0) {
                    this.pickWalk(ship);
                    this.wait = 0.5 + Math.random() * 2.5;
                }
            }
            const cell = this.path[0];
            if (cell !== undefined) {
                goalX = (cell % ship.width) + 0.5;
                goalY = Math.trunc(cell / ship.width) + 0.5;
                if (
                    Math.abs(goalX - this.x) < 0.15 &&
                    Math.abs(goalY - this.y) < 0.15
                )
                    this.path.shift();
            }
        }

        const gx = goalX - this.x;
        const gy = goalY - this.y;
        const len = Math.sqrt(gx * gx + gy * gy);
        if (len < 0.05) {
            this.moving = 0;
            return;
        }
        this.face(gx, gy, dt);
        const step = Math.min(len, this.speed(game) * dt);
        const moved = game.moveCircle(
            this,
            (gx / len) * step,
            (gy / len) * step,
        );
        this.moving = moved / (this.speed(game) * dt);
        // bumped into someone: go elsewhere
        if (moved < step * 0.2 && !this.angry) this.path = [];
    }

    /** A walk to a random cell nearby, along the cells leading there. */
    private pickWalk(ship: Ship): void {
        const cx = Math.floor(this.x);
        const cy = Math.floor(this.y);
        const dist = ship.distances(cx, cy, 9);
        const cells: number[] = [];
        dist.forEach((d, i) => {
            if (d >= 3) cells.push(i);
        });
        if (cells.length === 0) return;
        const goal = cells[Math.floor(Math.random() * cells.length)]!;
        // walk back from the goal down to here
        const back = ship.distances(
            goal % ship.width,
            Math.trunc(goal / ship.width),
            12,
        );
        this.path = [];
        let cell = cy * ship.width + cx;
        for (let i = 0; i < 30; i++) {
            cell = ship.downhill(
                back,
                cell % ship.width,
                Math.trunc(cell / ship.width),
            );
            if (cell < 0) break;
            this.path.push(cell);
            if (cell === goal) break;
        }
    }

    private angleTo(dx: number, dy: number): number {
        return wrapAngle(Math.atan2(dx, -dy) - this.angle);
    }

    private face(dx: number, dy: number, dt: number): void {
        // turning at most TURN_SPEED, easing in at the end
        const turn = this.angleTo(dx, dy) * Math.min(1, dt * 12);
        const most = TURN_SPEED * dt;
        this.angle += THREE.MathUtils.clamp(turn, -most, most);
    }

    // --- animation ------------------------------------------------------

    update(dt: number): void {
        if (this.flash > 0) this.flash -= dt;
        if (this.dead) {
            // lies still: only its fall goes on
            this.deathTime = Math.min(DEATH_TIME, this.deathTime + dt);
        } else {
            this.time += dt;
            // steps start and stop softly; a faster one takes quicker steps
            this.gait = easeGait(this.gait, this.moving, dt);
            this.walk += dt * 9 * this.gait * SIZE_SPEED[this.size];
        }
        this.pose();
    }

    /** Poses the joint turned by the angles (the game's) from its rest. */
    private turn(
        o: THREE.Object3D | null | undefined,
        ax: number,
        ay: number,
        az: number,
    ): void {
        if (!o) return;
        const rest = this.rest.get(o);
        if (!rest) return;
        o.quaternion.copy(rest).multiply(jointRotation(ax, ay, az, delta));
    }

    /** Bends a knee or an elbow beyond its rest. */
    private bend(b: Bend | null | undefined, angle: number): void {
        if (b) bendJoint(b.joint, b.rest, b.axis, angle * b.scale);
    }

    private pose(): void {
        place(this.obj, this.x, this.y, 0, this.angle);
        const m = motion({
            time: this.time,
            walk: this.walk,
            gait: this.gait,
            attackTime: this.attackTime,
            heavy: this.heavy,
            arms: this.claws.length,
            hover: this.hover,
        });

        for (const l of this.legsA) this.turn(l, m.hips, 0, 0);
        for (const l of this.legsB) this.turn(l, -m.hips, 0, 0);
        for (const k of this.kneesA) this.bend(k, m.kneeA);
        for (const k of this.kneesB) this.bend(k, m.kneeB);
        this.tails.forEach((t, k) => {
            this.turn(t, 0, 0, m.tail(k));
        });
        this.claws.forEach((claw, i) => {
            const arm = m.arms[i]!;
            this.turn(claw, arm.swing, 0, 0);
            this.bend(this.elbows[i], arm.bend);
        });
        this.turn(this.head, m.nod, 0, m.look);
        this.turn(this.body, m.lean, m.roll, 0);
        this.body.position.z = this.bodyZ + m.rise;

        if (this.deathTime > 0) {
            // keels over to its side and sinks, limbs going slack
            const u = this.deathTime / DEATH_TIME;
            const fall = Math.min(1, u * 1.6);
            this.turn(this.body, 0, (fall * fall * Math.PI) / 2, 0);
            this.body.position.z = this.bodyZ * (1 - 0.55 * fall) - 0.15 * u;
            this.claws.forEach((c, i) => {
                this.turn(c, -0.8 * fall, 0, 0);
                this.bend(this.elbows[i], 0.4 * fall);
            });
        }

        const f = this.flash > 0 ? 2.6 : 1.0;
        for (const mat of this.materials) mat.color.setScalar(f);
    }

    getState(): AlienData {
        return {
            species: this.species,
            x: this.x,
            y: this.y,
            angle: this.angle,
            health: this.health,
            angry: this.angry,
        };
    }
}
