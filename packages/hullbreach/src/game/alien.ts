import * as THREE from "three";
import { joint, jointRotation, joints, nodeName, place } from "../space";
import { Audio } from "./audio";
import type { Game } from "./game";
import * as Gfx from "./gfx";
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
export const HEALTH = 300;
export const DAMAGE = 50;
/** For walking: fits through the cabin doors. */
export const RADIUS = 0.35;
const ATTACK_TIME = 0.7;
/** Of the attack, when the claws land. */
const STRIKE_AT = 0.4;
const ATTACK_INTERVAL = 1.2;
const DEATH_TIME = 1.1;
const TURN_SPEED = 8;
/** Lying in wait, it springs out when the commando comes this near in sight. */
const AMBUSH_SPOT = 5;
/** Gathering, the pack charges when the commando comes this near in sight. */
const PACK_SPOT = 7;
/** Seconds of waiting before an ambusher or a pack attacks anyway. */
const AMBUSH_TIME = 15;
const PACK_TIME = 8;

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
    private readonly claws: THREE.Object3D[] = [];
    private readonly legsA: THREE.Object3D[] = [];
    private readonly legsB: THREE.Object3D[] = [];
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
    private attackTime = -1;
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
        for (const name of ["ClawR", "ClawL"]) {
            const claw = joint(this.obj, name);
            if (claw) this.claws.push(claw);
        }
        for (const o of joints(this.obj)) {
            const name = nodeName(o);
            if (name.startsWith("LegA ")) this.legsA.push(o);
            if (name.startsWith("LegB ")) this.legsB.push(o);
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

    get dead(): boolean {
        return this.health <= 0;
    }

    /** Hurt, it fights back at once. */
    hurt(damage: number): void {
        if (this.dead) return;
        this.health -= damage;
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
            40,
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

        if (this.attackTime >= 0) {
            // the strike lands if the player is still within reach
            this.face(dx, dy, dt);
            this.attackTime += dt;
            if (!this.struck && this.attackTime >= ATTACK_TIME * STRIKE_AT) {
                this.struck = true;
                if (dist <= reach + 0.3) game.hurtPlayer(DAMAGE);
            }
            if (this.attackTime >= ATTACK_TIME) this.attackTime = -1;
            this.moving = 0;
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
            if (dist <= reach) {
                this.face(dx, dy, dt);
                this.moving = 0;
                if (
                    this.cooldown <= 0 &&
                    Math.abs(this.angleTo(dx, dy)) < 0.6
                ) {
                    Audio.playAt("claw", dist);
                    this.attackTime = 0;
                    this.struck = false;
                    this.cooldown = ATTACK_INTERVAL;
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
        const step = Math.min(len, game.speed * dt);
        const moved = game.moveCircle(
            this,
            (gx / len) * step,
            (gy / len) * step,
        );
        this.moving = moved / (game.speed * dt);
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
        const turn = this.angleTo(dx, dy);
        const most = TURN_SPEED * dt;
        this.angle += THREE.MathUtils.clamp(turn, -most, most);
    }

    // --- animation ------------------------------------------------------

    update(dt: number): void {
        this.time += dt;
        if (this.dead)
            this.deathTime = Math.min(DEATH_TIME, this.deathTime + dt);
        this.walk += dt * 9 * this.moving;
        if (this.flash > 0) this.flash -= dt;
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

    private pose(): void {
        place(this.obj, this.x, this.y, 0, this.angle);

        const swing = Math.sin(this.walk) * 0.55 * Math.min(1, this.moving);
        for (const l of this.legsA) this.turn(l, swing, 0, 0);
        for (const l of this.legsB) this.turn(l, -swing, 0, 0);
        this.tails.forEach((t, i) => {
            this.turn(t, 0, 0, Math.sin(this.time * 3 + i * 0.7) * 0.18);
        });
        const bob = this.hover
            ? 0.12 * Math.sin(this.time * 2.2)
            : Math.abs(Math.cos(this.walk)) * 0.05 * this.moving;
        this.body.position.z = this.bodyZ + bob;

        // claws: raised forward and up, then slashed down, the second a bit later
        let lean = 0;
        this.claws.forEach((claw, i) => {
            let a = 0;
            if (this.attackTime >= 0) {
                const u = this.attackTime / ATTACK_TIME - i * 0.12;
                a =
                    u < 0
                        ? 0
                        : u < STRIKE_AT
                          ? (-2.0 * u) / STRIKE_AT
                          : -2.0 + 2.6 * Math.min(1, (u - STRIKE_AT) / 0.25);
                lean = Math.max(
                    lean,
                    Math.sin(
                        Math.min(1, this.attackTime / ATTACK_TIME) * Math.PI,
                    ) * 0.25,
                );
            } else a = Math.sin(this.time * 1.7 + i) * 0.08 - swing * 0.3;
            this.turn(claw, a, 0, 0);
        });
        this.turn(this.head, lean, 0, Math.sin(this.time * 0.8) * 0.25);
        this.turn(this.body, lean * 0.5, 0, 0);

        if (this.deathTime > 0) {
            // keels over to its side and sinks
            const u = this.deathTime / DEATH_TIME;
            const fall = Math.min(1, u * 1.6);
            this.turn(this.body, 0, (fall * fall * Math.PI) / 2, 0);
            this.body.position.z = this.bodyZ * (1 - 0.55 * fall) - 0.15 * u;
            for (const c of this.claws) this.turn(c, -0.8 * fall, 0, 0);
        }

        const f = this.flash > 0 ? 2.6 : 1.0;
        for (const m of this.materials) m.color.setScalar(f);
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
