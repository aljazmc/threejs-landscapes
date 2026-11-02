import * as THREE from "three";
import { Castle, world } from "./castle";
import { Flare, type FxLight, type Item } from "./fx";
import { type Game, SWITCH_TIME } from "./game";
import { type Light, type LightPool, LUMENS } from "./lights";
import { KINDS } from "./monster";
import * as Res from "./res";
import { bend, jointsStarting, legs, model, type Rig, rig, turn } from "./rig";

/**
 * The game as seen: the monsters' models posed from their state, the
 * hunter's eye and the weapons in his hands, and the effects. The game
 * stays in view behind the main menu while it is paused; without a game,
 * the eye flies slowly around the ballroom.
 */

const FIRE_FRAMES = 16;

interface Shown {
    obj: THREE.Object3D;
    rig: Rig;
}

/** A monster's model, with its head for headshots. */
interface ShownMonster extends Shown {
    /** The joint carrying the head, and the head's centre and size on it. */
    head: THREE.Object3D;
    headCentre: THREE.Vector3;
    headRadius: number;
}

/** The smallest and the largest ball around a head, for headshots. */
const HEAD_RADIUS = { min: 0.2, max: 0.4 };
const scratch = new THREE.Vector3();

/**
 * The head of a model (in its rest pose), for headshots: the Head joint
 * with the ball around its meshes, or for a model without one (the spider's
 * head is part of its Body) a ball on its Body joint.
 */
function headOf(
    obj: THREE.Object3D,
    r: Rig,
): { head: THREE.Object3D; headCentre: THREE.Vector3; headRadius: number } {
    obj.updateMatrixWorld(true);
    const joint = r.joints.get("Head");
    if (!joint)
        return {
            head: r.joints.get("Body") ?? obj,
            headCentre: new THREE.Vector3(),
            headRadius: 0.3,
        };
    const box = new THREE.Box3().setFromObject(joint);
    const size = box.getSize(new THREE.Vector3());
    return {
        head: joint,
        headCentre: joint.worldToLocal(box.getCenter(new THREE.Vector3())),
        headRadius: THREE.MathUtils.clamp(
            Math.max(size.x, size.y, size.z) / 2,
            HEAD_RADIUS.min,
            HEAD_RADIUS.max,
        ),
    };
}

/** The size x size cells of a sheet, row by row, each its own texture. */
function cut(img: HTMLImageElement, size: number): THREE.Texture[] {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const cells: THREE.Texture[] = [];
    for (let y = 0; y < img.height; y += size)
        for (let x = 0; x < img.width; x += size) {
            const data = ctx.getImageData(x, y, size, size).data;
            const tex = new THREE.DataTexture(
                data,
                size,
                size,
                THREE.RGBAFormat,
            );
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.LinearFilter;
            tex.minFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            cells.push(tex);
        }
    return cells;
}

const eye = new THREE.Vector3();
const toEye = new THREE.Vector3();
const at = new THREE.Vector3();
const weaponEuler = new THREE.Euler();

export class View {
    private readonly root = new THREE.Group();
    private shownId: number | null = null;
    private monsters: ShownMonster[] = [];
    private weapons: Shown[] = [];
    private readonly flares: THREE.Texture[];
    private readonly fire: THREE.Texture[];
    private readonly sprites = new Map<Item, THREE.Sprite>();
    private readonly flashes = new Map<FxLight, Light>();

    constructor(
        scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera,
        private readonly lights: LightPool,
    ) {
        scene.add(this.root);
        // the weapons hang from the eye, which must be in the scene to show them
        scene.add(camera);
        this.flares = cut(Res.image("flare"), 64);
        this.fire = cut(Res.image("fire"), 128);
    }

    /** Builds the models of a new game (and removes those of the last one). */
    private spawn(game: Game | null): void {
        const id = game?.id ?? null;
        if (id === this.shownId) return;
        this.shownId = id;
        for (const m of this.monsters) m.obj.removeFromParent();
        for (const w of this.weapons) w.obj.removeFromParent();
        this.clearFx();
        this.monsters = [];
        this.weapons = [];
        if (!game) return;
        for (const m of game.monsters) {
            const obj = model(KINDS[m.kind]!);
            const r = rig(obj);
            // the monsters' size for the shots, from their models
            const size = r.bounds.getSize(new THREE.Vector3());
            m.hitRadius = THREE.MathUtils.clamp(
                Math.max(size.x, size.z) * 0.32,
                0.35,
                0.8,
            );
            m.height = r.bounds.max.y;
            this.root.add(obj);
            this.monsters.push({ obj, rig: r, ...headOf(obj, r) });
        }
        for (const name of ["revolver", "flamethrower"]) {
            const obj = model(name);
            const r = rig(obj);
            this.camera.add(obj);
            this.weapons.push({ obj, rig: r });
        }
    }

