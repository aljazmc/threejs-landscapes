import * as THREE from "three";
import { Castle, srgb, world } from "./castle";
import { Flare, type FxLight, type Item } from "./fx";
import {
    type Arrow,
    BOW_INTERVAL,
    type Game,
    SWING_TIME,
    SWITCH_TIME,
} from "./game";
import type { Light, LightPool } from "./lights";
import { KINDS } from "./monster";
import * as Res from "./res";
import { jointsStarting, model, type Rig, rig, turn } from "./rig";

/**
 * The game as seen: the monsters' models posed from their state, the elf's
 * eye and the weapons in his hands, the arrows in flight and the effects.
 * The game stays in view behind the main menu while it is paused; without
 * a game, the eye flies slowly around the throne hall.
 */

const DEG = Math.PI / 180;

interface Shown {
    obj: THREE.Object3D;
    rig: Rig;
    /** The hit flash: the model's meshes again, added brightly over it. */
    flash: THREE.Object3D[];
}

/** A hit monster lights up, with this material drawn over its own. */
const FLASH = new THREE.MeshBasicMaterial({
    color: srgb(1, 0.9, 0.8),
    opacity: 0.6,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
});

/**
 * The w x h cells of a sheet, row by row, each its own texture;
 * premultiplied (color times alpha) for sprites drawn additively.
 */
function cut(
    img: HTMLImageElement,
    w: number,
    h: number,
    premultiply: boolean,
): THREE.Texture[] {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const cells: THREE.Texture[] = [];
    for (let y = 0; y + h <= img.height; y += h)
        for (let x = 0; x + w <= img.width; x += w) {
            const data = ctx.getImageData(x, y, w, h).data;
            if (premultiply)
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3]! / 255;
                    data[i] = data[i]! * a;
                    data[i + 1] = data[i + 1]! * a;
                    data[i + 2] = data[i + 2]! * a;
                }
            const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
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
const euler = new THREE.Euler();

export class View {
    private readonly root = new THREE.Group();
    private shownId: number | null = null;
    private monsters: Shown[] = [];
    private weapons: Shown[] = [];
    private readonly flares: THREE.Texture[];
    private readonly explosion: THREE.Texture[];
    private readonly sprites = new Map<Item, THREE.Sprite>();
    private readonly flashes = new Map<FxLight, Light>();
    private readonly arrows = new Map<Arrow, THREE.Object3D>();

    constructor(
        scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera,
        private readonly lights: LightPool,
    ) {
        scene.add(this.root);
        // the weapons hang from the eye, which must be in the scene to show them
        scene.add(camera);
        this.flares = cut(Res.image("flare"), 64, 64, true);
        this.explosion = cut(Res.image("explosion"), 128, 128, false);
    }

    /** Builds the models of a new game (and removes those of the last one). */
    private spawn(game: Game | null): void {
        const id = game?.id ?? null;
        if (id === this.shownId) return;
        this.shownId = id;
        for (const m of this.monsters) m.obj.removeFromParent();
        for (const w of this.weapons) w.obj.removeFromParent();
        this.clear();
        this.monsters = [];
        this.weapons = [];
        if (!game) return;
        for (const m of game.monsters) {
            const obj = model(KINDS[m.kind]!);
            const r = rig(obj);
            // the monsters' size for the arrows and blows, from their models
            const size = r.bounds.getSize(new THREE.Vector3());
            m.hitRadius = THREE.MathUtils.clamp(
                Math.max(size.x, size.z) * 0.32,
                0.35,
                0.8,
            );
            m.height = r.bounds.max.y;
            const meshes: THREE.Mesh[] = [];
            obj.traverse((o) => {
                if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
            });
            // each mesh again in the flash's material, hidden until a hit
            const flash = meshes.map((mesh) => {
                const overlay = new THREE.Mesh(mesh.geometry, FLASH);
                overlay.visible = false;
                mesh.add(overlay);
                return overlay;
            });
            this.root.add(obj);
            this.monsters.push({ obj, rig: r, flash });
        }
        for (const name of ["sword", "bow"]) {
            const obj = model(name);
            this.camera.add(obj);
            this.weapons.push({ obj, rig: rig(obj), flash: [] });
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
            this.showArrows(game);
        } else Castle.flyby(camera, t);
        camera.updateMatrixWorld(true);
        if (game) this.readMuzzle(game);
        this.showFx(game);
    }

