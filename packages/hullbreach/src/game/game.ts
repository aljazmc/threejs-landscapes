import * as THREE from "three";
import { fromThree, joint, jointRotation, toThree, vecToThree } from "../space";
import {
    Alien,
    type AlienData,
    HEALTH as ALIEN_HEALTH,
    RADIUS as ALIEN_RADIUS,
    SPECIES,
} from "./alien";
import { Audio } from "./audio";
import { Flare, Fx } from "./fx";
import * as Gfx from "./gfx";
import { MOUSE_LEFT } from "./input";
import { Lang } from "./lang";
import type { Main } from "./main";
import * as Res from "./res";
import { Screen } from "./screen";
import type { Ship } from "./ship";
import * as Ui from "./ui";

export interface SaveData {
    player: {
        x: number;
        y: number;
        yaw: number;
        pitch: number;
        health: number;
        weapon: number;
    };
    aliens: AlienData[];
}

interface Grenade {
    obj: THREE.Object3D;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
}

export const PLAYER_HEALTH = 500;
export const SPEED = 4;
export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.8;
const EYE = 1.65;
export const LASER_DAMAGE = 30;
const LASER_INTERVAL = 0.5;
const LASER_RANGE = 80;
const GRENADE_DAMAGE = 500;
const GRENADE_INTERVAL = 3;
const BLAST_RADIUS = 5 * PLAYER_HEIGHT;
const GRENADE_SPEED = 24;
const GRENADE_GRAVITY = 5;
/** Radians per pixel. */
const MOUSE_SPEED = 0.0025;
const MAX_PITCH = 1.45;
const PATH_TIME = 0.25;

// touchscreens, in the 960x540 coordinates of the HUD
/** Radians per HUD pixel a finger drags on the right half. */
const TOUCH_LOOK_SPEED = 0.006;
/** How far the joystick's knob goes from where the thumb landed. */
const STICK_RADIUS = 70;
const STICK_DEAD_ZONE = 0.15;
/** Where the joystick waits for the thumb. */
const STICK_HOME = { x: 170, y: Ui.HEIGHT - 205 };
const FIRE_BUTTON = { x: Ui.WIDTH - 110, y: Ui.HEIGHT - 205, r: 56 };
const PAUSE_BUTTON = { x: Ui.WIDTH / 2 - 26, y: 8, w: 52, h: 36 };

const W = Ui.WIDTH;
const H = Ui.HEIGHT;
const SHADOW = { dx: 1, dy: 1, color: 0x000000, alpha: 0.8 };
const GRENADE_NOSE = new THREE.Vector3(0, -1, 0);

const basis = new THREE.Matrix4();
const drumTurnQ = new THREE.Quaternion();

/**
 * The space commando against the ten aliens on board, in first person.
 * Distances are in meters, in the game's coordinates (see space.ts). The
 * commando walks 4 m/s like the aliens, sees from 1.65 m and fires the
 * laser gun (hits the first thing in line) or the grenade launcher
 * (explodes where the grenade hits; the alien hit takes the full damage,
 * the others around it less with the distance, up to 5 commando heights
 * away). Killing all aliens wins.
 */
export class Game extends Screen {
    readonly speed = SPEED;
    readonly playerRadius = PLAYER_RADIUS;

    playerX = 0;
    playerY = 0;
    /** The commando looks along (cos yaw, sin yaw). */
    yaw = 0;
    pitch = 0;
    health = PLAYER_HEALTH;
    /** 0: laser gun, 1: grenade launcher. */
    weapon = 0;
    readonly reload = [0, 0];

    private readonly ship: Ship;
    private readonly root = new THREE.Group();
    private readonly fx: Fx;
    readonly aliens: Alien[] = [];
    readonly grenades: Grenade[] = [];
    private toPlayer: number[];
    private pathTime = 0;
    private packs = 0;

    private readonly guns: THREE.Object3D[];
    private readonly drum: THREE.Object3D | null;
    private readonly drumRest = new THREE.Quaternion();
    private drumTurn = 0;
    private switchTime = 0;
    private recoil = 0;
    private stride = 0;
    private shake = 0;
    private time = 0;
    triggerBlocked = true;

    private hurtTime = 0;
    private hitTime = 0;
    /** The joystick's tilt, up to 1 each way: x to the right, y down. */
    private stick = { x: 0, y: 0 };
    private touchFire = false;
    over = false;
    /** performance.now() when the game ended. */
    private overAt = 0;
    private victory = false;