    /** Places and poses everything for this frame (t: seconds since the start). */
    update(game: Game | null, t: number): void {
        this.spawn(game);
        const camera = this.camera;
        if (game) {
            const e = game.eye().add(game.jitter);
            const f = game.forward();
            world(e.x, e.y, e.z, camera.position);
            camera.up.set(0, 1, 0);
            camera.lookAt(world(e.x + f.x, e.y + f.y, e.z + f.z));
            this.poseMonsters(game);
            this.poseWeapons(game);
        } else Castle.flyby(camera, t);
        camera.updateMatrixWorld(true);
        if (game) this.readMuzzles(game);
        this.showFx(game);
    }

    private poseMonsters(game: Game): void {
        game.monsters.forEach((m, i) => {
            const shown = this.monsters[i];
            if (!shown) return;
            const { obj, rig: r } = shown;
            world(m.x, m.y, 0, obj.position);
            obj.rotation.set(0, m.angle, 0);
            // the right arm strikes first; each with its elbow
            const arms = (["ArmR", "ArmL"] as const).flatMap((name) => {
                const arm = r.joints.get(name);
                return arm
                    ? [{ arm, elbow: r.joints.get(`${name} Elbow`) }]
                    : [];
            });
            const pose = m.pose(arms.length, r.joints.has("Hover"));
            for (const leg of legs(r, "A")) {
                turn(r, leg.hip, pose.legs, 0, 0);
                bend(r, leg.knee, pose.kneeA);
            }
            for (const leg of legs(r, "B")) {
                turn(r, leg.hip, -pose.legs, 0, 0);
                bend(r, leg.knee, pose.kneeB);
            }
            jointsStarting(r, "Tail ").forEach((tail, k) => {
                turn(r, tail, 0, pose.tail(k), 0);
            });
            ["WingL", "WingR"]
                .map((name) => r.joints.get(name))
                .filter((o): o is THREE.Object3D => o !== undefined)
                .forEach((wing, k) => {
                    turn(r, wing, 0, 0, (k === 0 ? 1 : -1) * pose.wing);
                });
            arms.forEach(({ arm, elbow }, k) => {
                const limb = pose.arms[k];
                turn(r, arm, limb?.swing ?? 0, 0, 0);
                bend(r, elbow, limb?.bend ?? 0);
            });
            const head = r.joints.get("Head");
            if (head) turn(r, head, pose.head.x, pose.head.y, pose.head.z);
            const body = r.joints.get("Body");
            if (body) {
                turn(r, body, pose.body.x, pose.body.y, pose.body.z);
                const rest = r.rest.get(body);
                if (rest)
                    body.position.y = rest.position.y * pose.sink + pose.rise;
            }
            // where the head is now, for the shots (the game's x, y, z)
            obj.updateMatrixWorld(true);
            shown.head.localToWorld(scratch.copy(shown.headCentre));
            m.headAt.set(scratch.x, scratch.z, scratch.y);
            m.headRadius = shown.headRadius;
        });
    }

