import * as THREE from "three";
import { type Castle, facing } from "./castle";
import type { Game } from "./game";
import {
    easeGait,
    HEAVY,
    heavyCooldown,
    LIGHT,
    type Limb,
    motion,
} from "./motion";

/**
 * One of the ten vampires and minions in the castle: its mind and the pose
 * of its joints (see blender-scripts/creatures.py for their names), which
 * the view applies to its model (res/gothic-<kind>.glb). They roam the
 * castle aimlessly, each on its own, until the hunter hurts them; then they
 * hunt the hunter and strike.
 */

export const KINDS = [
    "vampire",
    "bride",
    "nosferatu",
    "ghoul",
    "zombie",
    "werewolf",
    "bat",
    "rat",
    "hunchback",
    "fiend",
];
/** The starting health of one the size of the player (see startHealth). */
const START_HEALTH = 300;
/** For walking: fits through the chamber doors. */
export const RADIUS = 0.35;
/** Seconds after a blow before the next. */
const ATTACK_INTERVAL = 1.2;
/** The heavy blow lunges in from this much beyond its reach (m), this fast (m/s). */
const LUNGE = 0.8;
const LUNGE_SPEED = 4;
/** The sound of a blow. */
const STRIKE_SOUND = "claw";
const DEATH_TIME = 1.1;
const TURN_SPEED = 8;
/** Lying in wait, it springs out when the hunter comes this near in sight. */
const AMBUSH_SPOT = 5;
/** Gathering, the pack charges when the hunter comes this near in sight. */
const PACK_SPOT = 7;
/** Seconds (counted from the alert, the way there included) before an ambusher or a pack attacks anyway. */
const AMBUSH_TIME = 30;
const PACK_TIME = 20;
/** Steps an ambusher or a pack member may go to its post, across the map. */
export const POST_REACH = 100;

/**
 * What a hostile monster does: attack at once, lie in wait in a cover the
 * hunter can't see, or gather with its pack at a hidden spot and charge
 * together.
 */
export type Role = "charge" | "ambush" | "pack";

/** The hunter's pace (SPEED in game.ts). */
const SPEED = 4;
/** The damage of the hunter's revolver (REVOLVER_DAMAGE in game.ts). */
const PLAYER_DAMAGE = 40;
/**
 * How big a creature is next to the hunter: a small one strikes for a
 * quarter of the revolver's damage and moves twice as fast as the hunter, one
 * of the hunter's size strikes as hard as the revolver and moves as fast, and
 * a big one strikes twice as hard at half the pace.
 */
export type Size = "small" | "player" | "big";
const SIZE_DAMAGE: Record<Size, number> = { small: 0.25, player: 1, big: 2 };
const SIZE_SPEED: Record<Size, number> = { small: 2, player: 1, big: 0.5 };
/** A small one starts with half the health, a big one with double. */
const SIZE_HEALTH: Record<Size, number> = { small: 0.5, player: 1, big: 2 };
/** The size of each kind, measured against the hunter's 1.8 m. */
const SIZES: Record<string, Size> = {
    // small
    rat: "small",
    bat: "small",
    ghoul: "small",
    // about the size of the player
    vampire: "player",
    bride: "player",
    nosferatu: "player",
    zombie: "player",
    hunchback: "player",
    // big
    werewolf: "big",
    fiend: "big",
};

/** The health a kind starts with, by its size. */
export function startHealth(kind: number): number {
    const size = SIZES[KINDS[kind]!] ?? "player";
    return START_HEALTH * SIZE_HEALTH[size];
}
const PLAYER_RADIUS = 0.3;

export function wrap(a: number): number {
    const tau = Math.PI * 2;
    return ((((a + Math.PI) % tau) + tau) % tau) - Math.PI;
}

/** The turns (radians around their own X, Y and Z) of the joints and the rise of the body. */
export interface Pose {
    /** LegA hips swing by this, LegB the opposite way (see motion.ts). */
    legs: number;
    /** The knees of LegA and of LegB bend further by these. */
    kneeA: number;
    kneeB: number;
    /** Each arm, the right one first. */
    arms: Limb[];
    head: THREE.Vector3;
    body: THREE.Vector3;
    /** Added to the body's rest height, after multiplying that by sink. */
    rise: number;
    sink: number;
    /** The sway of tail segment k. */
    tail: (k: number) => number;
    wing: number;
}