    constructor(main: Main, state?: SaveData) {
        super(main);
        this.ship = main.ship;
        main.scene.add(this.root);
        this.fx = new Fx(this.root, main.camera, main.lights);
        const ship = this.ship;

        if (!state) {
            const start = ship.playerStart;
            this.playerX = start.x;
            this.playerY = start.y;
            const a = (start.angle * Math.PI) / 180;
            this.yaw = Math.atan2(-Math.cos(a), Math.sin(a));
            ship.alienStarts.forEach((s, i) => {
                const alien = new Alien(
                    i % SPECIES.length,
                    s.x,
                    s.y,
                    Math.random() * Math.PI * 2,
                    ALIEN_HEALTH,
                    this.root,
                );
                // if the start is in the way of a wall or prop, the nearest free cell
                if (!ship.circleFree(alien.x, alien.y, ALIEN_RADIUS)) {
                    const cell = ship.nearestFree(alien.x, alien.y);
                    alien.x = (cell % ship.width) + 0.5;
                    alien.y = Math.trunc(cell / ship.width) + 0.5;
                }
                this.aliens.push(alien);
            });
        } else this.setState(state);

        this.guns = [Gfx.model("laser"), Gfx.model("launcher")];
        for (const gun of this.guns) this.root.add(gun);
        this.drum = joint(this.guns[1]!, "Drum");
        if (this.drum) this.drumRest.copy(this.drum.quaternion);
        this.toPlayer = ship.distances(
            Math.floor(this.playerX),
            Math.floor(this.playerY),
        );
        this.updateCamera(0);
    }

    override show(): void {
        this.triggerBlocked = true;
        if (!this.over) {
            if (!this.main.input.touchMode)
                this.main.lockMouse((dx, dy) => this.look(dx, dy));
            Audio.playMusic("combat");
        }
    }

    private look(relX: number, relY: number): void {
        if (this.over) return;
        this.yaw += relX * MOUSE_SPEED;
        this.pitch = THREE.MathUtils.clamp(
            this.pitch - relY * MOUSE_SPEED,
            -MAX_PITCH,
            MAX_PITCH,
        );
    }

    override dispose(): void {
        this.fx.dispose();
        this.root.removeFromParent();
    }

    /** Pauses to the main menu (Esc, or the browser let the mouse go). */
    pause(): void {
        this.main.freeMouse();
        this.main.showMenu("Paused. Play continues the mission.");
    }

    override update(dt: number): void {
        const input = this.main.input;
        this.time += dt;
        this.ship.update(dt);
        if (this.over) {
            for (const a of this.aliens) a.update(dt);
            this.fx.update(dt);
            this.fadeHud(dt);
            // or a tap, by a finger that came down after the end
            const tapped =
                input.touchMode &&
                input.clicks.some((c) => c.startedAt > this.overAt);
            if (input.isPressed("Enter") || input.isPressed("Escape") || tapped)
                this.main.showMenu();
            return;
        }
        if (input.isPressed("Escape")) {
            this.pause();
            return;
        }
        // a click into the view takes the mouse again, without firing
        if (this.touchControls()) return;
        if (
            !input.touchMode &&
            !this.main.mouseLocked &&
            input.isPressed(MOUSE_LEFT)
        ) {
            this.main.lockMouse((dx, dy) => this.look(dx, dy));
            this.triggerBlocked = true;
        }

        this.movePlayer(dt);
        this.updateWeapons(dt);

        this.pathTime -= dt;
        if (this.pathTime <= 0) {
            this.pathTime = PATH_TIME;
            this.toPlayer = this.ship.distances(
                Math.floor(this.playerX),
                Math.floor(this.playerY),
            );
        }
        for (const a of this.aliens) {
            a.think(dt, this, this.ship, this.toPlayer);
            a.update(dt);
        }
        this.updatePacks();
        this.updateGrenades(dt);
        this.fx.update(dt);
        this.updateCamera(dt);
        this.fadeHud(dt);
        this.checkGoals();
    }

    // --- the commando ---------------------------------------------------

    private movePlayer(dt: number): void {
        const input = this.main.input;
        let forward = 0;
        let side = 0;
        if (input.isDown("KeyW") || input.isDown("ArrowUp")) forward += 1;
        if (input.isDown("KeyS") || input.isDown("ArrowDown")) forward -= 1;
        if (input.isDown("KeyD") || input.isDown("ArrowRight")) side += 1;
        if (input.isDown("KeyA") || input.isDown("ArrowLeft")) side -= 1;
        let len = Math.sqrt(forward * forward + side * side);
        // the joystick walks slower when tilted less
        let pace = 1;
        if (len === 0) {
            const tilt = Math.hypot(this.stick.x, this.stick.y);
            if (tilt > STICK_DEAD_ZONE) {
                forward = -this.stick.y;
                side = this.stick.x;
                len = tilt;
                pace = Math.min(1, tilt);
            }
        }
        if (len === 0) {
            this.stride *= 0.9;
            return;
        }
        // right of the view is (-sin yaw, cos yaw), as the camera sees it
        const c = Math.cos(this.yaw);
        const s = Math.sin(this.yaw);
        const dx = ((c * forward - s * side) / len) * SPEED * pace * dt;
        const dy = ((s * forward + c * side) / len) * SPEED * pace * dt;
        if (
            this.placeFree(this.playerX + dx, this.playerY, PLAYER_RADIUS, null)
        )
            this.playerX += dx;
        if (
            this.placeFree(this.playerX, this.playerY + dy, PLAYER_RADIUS, null)
        )
            this.playerY += dy;
        // a footstep at the bottom of each bob of the view
        const step = Math.floor(this.stride / Math.PI);
        this.stride += dt * 10 * pace;
        if (Math.floor(this.stride / Math.PI) !== step)
            Audio.play("step", 0.35);
    }

