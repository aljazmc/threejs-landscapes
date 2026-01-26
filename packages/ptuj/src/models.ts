import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// The models exported by blender-scripts/project.sh into dist/models.
export const MODELS = [
    "terrain",
    "houses",
    "nature",
    "castle",
    "church",
    "citytower",
    "orpheus",
    "townhall",
    "dravatower",
    "minorite",
    "bridge",
    "footbridge",
    "ribic",
    "stadium",
    "kurent",
    "rusa",
    "krampus",
    "cyclist",
    "raft",
] as const;

export type ModelName = (typeof MODELS)[number];
export type Models = Record<ModelName, GLTF>;

export function useModels(): Models {
    const gltfs = useLoader(
        GLTFLoader,
        MODELS.map((name) => `models/${name}.glb`),
    );
    const models = {} as Models;
    MODELS.forEach((name, index) => {
        models[name] = gltfs[index]!;
    });
    return models;
}

// Three bands of light give the flat shaded models their cartoon look.
const gradient = new THREE.DataTexture(
    new Uint8Array([110, 190, 255]),
    3,
    1,
    THREE.RedFormat,
);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const toonMaterials = new Map<string, THREE.MeshToonMaterial>();

export function toonColored(name: string, color: THREE.ColorRepresentation) {
    return new THREE.MeshToonMaterial({
        name,
        color,
        gradientMap: gradient,
    });
}

/** The toon version of a palette material, shared by every model using it. */
export function toon(material: THREE.Material | THREE.Material[]) {
    const source = (
        Array.isArray(material) ? material[0] : material
    ) as THREE.MeshStandardMaterial;
    let result = toonMaterials.get(source.name);
    if (!result) {
        result = toonColored(source.name, source.color);
        toonMaterials.set(source.name, result);
    }
    return result;
}

/** Gives a cloned model toon materials and shadows. */
export function toonify(object: THREE.Object3D) {
    object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            mesh.material = toon(mesh.material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
    });
    return object;
}

/** The part of a model a marker names, or the whole model. */
export function source(models: Models, model: string, part?: string) {
    const gltf = models[model as ModelName];
    if (!gltf) {
        throw new Error(`unknown model ${model}`);
    }
    const object = part ? gltf.scene.getObjectByName(part) : gltf.scene;
    if (!object) {
        throw new Error(`model ${model} has no part ${part}`);
    }
    return object;
}