    private poseMonsters(game: Game): void {
        game.monsters.forEach((m, i) => {
            const shown = this.monsters[i];
            if (!shown) return;
            const { obj, rig: r } = shown;
            world(m.x, m.y, 0, obj.position);
            obj.rotation.set(0, m.angle, 0);
            // the right arm strikes first
            const arms = ["ArmR", "ArmL"]
                .map((name) => r.joints.get(name))
                .filter((o): o is THREE.Object3D => o !== undefined);
            const pose = m.pose(arms.length, r.joints.has("Hover"));
            for (const leg of jointsStarting(r, "LegA "))
                turn(r, leg, pose.legs, 0, 0);
            for (const leg of jointsStarting(r, "LegB "))
                turn(r, leg, -pose.legs, 0, 0);
            jointsStarting(r, "Tail ").forEach((tail, k) => {
                turn(
                    r,
                    tail,
                    0,
                    Math.sin(pose.tailTime * 3 + k * 0.7) * 0.18,
                    0,
                );
            });
            ["WingL", "WingR"]
                .map((name) => r.joints.get(name))
                .filter((o): o is THREE.Object3D => o !== undefined)
                .forEach((wing, k) => {
                    turn(r, wing, 0, 0, (k === 0 ? 1 : -1) * pose.wing);
                });
            arms.forEach((arm, k) => {
                turn(r, arm, pose.arms[k] ?? 0, 0, 0);
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
            for (const overlay of shown.flash) overlay.visible = m.flash > 0;
        });
    }

    private poseWeapons(game: Game): void {
        const lower =
            game.switchTime > 0
                ? Math.sin((game.switchTime / SWITCH_TIME) * Math.PI) * 0.25
                : 0;
        const sway = Math.sin(game.stride * 0.5) * 0.012;
        this.weapons.forEach(({ obj }, k) => {
            obj.visible = k === game.weapon;
        });

        const sword = this.weapons[0]?.obj;
        if (sword) {
            const swing =
                game.swing < 0
                    ? 0
                    : Math.sin(Math.min(1, game.swing / SWING_TIME) * Math.PI);
            const cut =
                game.swing < 0 ? 0 : Math.min(1, game.swing / SWING_TIME);
            sword.position.set(
                0.22 + sway - 0.3 * swing,
                -0.21 - lower + Math.abs(sway) - 0.04 * swing,
                -0.45 - 0.12 * swing,
            );
            // held up and forward; a cut sweeps it from the right shoulder down to the left
            sword.quaternion.setFromEuler(
                euler.set(
                    (-35 + 75 * cut) * DEG,
                    Math.PI + (12 + 50 * swing) * DEG,
                    (-20 + 60 * swing) * DEG,
                    "YXZ",
                ),
            );
        }

        const bow = this.weapons[1];
        if (bow) {
            bow.obj.position.set(
                -0.17 + sway,
                -0.14 - lower + Math.abs(sway),
                -0.5 + game.recoil,
            );
            // canted, its arrow beside the aiming mark
            bow.obj.quaternion.setFromEuler(
                euler.set(0, Math.PI - 6 * DEG, 28 * DEG, "YXZ"),
            );
            // the next arrow appears and is drawn back while the bow reloads
            const draw = 1 - game.reload[1]! / BOW_INTERVAL;
            const arrow = bow.rig.joints.get("Arrow");
            if (arrow) arrow.visible = draw > 0.2;
            const nock = bow.rig.joints.get("Nock");
            const rest = nock && bow.rig.rest.get(nock);
            if (nock && rest)
                nock.position
                    .copy(rest.position)
                    .add(
                        new THREE.Vector3(
                            0,
                            0,
                            THREE.MathUtils.clamp((draw - 0.2) / 0.8, 0, 1) *
                                0.25,
                        ),
                    );
        }
    }

    /** The arrows in flight, their noses (+Z) along their flight. */
    private showArrows(game: Game): void {
        const flying = new Set(game.arrows);
        for (const a of game.arrows) {
            let obj = this.arrows.get(a);
            if (!obj) {
                obj = model("arrow");
                this.root.add(obj);
                this.arrows.set(a, obj);
            }
            world(a.at.x, a.at.y, a.at.z, obj.position);
            const d = a.velocity;
            obj.lookAt(world(a.at.x + d.x, a.at.y + d.y, a.at.z + d.z));
        }
        for (const [a, obj] of this.arrows)
            if (!flying.has(a)) {
                obj.removeFromParent();
                this.arrows.delete(a);
            }
    }

    /** Where the bow's arrow leaves it, for the game to shoot from. */
    private readMuzzle(game: Game): void {
        const muzzle = this.weapons[1]?.rig.joints.get("Muzzle");
        if (!muzzle) return;
        const p = muzzle.getWorldPosition(at);
        game.muzzle = new THREE.Vector3(p.x, p.z, p.y);
    }

    // --- effects --------------------------------------------------------

    private clear(): void {
        for (const sprite of this.sprites.values()) {
            sprite.removeFromParent();
            sprite.material.dispose();
        }
        this.sprites.clear();
        for (const light of this.flashes.values()) this.lights.remove(light);
        this.flashes.clear();
        for (const obj of this.arrows.values()) obj.removeFromParent();
        this.arrows.clear();
    }

    private showFx(game: Game | null): void {
        if (!game) return;
        eye.copy(this.camera.position);
        const seen = new Set<Item>();
        for (const it of game.fx.items) {
            seen.add(it);
            let sprite = this.sprites.get(it);
            if (!sprite) {
                const additive =
                    it.flare !== null &&
                    it.flare !== Flare.Blood &&
                    it.flare !== Flare.Smoke;
                sprite = new THREE.Sprite(
                    new THREE.SpriteMaterial({
                        map:
                            (it.flare === null
                                ? this.explosion[0]
                                : this.flares[it.flare]) ?? null,
                        blending: additive
                            ? THREE.AdditiveBlending
                            : THREE.NormalBlending,
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
            const mat = sprite.material;
            world(it.at.x, it.at.y, it.at.z, sprite.position);
            if (it.flare === null) {
                // a fireball: its frame, drawn a bit nearer to the eye
                const f = (it.age - it.delay) / (it.life - it.delay);
                sprite.visible = f >= 0;
                const frames = this.explosion;
                mat.map =
                    frames[
                        Math.trunc(
                            THREE.MathUtils.clamp(f, 0, 0.999) * frames.length,
                        )
                    ] ?? null;
                toEye.subVectors(eye, sprite.position);
                if (toEye.lengthSq() > 0)
                    sprite.position.addScaledVector(toEye.normalize(), it.pull);
            }
            sprite.scale.set(size, size, 1);
            if (it.fade) {
                const a = 1 - u;
                if (mat.blending === THREE.AdditiveBlending) {
                    mat.color.setRGB(a, a, a);
                    mat.opacity = 1;
                } else {
                    mat.color.setRGB(1, 1, 1);
                    mat.opacity = a * 0.85;
                }
            }
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
                    energy: 0,
                    range: fl.range,
                    attenuation: 1,
                });
                this.flashes.set(fl, light);
            }
            const u = fl.age / fl.life;
            world(fl.at.x, fl.at.y, fl.at.z, light.position);
            light.energy = fl.energy * (1 - u) * (1 - u);
        }
        for (const [fl, light] of this.flashes)
            if (!lit.has(fl)) {
                this.lights.remove(light);
                this.flashes.delete(fl);
            }
    }
}