    /** True when a figure of radius r at (x, y) overlaps no wall, prop, alien nor the player. */
    private placeFree(
        x: number,
        y: number,
        r: number,
        self: Alien | null,
    ): boolean {
        if (!this.ship.circleFree(x, y, r)) return false;
        const px = this.playerX;
        const py = this.playerY;
        if (self) {
            const d = PLAYER_RADIUS + r;
            if ((x - px) * (x - px) + (y - py) * (y - py) < d * d) return false;
        }
        for (const a of this.aliens) {
            if (a === self || a.dead) continue;
            const d = (self ? r : PLAYER_RADIUS) + ALIEN_RADIUS;
            const now = self
                ? (a.x - self.x) * (a.x - self.x) +
                  (a.y - self.y) * (a.y - self.y)
                : (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
            const next = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
            // moving away from someone it already overlaps is allowed
            if (next < d * d && next < now) return false;
        }
        return true;
    }

    /** Moves an alien by (dx, dy), sliding along what is in the way; returns the distance moved. */
    moveCircle(alien: Alien, dx: number, dy: number): number {
        const x0 = alien.x;
        const y0 = alien.y;
        if (this.placeFree(alien.x + dx, alien.y, ALIEN_RADIUS, alien))
            alien.x += dx;
        if (this.placeFree(alien.x, alien.y + dy, ALIEN_RADIUS, alien))
            alien.y += dy;
        return Math.sqrt(
            (alien.x - x0) * (alien.x - x0) + (alien.y - y0) * (alien.y - y0),
        );
    }

    /** How far (m) a point on the floor plan is from the commando. */
    distanceTo(x: number, y: number): number {
        return Math.sqrt(
            (x - this.playerX) * (x - this.playerX) +
                (y - this.playerY) * (y - this.playerY),
        );
    }

    /** An alien hit: it splats, or screeches as it dies. */
    private hurtAlien(a: Alien, damage: number): void {
        const pack = a.pack;
        a.hurt(damage);
        if (pack) this.packCharge(pack);
        this.alertArea(a);
        Audio.playAt(
            a.dead ? "screech" : "splat",
            this.distanceTo(a.x, a.y),
            a.dead ? 0.8 : 0.6,
        );
    }

    // --- the aliens' plans -----------------------------------------------

    /**
     * An alien was hurt: every other one in its room (or hall) still
     * roaming turns hostile. The nearest to the commando attacks at once,
     * two or three of the others gather out of sight to charge together,
     * and the rest lie in wait in covers he can't see on his way.
     */
    private alertArea(hit: Alien): void {
        const ship = this.ship;
        const area = ship.area(Math.floor(hit.x), Math.floor(hit.y));
        const group = this.aliens
            .filter(
                (a) =>
                    a !== hit &&
                    !a.dead &&
                    !a.angry &&
                    ship.area(Math.floor(a.x), Math.floor(a.y)) === area,
            )
            .sort(
                (a, b) => this.distanceTo(a.x, a.y) - this.distanceTo(b.x, b.y),
            );
        const nearest = group.shift();
        if (!nearest) return;
        nearest.alert("charge", -1, ship);
        const taken = new Set<number>();
        if (group.length >= 2) {
            const size = group.length >= 3 && Math.random() < 0.5 ? 3 : 2;
            const pack = group.splice(0, size);
            const id = ++this.packs;
            const leader = pack[0]!;
            const meet = ship.cover(
                leader.x,
                leader.y,
                this.playerX,
                this.playerY,
                taken,
            );
            for (const a of pack) a.alert("pack", meet, ship, id);
        }
        for (const a of group)
            a.alert(
                "ambush",
                ship.cover(a.x, a.y, this.playerX, this.playerY, taken),
                ship,
            );
    }

    /** The pack charges together. */
    packCharge(pack: number): void {
        for (const a of this.aliens) if (a.pack === pack) a.charge();
    }

    /** A pack charges once all of it has gathered. */
    private updatePacks(): void {
        const gathered = new Map<number, boolean>();
        for (const a of this.aliens) {
            if (a.dead || a.pack === 0) continue;
            gathered.set(
                a.pack,
                (gathered.get(a.pack) ?? true) && a.atPost(this.ship),
            );
        }
        for (const [pack, all] of gathered) if (all) this.packCharge(pack);
    }

    hurtPlayer(damage: number): void {
        if (this.over) return;
        Audio.play("hurt");
        this.health = Math.max(0, this.health - damage);
        this.hurtTime = 0.5;
        this.shake = Math.max(this.shake, 0.12);
        if (this.health <= 0) this.finish(false);
    }

    private forward(): THREE.Vector3 {
        const cp = Math.cos(this.pitch);
        return new THREE.Vector3(
            Math.cos(this.yaw) * cp,
            Math.sin(this.yaw) * cp,
            Math.sin(this.pitch),
        );
    }

    private eye(): THREE.Vector3 {
        const bob = Math.sin(this.stride) * 0.04 * Math.min(1, this.stride);
        return new THREE.Vector3(this.playerX, this.playerY, EYE + bob);
    }

    private updateCamera(dt: number): void {
        const cam = this.main.camera;
        const e = this.eye();
        const f = this.forward();
        this.shake = Math.max(0, this.shake - dt);
        const jitter = this.shake * this.shake * 2;
        e.x += (Math.random() - 0.5) * jitter;
        e.y += (Math.random() - 0.5) * jitter;
        e.z += (Math.random() - 0.5) * jitter;
        toThree(e.x, e.y, e.z, cam.position);
        cam.up.set(0, 0, 1);
        cam.lookAt(toThree(e.x + f.x, e.y + f.y, e.z + f.z));

        // the gun in the right hand, lowered while switching, kicked back by shots
        const r = new THREE.Vector3(0, 0, 1).cross(f).normalize();
        const u = f.clone().cross(r);
        this.recoil = Math.max(0, this.recoil - dt * 1.5);
        this.switchTime = Math.max(0, this.switchTime - dt);
        const lower =
            this.switchTime > 0
                ? Math.sin((this.switchTime / 0.3) * Math.PI) * 0.25
                : 0;
        const sway = Math.sin(this.stride * 0.5) * 0.012;
        const p = e
            .clone()
            .addScaledVector(f, 0.42 - this.recoil)
            .addScaledVector(r, 0.2 + sway)
            .addScaledVector(u, -0.24 - lower + Math.abs(sway));
        // the game's gun matrix takes the model's X to r, Y to -f and Z to
        // u in its mirrored model axes; in three.js and the model's own axes:
        basis.makeBasis(
            new THREE.Vector3(-r.x, r.y, -r.z),
            new THREE.Vector3(-f.x, f.y, -f.z),
            new THREE.Vector3(u.x, -u.y, u.z),
        );
        this.guns.forEach((gun, i) => {
            gun.visible = i === this.weapon;
            gun.quaternion.setFromRotationMatrix(basis);
            toThree(p.x, p.y, p.z, gun.position);
        });
        this.drumTurn = Math.max(0, this.drumTurn - dt * 4);
        if (this.drum)
            this.drum.quaternion
                .copy(this.drumRest)
                .multiply(
                    jointRotation(
                        0,
                        0,
                        ((1 - this.drumTurn) * Math.PI) / 3,
                        drumTurnQ,
                    ),
                );
    }

    // --- weapons --------------------------------------------------------

    private updateWeapons(dt: number): void {
        const input = this.main.input;
        for (let i = 0; i < 2; i++)
            this.reload[i] = Math.max(0, this.reload[i]! - dt);
        if (input.isPressed("Digit1") || input.isPressed("Numpad1"))
            this.select(0);
        if (input.isPressed("Digit2") || input.isPressed("Numpad2"))
            this.select(1);
        const trigger =
            input.isDown("Space") || input.isDown(MOUSE_LEFT) || this.touchFire;
        if (!trigger) this.triggerBlocked = false;
        if (
            !trigger ||
            this.triggerBlocked ||
            this.switchTime > 0.15 ||
            this.reload[this.weapon]! > 0
        )
            return;
        if (this.weapon === 0) this.fireLaser();
        else this.fireGrenade();
    }

    private select(w: number): void {
        if (w === this.weapon) return;
        this.weapon = w;
        this.switchTime = 0.3;
    }

    /** Where the shots leave the gun, in the game. */
    private muzzle(): THREE.Vector3 {
        const gun = this.guns[this.weapon]!;
        const m = joint(gun, "Muzzle") ?? gun;
        gun.updateMatrixWorld(true);
        return fromThree(m.getWorldPosition(new THREE.Vector3()));
    }

    /** Distance along a ray to where it enters the alien's cylinder, or -1. */
    private rayAlien(a: Alien, o: THREE.Vector3, d: THREE.Vector3): number {
        const fx = o.x - a.x;
        const fy = o.y - a.y;
        const r = a.hitRadius;
        let best = -1;
        const qa = d.x * d.x + d.y * d.y;
        if (qa > 1e-9) {
            const qb = 2 * (fx * d.x + fy * d.y);
            const qc = fx * fx + fy * fy - r * r;
            const disc = qb * qb - 4 * qa * qc;
            if (disc >= 0) {
                let t = (-qb - Math.sqrt(disc)) / (2 * qa);
                if (t < 0 && qc < 0) t = 0; // starting inside
                const z = o.z + d.z * t;
                if (t >= 0 && z >= 0 && z <= a.height) best = t;
            }
        }
        if (best < 0 && d.z !== 0) {
            const t = (a.height - o.z) / d.z;
            const px = fx + d.x * t;
            const py = fy + d.y * t;
            if (t > 0 && px * px + py * py <= r * r) best = t;
        }
        return best;
    }

    /** The nearest living alien along the ray within maxDist, and how far. */
    private alienOnRay(
        o: THREE.Vector3,
        d: THREE.Vector3,
        maxDist: number,
    ): { alien: Alien | null; dist: number } {
        let hit: Alien | null = null;
        let dist = maxDist;
        for (const a of this.aliens) {
            if (a.dead) continue;
            const t = this.rayAlien(a, o, d);
            if (t >= 0 && t < dist) {
                hit = a;
                dist = t;
            }
        }
        return { alien: hit, dist };
    }

    private fireLaser(): void {
        this.reload[0] = LASER_INTERVAL;
        this.recoil = 0.05;
        const o = this.eye();
        const d = this.forward();
        const wall = this.ship.raycast(
            o.x,
            o.y,
            o.z,
            d.x,
            d.y,
            d.z,
            LASER_RANGE,
        );
        const hit = this.alienOnRay(o, d, wall);
        const p = o.clone().addScaledVector(d, hit.dist);
        this.fx.beam(this.muzzle(), p, 0x30f0ff);
        Audio.play("laser", 0.7);
        if (hit.alien) {
            this.hurtAlien(hit.alien, LASER_DAMAGE);
            this.fx.splash(p.x, p.y, p.z, 5);
            this.hitTime = 0.15;
        }
    }

    private fireGrenade(): void {
        this.reload[1] = GRENADE_INTERVAL;
        this.recoil = 0.14;
        this.drumTurn = 1;
        this.shake = Math.max(this.shake, 0.08);
        const m = this.muzzle();
        const d = this.forward();
        // aim the shell so it flies along the line of sight to what the crosshair is on
        const o = this.eye();
        const target = o
            .clone()
            .addScaledVector(
                d,
                this.ship.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 40),
            );
        const dir = target.sub(m).normalize();
        const obj = new THREE.Group();
        obj.add(Gfx.model("grenade"));
        toThree(m.x, m.y, m.z, obj.position);
        obj.quaternion.setFromUnitVectors(GRENADE_NOSE, vecToThree(dir));
        this.root.add(obj);
        this.grenades.push({
            obj,
            x: m.x,
            y: m.y,
            z: m.z,
            vx: dir.x * GRENADE_SPEED,
            vy: dir.y * GRENADE_SPEED,
            vz: dir.z * GRENADE_SPEED + 0.8,
            age: 0,
        });
        this.fx.flare(Flare.LauncherFlash, m.x, m.y, m.z, 0.6, 0.1);
        this.fx.light(m.x, m.y, m.z, 0xff8040, 2, 0.12);
        Audio.play("launch");
    }

