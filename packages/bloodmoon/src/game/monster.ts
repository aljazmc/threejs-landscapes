import * as THREE from "three";
import { type Castle, facing } from "./castle";
import type { Game } from "./game";

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
export const START_HEALTH = 300;
export const DAMAGE = 50;
/** For walking: fits through the chamber doors. */
export const RADIUS = 0.35;
const ATTACK_TIME = 0.7;
/** Of the attack, when the blow lands. */
const STRIKE_AT = 0.4;
const ATTACK_INTERVAL = 1.2;
const DEATH_TIME = 1.1;
const TURN_SPEED = 8;
/** Lying in wait, it springs out when the hunter comes this near in sight. */
const AMBUSH_SPOT = 5;
/** Gathering, the pack charges when the hunter comes this near in sight. */
const PACK_SPOT = 7;
/** Seconds of waiting before an ambusher or a pack attacks anyway. */
const AMBUSH_TIME = 15;
const PACK_TIME = 8;

/**
 * What a hostile monster does: attack at once, lie in wait in a cover the
 * hunter can't see, or gather with its pack at a hidden spot and charge
 * together.
 */
export type Role = "charge" | "ambush" | "pack";

const SPEED = 4;
const PLAYER_RADIUS = 0.3;

export function wrap(a: number): number {
    const tau = Math.PI * 2;
    return ((((a + Math.PI) % tau) + tau) % tau) - Math.PI;
}

/** The turns (radians around their own X, Y and Z) of the joints and the rise of the body. */
export interface Pose {
    /** LegA joints swing forward by this, LegB back. */
    legs: number;
    arms: number[];
    head: THREE.Vector3;
    body: THREE.Vector3;
    /** Added to the body's rest height, after multiplying that by sink. */
    rise: number;
    sink: number;
    tailTime: number;
    wing: number;
}

export class Monster {
    /** Turn of the model around three.js' Y axis; it faces (sin a, cos a) on the map. */
    angle: number;
    angry = false;
    /** Size for the shots: a standing cylinder, measured from the model. */
    hitRadius = 0.45;
    height = 1.8;
    time = Math.random() * 10;
    walk = 0;
    moving = 0;
    attackTime = -1;
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

    dead(): boolean {
        return this.health <= 0;
    }

    /** Hurt, it fights back at once. */
    hurt(damage: number): void {
        if (this.dead()) return;
        this.health -= damage;
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
        this.toPost = castle.distances(post.x, post.y, 40);
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

        if (this.attackTime >= 0) {
            // the blow lands if the hunter is still within reach
            this.face(dx, dy, dt);
            this.attackTime += dt;
            this.moving = 0;
            const strike =
                !this.struck && this.attackTime >= ATTACK_TIME * STRIKE_AT;
            if (strike) this.struck = true;
            if (this.attackTime >= ATTACK_TIME) this.attackTime = -1;
            if (strike && dist <= reach + 0.3) game.hurtPlayer(DAMAGE);
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
            if (dist <= reach) {
                this.face(dx, dy, dt);
                this.moving = 0;
                if (
                    this.cooldown <= 0 &&
                    Math.abs(this.angleTo(dx, dy)) < 0.6
                ) {
                    game.soundAt("claw", this.x, this.y, 1);
                    this.attackTime = 0;
                    this.struck = false;
                    this.cooldown = ATTACK_INTERVAL;
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
        const step = Math.min(len, SPEED * dt);
        const moved = game.moveMonster(
            this,
            (gx / len) * step,
            (gy / len) * step,
            castle,
        );
        this.moving = moved / (SPEED * dt);
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
        const most = TURN_SPEED * dt;
        this.angle += THREE.MathUtils.clamp(this.angleTo(dx, dy), -most, most);
    }

    // --- animation ------------------------------------------------------

    update(dt: number): void {
        this.time += dt;
        if (this.dead())
            this.deathTime = Math.min(this.deathTime + dt, DEATH_TIME);
        this.walk += dt * 9 * this.moving;
        this.flash = Math.max(this.flash - dt, 0);
        this.burning = Math.max(this.burning - dt, 0);
    }

    pose(arms: number, hover: boolean): Pose {
        const swing = Math.sin(this.walk) * 0.55 * Math.min(this.moving, 1);
        const bob = hover
            ? 0.12 * Math.sin(this.time * 2.2)
            : Math.abs(Math.cos(this.walk)) * 0.05 * this.moving;
        // arms: raised forward and up, then swung down, the second a bit later
        const armTurns: number[] = [];
        for (let i = 0; i < arms; i++) {
            if (this.attackTime >= 0) {
                const u = this.attackTime / ATTACK_TIME - i * 0.12;
                armTurns.push(
                    u < 0
                        ? 0
                        : u < STRIKE_AT
                          ? (-2.0 * u) / STRIKE_AT
                          : -2.0 + 2.6 * Math.min((u - STRIKE_AT) / 0.25, 1),
                );
            } else
                armTurns.push(
                    Math.sin(this.time * 1.7 + i) * 0.08 - swing * 0.3,
                );
        }
        const lean =
            this.attackTime >= 0
                ? Math.sin(
                      Math.min(this.attackTime / ATTACK_TIME, 1) * Math.PI,
                  ) * (arms === 0 ? 0.6 : 0.25)
                : 0;
        const pose: Pose = {
            legs: swing,
            arms: armTurns,
            head: new THREE.Vector3(lean, Math.sin(this.time * 0.8) * 0.25, 0),
            body: new THREE.Vector3(lean * 0.5, 0, 0),
            rise: bob,
            sink: 1,
            tailTime: this.time,
            wing: Math.sin(this.time * 9) * 0.5,
        };
        if (this.deathTime > 0) {
            // keels over to its side and sinks
            const u = this.deathTime / DEATH_TIME;
            const fall = Math.min(u * 1.6, 1);
            pose.body = new THREE.Vector3(0, 0, (-fall * fall * Math.PI) / 2);
            pose.sink = 1 - 0.55 * fall;
            pose.rise = -0.15 * u;
            pose.arms = pose.arms.map(() => -0.8 * fall);
        }
        return pose;
    }

    /** Kind, position, turn, health and whether it hunts the hunter. */
    saveString(): string {
        return `${this.kind} ${this.x} ${this.y} ${this.angle} ${this.health} ${this.angry ? 1 : 0}`;
    }
}