export class Monster {
    /** Turn of the model around three.js' Y axis; it faces (sin a, cos a) on the map. */
    angle: number;
    angry = false;
    /** Size for the shots: a standing cylinder, measured from the model. */
    hitRadius = 0.45;
    height = 1.8;
    /** Its head for headshots: a ball here, set by the view. */
    readonly headAt = new THREE.Vector3();
    /** 0 until the view has placed the head. */
    headRadius = 0;
    time = Math.random() * 10;
    walk = 0;
    moving = 0;
    /** The pace eased (see easeGait), for the animation. */
    gait = 0;
    attackTime = -1;
    /** Whether the blow under way is the heavy one. */
    heavy = false;
    private heavyCooldown = heavyCooldown() / 2;
    private struck = false;
    private cooldown = 0;
    deathTime: number;
    flash = 0;
    /** Burning from the flamethrower: seconds of fire left on it. */
    burning = 0;
    /** Once hostile: attacking, lying in wait, or gathering with its pack. */
    role: Role = "charge";
    /** Where it waits: its cover, or its pack's meeting point. */
    post: { x: number; y: number } | null = null;
    private toPost: number[] | null = null;
    private waited = 0;
    /** Its pack (0: none). */
    pack = 0;
    private path: { x: number; y: number }[] = [];
    private wait = Math.random() * 2;

    constructor(
        readonly kind: number,
        public x: number,
        public y: number,
        angle: number,
        public health: number,
    ) {
        this.angle = angle;
        this.deathTime = health <= 0 ? DEATH_TIME : 0;
    }

    get size(): Size {
        return SIZES[KINDS[this.kind]!] ?? "player";
    }

    /** The damage of its strike, by its size. */
    get damage(): number {
        return Math.round(PLAYER_DAMAGE * SIZE_DAMAGE[this.size]);
    }

    /** Its pace (m/s), by its size. */
    get speed(): number {
        return SPEED * SIZE_SPEED[this.size];
    }

    /** Whether the ray from o along d (a unit vector) goes through its head. */
    headOnRay(o: THREE.Vector3, d: THREE.Vector3): boolean {
        if (this.headRadius <= 0) return false;
        const v = this.headAt.clone().sub(o);
        const t = v.dot(d);
        if (t < 0) return false;
        return v.lengthSq() - t * t <= this.headRadius * this.headRadius;
    }

    dead(): boolean {
        return this.health <= 0;
    }

    /** Hurt, it fights back at once. */
    hurt(damage: number): void {
        if (this.dead()) return;
        this.health -= damage;
        if (this.dead()) {
            // drops where it stands: no more steps or strikes
            this.moving = 0;
            this.attackTime = -1;
        }
        this.angry = true;
        this.charge();
        this.flash = 0.12;
        this.path = [];
    }

    /** Turns hostile in that role; an ambusher or a pack member heads for its post. */
    alert(
        role: Role,
        post: { x: number; y: number } | null,
        castle: Castle,
        pack = 0,
    ): void {
        this.angry = true;
        this.path = [];
        if (role === "charge" || !post) {
            this.charge();
            return;
        }
        this.role = role;
        this.post = post;
        this.toPost = castle.distances(post.x, post.y, POST_REACH);
        this.waited = 0;
        this.pack = pack;
    }

    /** Attacks now. */
    charge(): void {
        this.role = "charge";
        this.post = null;
        this.toPost = null;
        this.pack = 0;
    }

    /** Whether it waits where it was sent: in its cover, or near its pack's meeting point. */
    get atPost(): boolean {
        if (this.role === "charge" || !this.post) return false;
        const d = Math.hypot(
            this.post.x + 0.5 - this.x,
            this.post.y + 0.5 - this.y,
        );
        return d < (this.role === "pack" ? 1.2 : 0.15);
    }