    private updateGrenades(dt: number): void {
        let i = 0;
        while (i < this.grenades.length) {
            const g = this.grenades[i]!;
            g.age += dt;
            g.vz -= GRENADE_GRAVITY * dt;
            const v = new THREE.Vector3(g.vx, g.vy, g.vz);
            const step = v.length() * dt;
            const d = v.normalize();
            const o = new THREE.Vector3(g.x, g.y, g.z);
            const wall = this.ship.raycast(g.x, g.y, g.z, d.x, d.y, d.z, step);
            const hit = this.alienOnRay(o, d, wall);
            if (hit.alien || wall < step || g.age > 6) {
                const p = o.addScaledVector(d, Math.max(0, hit.dist - 0.1));
                this.explode(p, hit.alien);
                g.obj.removeFromParent();
                this.grenades.splice(i, 1);
                continue;
            }
            g.x += d.x * step;
            g.y += d.y * step;
            g.z += d.z * step;
            toThree(g.x, g.y, g.z, g.obj.position);
            g.obj.quaternion.setFromUnitVectors(GRENADE_NOSE, vecToThree(d));
            this.fx.flare(Flare.LauncherFlash, g.x, g.y, g.z, 0.25, 0.12);
            i++;
        }
    }

    /**
     * The target (the alien hit, if any) takes the full damage; every other
     * alien within the blast radius the more, the nearer it is.
     */
    private explode(p: THREE.Vector3, target: Alien | null): void {
        this.fx.explode(p.x, p.y, Math.max(0, p.z - 0.4));
        Audio.playAt("explosion", this.distanceTo(p.x, p.y) * 0.5);
        for (const a of this.aliens) {
            if (a.dead) continue;
            let damage = 0;
            if (a === target) damage = GRENADE_DAMAGE;
            else {
                const horizontal = Math.max(
                    0,
                    Math.sqrt(
                        (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y),
                    ) - a.hitRadius,
                );
                const vertical = p.z - THREE.MathUtils.clamp(p.z, 0, a.height);
                const d = Math.sqrt(
                    horizontal * horizontal + vertical * vertical,
                );
                if (d < BLAST_RADIUS)
                    damage = GRENADE_DAMAGE * (1 - d / BLAST_RADIUS);
            }
            if (damage > 0) {
                this.hurtAlien(a, damage);
                this.fx.splash(a.x, a.y, a.height * 0.6, 4);
                this.hitTime = 0.15;
            }
        }
        const near = this.distanceTo(p.x, p.y);
        this.shake = Math.max(
            this.shake,
            0.45 * THREE.MathUtils.clamp(1 - near / 25, 0.15, 1),
        );
    }

