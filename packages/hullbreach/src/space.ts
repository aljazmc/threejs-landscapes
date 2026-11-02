import * as THREE from "three";

/**
 * The game keeps its own coordinates: meters, Z up, cell
 * (x, y) of the map from world (x, y) to (x + 1, y + 1), and left handed
 * axes, so the right of a view along +X is +Y. three.js is right handed, so
 * everything is drawn with y negated: a mirror, which also turns every
 * rotation around Z the other way.
 *
 * The models (GLB, written by blender-scripts/exportglb.py) are in
 * Blender's own right handed axes, standing on the origin and facing -Y.
 * The game reads them mirrored in X; mirrored once more for drawing, a
 * model turned by angle in the game is turned by PI - angle in three.js.
 */

/** A point or direction of the game, in three.js. */
export function toThree(
    x: number,
    y: number,
    z: number,
    out = new THREE.Vector3(),
): THREE.Vector3 {
    return out.set(x, -y, z);
}

/** A game vector, in three.js. */
export function vecToThree(
    v: THREE.Vector3,
    out = new THREE.Vector3(),
): THREE.Vector3 {
    return out.set(v.x, -v.y, v.z);
}

/** A three.js point, in the game. */
export function fromThree(
    v: THREE.Vector3,
    out = new THREE.Vector3(),
): THREE.Vector3 {
    return out.set(v.x, -v.y, v.z);
}

/** Puts a model at (x, y, z) of the game, turned by angle around Z. */
export function place(
    obj: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    angle: number,
): void {
    obj.position.set(x, -y, z);
    obj.rotation.set(0, 0, Math.PI - angle);
}

const euler = new THREE.Euler();

/**
 * The rotation by the Euler angles (radians, Z after Y after X) of a joint of a model, as the game sees it,
 * in the model's own axes.
 */
export function jointRotation(
    ax: number,
    ay: number,
    az: number,
    out = new THREE.Quaternion(),
): THREE.Quaternion {
    return out.setFromEuler(euler.set(ax, -ay, -az, "ZYX"));
}

/** The name a node had in Blender (GLTFLoader replaces spaces by _). */
export function nodeName(obj: THREE.Object3D): string {
    const name = obj.userData.name;
    return typeof name === "string" ? name : obj.name;
}

/**
 * The joints of a model: its empties, which the game turns, not the meshes
 * merged under them ("<joint> Mesh").
 */
export function joints(root: THREE.Object3D): THREE.Object3D[] {
    const found: THREE.Object3D[] = [];
    root.traverse((o) => {
        if (o === root || (o as THREE.Mesh).isMesh) return;
        if (/ Mesh$/.test(nodeName(o))) return;
        found.push(o);
    });
    return found;
}

export function joint(
    root: THREE.Object3D,
    name: string,
): THREE.Object3D | null {
    return joints(root).find((o) => nodeName(o) === name) ?? null;
}