    private poseWeapons(game: Game): void {
        const lower =
            game.switchTime > 0
                ? Math.sin((game.switchTime / SWITCH_TIME) * Math.PI) * 0.25
                : 0;
        const sway = Math.sin(game.stride * 0.5) * 0.012;
        this.weapons.forEach(({ obj, rig: r }, k) => {
            obj.visible = k === game.weapon;
            if (k === 0) {
                // the revolver kicks up and back after each shot
                const kick = game.recoil / 0.12;
                obj.position.set(
                    0.19 + sway,
                    -0.2 - lower + Math.abs(sway),
                    -0.36 + 0.06 * kick,
                );
                weaponEuler.set(-0.35 * kick, Math.PI + 0.04, 0, "YXZ");
            } else {
                // the flamethrower trembles while it fires
                const tremble = game.firing
                    ? Math.sin(game.time * 60) * 0.004
                    : 0;
                obj.position.set(
                    0.17 + sway,
                    -0.25 - lower + Math.abs(sway) + tremble,
                    -0.42,
                );
                weaponEuler.set(0.02, Math.PI + 0.06, 0, "YXZ");
            }
            obj.quaternion.setFromEuler(weaponEuler);
            // the drum turns around the barrel, the valve wheel while the fire flows
            const drum = r.joints.get("Drum");
            if (drum) turn(r, drum, 0, game.drum, 0);
            for (const valve of jointsStarting(r, "Spin"))
                turn(r, valve, 0, game.firing ? game.time * 9 : 0, 0);
            jointsStarting(r, "Flame ").forEach((flame, n) => {
                const rest = r.rest.get(flame);
                if (!rest) return;
                const t = game.time + n * 1.7;
                const size = game.firing
                    ? 1.6
                    : 0.85 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3);
                flame.scale.set(
                    rest.scale.x,
                    rest.scale.y * size,
                    rest.scale.z,
                );
            });
        });
    }

    /** Where the weapons' muzzles were drawn, for the game to fire from. */
    private readMuzzles(game: Game): void {
        this.weapons.forEach(({ rig: r }, k) => {
            const muzzle = r.joints.get("Muzzle");
            if (!muzzle) return;
            const p = muzzle.getWorldPosition(at);
            game.muzzles[k] = new THREE.Vector3(p.x, p.z, p.y);
        });
    }

    // --- effects --------------------------------------------------------

    private clearFx(): void {
        for (const sprite of this.sprites.values()) {
            sprite.removeFromParent();
            sprite.material.dispose();
        }
        this.sprites.clear();
        for (const light of this.flashes.values()) this.lights.remove(light);
        this.flashes.clear();
    }

    private showFx(game: Game | null): void {
        if (!game) return;
        eye.copy(this.camera.position);
        const seen = new Set<Item>();
        for (const it of game.fx.items) {
            seen.add(it);
            let sprite = this.sprites.get(it);
            if (!sprite) {
                sprite = new THREE.Sprite(
                    new THREE.SpriteMaterial({
                        depthWrite: false,
                        transparent: true,
                        fog: false,
                    }),
                );
                this.root.add(sprite);
                this.sprites.set(it, sprite);
            }
            const u = it.age / it.life;
            const size = it.size * (1 + it.grow * u);
            world(it.at.x, it.at.y, it.at.z, sprite.position);
            if (it.flare === null) {
                // the fire is drawn a bit nearer, so it isn't cut by the floor and walls it licks
                toEye.subVectors(eye, sprite.position);
                if (toEye.lengthSq() > 0)
                    sprite.position.addScaledVector(
                        toEye.normalize(),
                        Math.min(size * 0.3, 0.6),
                    );
            }
            sprite.scale.set(size, size, 1);
            this.style(sprite.material, it, u);
        }
        for (const [it, sprite] of this.sprites)
            if (!seen.has(it)) {
                sprite.removeFromParent();
                sprite.material.dispose();
                this.sprites.delete(it);
            }

        const lit = new Set<FxLight>();
        for (const fl of game.fx.lights) {
            lit.add(fl);
            let light = this.flashes.get(fl);
            if (!light) {
                light = this.lights.add({
                    position: new THREE.Vector3(),
                    color: fl.color,
                    lumens: 0,
                    range: fl.range,
                });
                this.flashes.set(fl, light);
            }
            const u = fl.age / fl.life;
            world(fl.at.x, fl.at.y, fl.at.z, light.position);
            light.lumens = fl.energy * LUMENS * (1 - u) * (1 - u);
        }
        for (const [fl, light] of this.flashes)
            if (!lit.has(fl)) {
                this.lights.remove(light);
                this.flashes.delete(fl);
            }
    }

    /** The sprite's cell of its sheet, blending and fading. */
    private style(mat: THREE.SpriteMaterial, it: Item, u: number): void {
        if (it.flare !== null) {
            mat.map = this.flares[it.flare] ?? null;
            const a = 1 - u;
            if (it.flare === Flare.Blood || it.flare === Flare.Smoke) {
                mat.blending = THREE.NormalBlending;
                mat.color.setRGB(1, 1, 1);
                mat.opacity = a * 0.85;
            } else {
                // added like light, brighter than white so it blooms
                mat.blending = THREE.AdditiveBlending;
                mat.color.setRGB(2 * a, 2 * a, 2 * a);
                mat.opacity = 1;
            }
        } else {
            const frame = Math.min(
                Math.trunc(u * FIRE_FRAMES),
                FIRE_FRAMES - 1,
            );
            mat.map = this.fire[frame] ?? null;
            mat.blending = THREE.NormalBlending;
            // hot at first, so it glows (and blooms), then only smoke
            const heat = 1 + 1.5 * (1 - u) ** 2;
            mat.color.setRGB(heat, heat, heat);
            mat.opacity = 1;
        }
    }
}