    // --- touchscreens ---------------------------------------------------

    /**
     * Gives each finger that touched down its job: the pause button, a
     * weapon panel, the fire button, the joystick (the first finger on the
     * left half, where it lands) or looking around (any other). Returns
     * true when the game was paused.
     */
    private touchControls(): boolean {
        const input = this.main.input;
        for (const t of input.began) {
            const p = PAUSE_BUTTON;
            if (
                t.x >= p.x &&
                t.x < p.x + p.w &&
                t.y >= p.y &&
                t.y < p.y + p.h
            ) {
                this.pause();
                return true;
            }
            const panel = this.weaponPanelAt(t.x, t.y);
            if (panel >= 0) {
                t.role = "weapon";
                this.select(panel);
                continue;
            }
            const f = FIRE_BUTTON;
            if (Math.hypot(t.x - f.x, t.y - f.y) <= f.r * 1.25) {
                t.role = "fire";
                continue;
            }
            const steering = [...input.touches.values()].some(
                (o) => o.role === "move",
            );
            t.role = t.x < W / 2 && !steering ? "move" : "look";
        }
        this.stick = { x: 0, y: 0 };
        this.touchFire = false;
        for (const t of input.touches.values()) {
            if (t.role === "fire") this.touchFire = true;
            else if (t.role === "look") {
                this.yaw += (t.x - t.prevX) * TOUCH_LOOK_SPEED;
                this.pitch = THREE.MathUtils.clamp(
                    this.pitch - (t.y - t.prevY) * TOUCH_LOOK_SPEED,
                    -MAX_PITCH,
                    MAX_PITCH,
                );
            } else if (t.role === "move") {
                const x = (t.x - t.startX) / STICK_RADIUS;
                const y = (t.y - t.startY) / STICK_RADIUS;
                const tilt = Math.hypot(x, y);
                const k = tilt > 1 ? 1 / tilt : 1;
                this.stick = { x: x * k, y: y * k };
            }
        }
        return false;
    }