    // --- mind -----------------------------------------------------------

    /**
     * Roams, or hunts the hunter when angry. toPlayer holds the steps from
     * each cell to the hunter's cell (Castle.distances).
     */
    think(dt: number, game: Game, castle: Castle, toPlayer: number[]): void {
        if (this.dead()) return;
        this.cooldown -= dt;
        let goalX = this.x;
        let goalY = this.y;
        const dx = game.playerX - this.x;
        const dy = game.playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const reach = RADIUS + PLAYER_RADIUS + 0.55;

        if (this.heavyCooldown > 0 && this.angry) this.heavyCooldown -= dt;
        if (this.attackTime >= 0) {
            // the blow lands if the hunter is still within reach; the heavy
            // one lunges in first, and hits twice as hard a bit further
            const blow = this.heavy ? HEAVY : LIGHT;
            this.face(dx, dy, dt);
            this.attackTime += dt;
            this.moving = 0;
            const u = this.attackTime / blow.time;
            const close = RADIUS + PLAYER_RADIUS + 0.1;
            if (this.heavy && u > 0.35 && u < blow.strikeAt && dist > close) {
                const step = Math.min(dist - close, LUNGE_SPEED * dt);
                game.moveMonster(
                    this,
                    (dx / dist) * step,
                    (dy / dist) * step,
                    castle,
                );
            }
            const strike = !this.struck && u >= blow.strikeAt;
            if (strike) this.struck = true;
            if (u >= 1) this.attackTime = -1;
            if (strike && this.heavy)
                game.soundAt(STRIKE_SOUND, this.x, this.y, 1);
            if (strike && dist <= reach + (this.heavy ? 0.6 : 0.3))
                game.hurtPlayer(this.damage * (this.heavy ? 2 : 1));
            return;
        }

        // lying in wait, or gathering with its pack, until the hunter comes near
        let planned = false;
        if (this.angry && this.role !== "charge") {
            const ambush = this.role === "ambush";
            this.waited += dt;
            const spotted =
                dist < reach + 1 ||
                (dist < (ambush ? AMBUSH_SPOT : PACK_SPOT) &&
                    castle.sees(this.x, this.y, game.playerX, game.playerY));
            const post = this.post;
            if (
                !post ||
                spotted ||
                this.waited > (ambush ? AMBUSH_TIME : PACK_TIME)
            ) {
                if (this.pack) game.packCharge(this.pack);
                else this.charge();
            } else {
                if (this.atPost) {
                    this.face(dx, dy, dt);
                    this.moving = 0;
                    return;
                }
                goalX = post.x + 0.5;
                goalY = post.y + 0.5;
                const cx = Math.floor(this.x);
                const cy = Math.floor(this.y);
                if ((cx !== post.x || cy !== post.y) && this.toPost) {
                    const next = castle.downhill(this.toPost, cx, cy);
                    if (next) {
                        goalX = next.x + 0.5;
                        goalY = next.y + 0.5;
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
                    if (!heavy) game.soundAt(STRIKE_SOUND, this.x, this.y, 0.8);
                    this.heavy = heavy;
                    if (heavy) this.heavyCooldown = heavyCooldown();
                    this.attackTime = 0;
                    this.struck = false;
                    this.cooldown =
                        ATTACK_INTERVAL + (heavy ? HEAVY.time - LIGHT.time : 0);
                }
                return;
            }
            const clear =
                dist < 6 &&
                castle.raycast(
                    new THREE.Vector3(this.x, this.y, 1),
                    new THREE.Vector3(dx / dist, dy / dist, 0),
                    dist,
                ) >=
                    dist - 0.01;
            if (clear) {
                goalX = game.playerX;
                goalY = game.playerY;
            } else {
                const next = castle.downhill(
                    toPlayer,
                    Math.floor(this.x),
                    Math.floor(this.y),
                );
                if (next) {
                    goalX = next.x + 0.5;
                    goalY = next.y + 0.5;
                }
            }
        } else {
            if (this.path.length === 0) {
                this.wait -= dt;
                if (this.wait <= 0) {
                    this.pickWalk(castle);
                    this.wait = 0.5 + Math.random() * 2.5;
                }
            }
            const cell = this.path[0];
            if (cell) {
                goalX = cell.x + 0.5;
                goalY = cell.y + 0.5;
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
        const step = Math.min(len, this.speed * dt);
        const moved = game.moveMonster(
            this,
            (gx / len) * step,
            (gy / len) * step,
            castle,
        );
        this.moving = moved / (this.speed * dt);
        // bumped into someone: go elsewhere
        if (moved < step * 0.2 && !this.angry) this.path = [];
    }

    /** A walk to a random cell nearby, along the cells leading there. */
    private pickWalk(castle: Castle): void {
        const cx = Math.floor(this.x);
        const cy = Math.floor(this.y);
        const dist = castle.distances(cx, cy, 9);
        const cells: number[] = [];
        dist.forEach((d, i) => {
            if (d >= 3) cells.push(i);
        });
        if (cells.length === 0) return;
        const goalCell = cells[Math.floor(Math.random() * cells.length)]!;
        const goal = {
            x: goalCell % castle.width,
            y: Math.trunc(goalCell / castle.width),
        };
        // walk back from the goal down to here
        const back = castle.distances(goal.x, goal.y, 12);
        this.path = [];
        let cell = { x: cx, y: cy };
        for (let i = 0; i < 30; i++) {
            const next = castle.downhill(back, cell.x, cell.y);
            if (!next) break;
            cell = next;
            this.path.push(cell);
            if (cell.x === goal.x && cell.y === goal.y) break;
        }
    }

    private angleTo(dx: number, dy: number): number {
        return wrap(facing(dx, dy) - this.angle);
    }

    private face(dx: number, dy: number, dt: number): void {
        // turning at most TURN_SPEED, easing in at the end
        const most = TURN_SPEED * dt;
        const turn = this.angleTo(dx, dy) * Math.min(dt * 12, 1);
        this.angle += THREE.MathUtils.clamp(turn, -most, most);
    }

    // --- animation ------------------------------------------------------

    update(dt: number): void {
        if (this.dead()) {
            // lies still: only its fall goes on
            this.deathTime = Math.min(this.deathTime + dt, DEATH_TIME);
        } else {
            this.time += dt;
            // steps start and stop softly; a faster one takes quicker steps
            this.gait = easeGait(this.gait, this.moving, dt);
            this.walk += dt * 9 * this.gait * SIZE_SPEED[this.size];
        }
        this.flash = Math.max(this.flash - dt, 0);
        this.burning = Math.max(this.burning - dt, 0);
    }

    pose(arms: number, hover: boolean): Pose {
        const m = motion({
            time: this.time,
            walk: this.walk,
            gait: this.gait,
            attackTime: this.attackTime,
            heavy: this.heavy,
            arms,
            hover,
        });
        const pose: Pose = {
            legs: m.hips,
            kneeA: m.kneeA,
            kneeB: m.kneeB,
            arms: m.arms,
            head: new THREE.Vector3(m.nod, m.look, 0),
            body: new THREE.Vector3(m.lean, 0, m.roll),
            rise: m.rise,
            sink: 1,
            tail: m.tail,
            wing: m.wing,
        };
        if (this.deathTime > 0) {
            // keels over to its side and sinks, limbs going slack
            const u = this.deathTime / DEATH_TIME;
            const fall = Math.min(u * 1.6, 1);
            pose.body = new THREE.Vector3(0, 0, (-fall * fall * Math.PI) / 2);
            pose.sink = 1 - 0.55 * fall;
            pose.rise = -0.15 * u;
            pose.arms = pose.arms.map(() => ({
                swing: -0.8 * fall,
                bend: 0.4 * fall,
            }));
        }
        return pose;
    }

    /** Kind, position, turn, health and whether it hunts the hunter. */
    saveString(): string {
        return `${this.kind} ${this.x} ${this.y} ${this.angle} ${this.health} ${this.angry ? 1 : 0}`;
    }
}
