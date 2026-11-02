import * as THREE from "three";
import { bendAxis, bendJoint, bendScale } from "./motion";
import * as Res from "./res";

/**
 * The models of res/elven-<name>.glb and their joints: the named joints
 * the game moves (see blender-scripts/creatures.py and the props), their
 * rest poses and the size of the model. The models keep their glTF PBR
 * materials.
 */

/** The joints the game moves, as in blender-scripts/shooter.py's ANIMATED. */
function animated(name: string): boolean {
    return (
        [
            "Body",
            "ArmL",
            "ArmR",
            "ArmL Elbow",
            "ArmR Elbow",
            "Head",
            "WingL",
            "WingR",
            "Hover",
            "Muzzle",
            "Drum",
            "Nock",
            "Arrow",
        ].includes(name) ||
        (["LegA ", "LegB ", "Tail ", "Spin", "Pump ", "Flame "].some((p) =>
            name.startsWith(p),
        ) &&
            !name.endsWith(" Mesh"))
    );
}

export interface Rig {
    joints: Map<string, THREE.Object3D>;
    /** The rest pose of each joint. */
    rest: Map<
        THREE.Object3D,
        {
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
            scale: THREE.Vector3;
        }
    >;
    /** Model space (Y up) bounds of all its meshes. */
    bounds: THREE.Box3;
    /** The axis of the natural bend of each knee and elbow, and how much it takes (see motion.ts). */
    bends: Map<THREE.Object3D, { axis: THREE.Vector3; scale: number }>;
}

/** The name a node had in Blender (GLTFLoader replaces spaces by _). */
function nodeName(obj: THREE.Object3D): string {
    const name = obj.userData.name;
    return typeof name === "string" ? name : obj.name;
}

const prepared = new WeakSet<THREE.Object3D>();

/**
 * A new instance of res/elven-<name>.glb, sharing the geometry and the
 * materials of the others.
 */
export function model(name: string): THREE.Object3D {
    const source = Res.model(name);
    if (!prepared.has(source)) {
        prepared.add(source);
        // the castle has no shadows; every texture filters well up close
        source.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = mesh.receiveShadow = false;
        });
    }
    return source.clone(true);
}

export function rig(root: THREE.Object3D): Rig {
    const joints = new Map<string, THREE.Object3D>();
    const rest: Rig["rest"] = new Map();
    const bends: Rig["bends"] = new Map();
    root.traverse((o) => {
        if (o === root) return;
        const name = nodeName(o);
        if (!(o as THREE.Mesh).isMesh && animated(name)) {
            joints.set(name, o);
            rest.set(o, {
                position: o.position.clone(),
                quaternion: o.quaternion.clone(),
                scale: o.scale.clone(),
            });
            const axis = / (Knee|Down|Elbow)$/.test(name)
                ? bendAxis(o.quaternion)
                : null;
            if (axis) bends.set(o, { axis, scale: bendScale(name) });
        }
    });
    const position = root.position.clone();
    const quaternion = root.quaternion.clone();
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(), new THREE.Vector3());
    root.position.copy(position);
    root.quaternion.copy(quaternion);
    return { joints, rest, bounds, bends };
}

/** The joints whose names start with prefix, sorted by name. */
export function jointsStarting(r: Rig, prefix: string): THREE.Object3D[] {
    return [...r.joints.entries()]
        .filter(([name]) => name.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, o]) => o);
}

const euler = new THREE.Euler();
const delta = new THREE.Quaternion();

/** Turns a joint from its rest pose by angles (radians) around its own X, Y and Z. */
export function turn(
    r: Rig,
    joint: THREE.Object3D | undefined,
    ax: number,
    ay: number,
    az: number,
): void {
    if (!joint) return;
    const rest = r.rest.get(joint);
    if (!rest) return;
    // the game's Euler angles: Y, then X, then Z, as three.js' "YXZ"
    delta.setFromEuler(euler.set(ax, ay, az, "YXZ"));
    joint.quaternion.copy(rest.quaternion).multiply(delta);
}

/**
 * The hips of the LegA or the LegB legs, sorted by name, each with the
 * joint its leg bends at: its knee, or for an insect's leg the joint below.
 */
export function legs(
    r: Rig,
    group: "A" | "B",
): { hip: THREE.Object3D; knee: THREE.Object3D | undefined }[] {
    const hip = new RegExp(`^Leg${group} \\d+$`);
    return [...r.joints.entries()]
        .filter(([name]) => hip.test(name))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, o]) => ({
            hip: o,
            knee: r.joints.get(`${name} Down`) ?? r.joints.get(`${name} Knee`),
        }));
}

/** Bends a knee or an elbow by angle beyond its rest, along its natural bend. */
export function bend(
    r: Rig,
    joint: THREE.Object3D | undefined,
    angle: number,
): void {
    if (!joint) return;
    const rest = r.rest.get(joint);
    const b = r.bends.get(joint);
    if (rest && b) bendJoint(joint, rest.quaternion, b.axis, angle * b.scale);
}