    /** The weapon whose HUD panel is at (x, y), or -1. */
    private weaponPanelAt(x: number, y: number): number {
        for (let i = 0; i < 2; i++) {
            const px = W - 280 + i * 136;
            if (x >= px && x < px + 124 && y >= H - 102 && y < H - 26) return i;
        }
        return -1;
    }

    private drawTouchControls(ctx: CanvasRenderingContext2D): void {
        const circle = (
            x: number,
            y: number,
            r: number,
            fill: number,
            fillAlpha: number,
            line: number,
            lineAlpha: number,
        ) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = Ui.css(fill, fillAlpha);
            ctx.fill();
            ctx.strokeStyle = Ui.css(line, lineAlpha);
            ctx.lineWidth = 2;
            ctx.stroke();
        };

        // the joystick, where the thumb landed, or waiting at home
        const thumb = [...this.main.input.touches.values()].find(
            (t) => t.role === "move",
        );
        const base = thumb ? { x: thumb.startX, y: thumb.startY } : STICK_HOME;
        const alpha = thumb ? 1 : 0.45;
        circle(
            base.x,
            base.y,
            STICK_RADIUS,
            0x060a14,
            0.35 * alpha,
            0x2af0ff,
            0.6 * alpha,
        );
        circle(
            base.x + this.stick.x * STICK_RADIUS,
            base.y + this.stick.y * STICK_RADIUS,
            28,
            0x2af0ff,
            0.35 * alpha,
            0x9ff4ff,
            0.9 * alpha,
        );

        // the fire button
        const f = FIRE_BUTTON;
        const ready = this.reload[this.weapon]! <= 0;
        circle(
            f.x,
            f.y,
            f.r,
            0xff3ae0,
            this.touchFire ? 0.45 : 0.18,
            0xff3ae0,
            ready ? 0.9 : 0.45,
        );
        Ui.text(ctx, Lang.t("FIRE"), f.x, f.y - Ui.lineHeight(), {
            scale: 2,
            align: "center",
            color: ready ? 0xffd8fa : 0x9a6a90,
            shadow: SHADOW,
        });

        // the pause button: two bars in a frame
        const p = PAUSE_BUTTON;
        this.frame(ctx, p.x, p.y, p.w, p.h, 0x2af0ff, 0.8);
        Ui.fillRect(ctx, p.x + 18, p.y + 9, 5, 18, 0x9ff4ff);
        Ui.fillRect(ctx, p.x + 29, p.y + 9, 5, 18, 0x9ff4ff);
    }

    // --- HUD ------------------------------------------------------------

    private fadeHud(dt: number): void {
        this.hurtTime = Math.max(0, this.hurtTime - dt);
        this.hitTime = Math.max(0, this.hitTime - dt);
    }

    /** Neon frame with cut corners. */
    private frame(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        color: number,
        alpha = 1.0,
    ): void {
        const c = 8;
        ctx.beginPath();
        ctx.moveTo(x + c, y);
        ctx.lineTo(x + w - c, y);
        ctx.lineTo(x + w, y + c);
        ctx.lineTo(x + w, y + h - c);
        ctx.lineTo(x + w - c, y + h);
        ctx.lineTo(x + c, y + h);
        ctx.lineTo(x, y + h - c);
        ctx.lineTo(x, y + c);
        ctx.closePath();
        ctx.fillStyle = Ui.css(0x060a14, 0.55 * alpha);
        ctx.fill();
        ctx.strokeStyle = Ui.css(color, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        const label = (
            value: string,
            x: number,
            y: number,
            color: number,
            scale = 1,
            style: Ui.TextStyle = {},
        ) =>
            Ui.text(ctx, value, x, y, {
                ...style,
                scale,
                color,
                shadow: SHADOW,
            });

        if (!this.over) {
            const crosshair = Res.image("crosshair");
            Ui.tile(
                ctx,
                crosshair,
                this.weapon * 128,
                0,
                128,
                128,
                W / 2 - 64,
                H / 2 - 64,
                this.reload[this.weapon]! > 0 ? 0.5 : 1,
            );
        }
        Ui.scanlines(ctx);

        // clawed: the edges of the view flash red
        const low =
            this.health / PLAYER_HEALTH < 0.25
                ? 0.12 + 0.08 * Math.sin(this.time * 6)
                : 0;
        const shade = Math.max(this.hurtTime, low);
        if (shade > 0) {
            const red = Ui.css(0xff1030, shade * 0.8);
            ctx.fillStyle = red;
            ctx.fillRect(0, 0, W, 24);
            ctx.fillRect(0, H - 24, W, 24);
            ctx.fillRect(0, 24, 24, H - 48);
            ctx.fillRect(W - 24, 24, 24, H - 48);
            Ui.fillRect(ctx, 0, 0, W, H, 0xff1030, shade * 0.25);
        }

        // health
        this.frame(ctx, 16, H - 92, 300, 66, 0x2af0ff);
        const share = this.health / PLAYER_HEALTH;
        const color =
            share > 0.5 ? 0x3aff8a : share > 0.25 ? 0xffb020 : 0xff3a4a;
        Ui.fillRect(ctx, 28, H - 48, 276, 12, 0x10202a);
        Ui.fillRect(ctx, 28, H - 48, 276 * share, 12, color);

        // weapons with their reload bars
        const icons = Res.image("icons");
        for (let i = 0; i < 2; i++) {
            const x = W - 280 + i * 136;
            const current = i === this.weapon;
            this.frame(
                ctx,
                x,
                H - 102,
                124,
                76,
                current ? 0xff3ae0 : 0x2a6a80,
                current ? 1 : 0.7,
            );
            const ready =
                1 -
                this.reload[i]! / (i === 0 ? LASER_INTERVAL : GRENADE_INTERVAL);
            Ui.fillRect(ctx, x + 66, H - 34, 50, 5, 0x10202a);
            Ui.fillRect(
                ctx,
                x + 66,
                H - 34,
                50 * ready,
                5,
                ready >= 1 ? 0x3aff8a : 0xffb020,
            );
        }

        const living = this.aliens.filter((a) => !a.dead).length;
        this.frame(ctx, 12, 8, 250, 36, 0xff3ae0, 0.8);
        this.frame(ctx, W - 262, 8, 250, 36, 0x2af0ff, 0.8);

        // a hit: four ticks around the crosshair
        if (this.hitTime > 0) {
            const cx = W / 2;
            const cy = H / 2;
            ctx.strokeStyle = Ui.css(0xffffff, this.hitTime / 0.15);
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const sx of [-1, 1])
                for (const sy of [-1, 1]) {
                    ctx.moveTo(cx + sx * 10, cy + sy * 10);
                    ctx.lineTo(cx + sx * 18, cy + sy * 18);
                }
            ctx.stroke();
        }

        label(
            Lang.t("HEALTH {0}", [Math.ceil(this.health)]),
            28,
            H - 78,
            0x9ff4ff,
            2,
        );
        label(
            Lang.t("HOSTILES {0}/{1}", [living, this.aliens.length]),
            24,
            14,
            0xff9af0,
            2,
        );
        label(
            this.ship.sectionName(this.playerX, this.playerY),
            W - 256,
            14,
            0x9ff4ff,
            2,
            { align: "right", maxWidth: 119 },
        );
        const touch = this.main.input.touchMode;
        label(
            Lang.t(
                touch
                    ? "Left thumb: move   Right thumb: aim   FIRE: shoot   Tap a weapon to choose it   II: menu"
                    : "WASD / arrows: move   Mouse: aim   Space / left click: fire   1: laser gun   2: grenade launcher   Esc: menu",
            ),
            0,
            H - 18,
            0x7a9ab8,
            1,
            { align: "center", maxWidth: W },
        );
        for (let i = 0; i < 2; i++) {
            const x = W - 280 + i * 136;
            const current = i === this.weapon;
            Ui.tile(
                ctx,
                icons,
                i * 112,
                0,
                112,
                56,
                x + 6,
                H - 96,
                current ? 1 : 0.45,
            );
            label(
                Lang.t(i === 0 ? "1 LASER" : "2 LAUNCHER"),
                x + 6,
                H - 38,
                current ? 0xffd8fa : 0x6a9ab0,
            );
        }

        if (touch && !this.over) this.drawTouchControls(ctx);

        if (this.over) {
            Ui.fillRect(ctx, 0, 0, W, H, 0x000000, 0.6);
            const v = this.victory;
            this.centeredText(
                ctx,
                Lang.t(v ? "SHIP CLEARED" : "KILLED IN ACTION"),
                5,
                170,
                {
                    color: v ? 0x3af6ff : 0xff3a5a,
                    shadow: {
                        dx: 1,
                        dy: 1,
                        color: v ? 0x0a3a5a : 0x5a0a1a,
                        alpha: 1,
                    },
                },
            );
            this.centeredText(
                ctx,
                `${Lang.t(
                    v
                        ? "All ten alien boarders are dead. The ship is yours again."
                        : "The aliens' claws got the better of you.",
                )}\n${Lang.t(
                    touch
                        ? "Tap to return to the main menu"
                        : "Press Enter to return to the main menu",
                )}`,
                2,
                300,
            );
        }
    }

    // --- victory and defeat ---------------------------------------------

    private checkGoals(): void {
        if (!this.over && !this.aliens.some((a) => !a.dead)) this.finish(true);
    }

    private finish(victory: boolean): void {
        this.over = true;
        this.overAt = performance.now();
        this.victory = victory;
        Audio.playMusic(victory ? "victory" : "defeat", true);
        this.main.game = null;
        this.main.freeMouse();
    }

    // --- saving ---------------------------------------------------------

    getState(): SaveData {
        return {
            player: {
                x: this.playerX,
                y: this.playerY,
                yaw: this.yaw,
                pitch: this.pitch,
                health: this.health,
                weapon: this.weapon,
            },
            aliens: this.aliens.map((a) => a.getState()),
        };
    }

    private setState(s: SaveData): void {
        this.playerX = s.player.x;
        this.playerY = s.player.y;
        this.yaw = s.player.yaw;
        this.pitch = s.player.pitch;
        this.health = s.player.health;
        this.weapon = s.player.weapon;
        for (const d of s.aliens) {
            const a = new Alien(
                d.species,
                d.x,
                d.y,
                d.angle,
                d.health,
                this.root,
            );
            a.angry = d.angry;
            this.aliens.push(a);
        }
    }
}
