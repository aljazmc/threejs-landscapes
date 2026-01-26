import * as THREE from "three";
import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { type Models, source, toon, toonColored } from "./models";

export interface Layout {
    terrain: THREE.Object3D;
    water: THREE.Mesh;
    instances: THREE.Group;
    paths: Map<string, THREE.Vector3[]>;
    /** Half the width of the way at each path point, where one is given. */
    widths: Map<string, number[]>;
    /** What stands on the ground, to keep clear of off the roads. */
    obstacles: Obstacle[];
}

/** Something standing on the ground: where, in three.js X and Z, and how wide. */
export interface Obstacle {
    x: number;
    z: number;
    radius: number;
}

const WATER_LEVEL = -1;

// how far round its marker a model (or a part of one) reaches; the bridges
// are walked over and left out
const REACH: Record<string, number> = {
    houses: 4.8,
    nature: 1.6,
    "nature/Bush": 1.3,
    "nature/Bench": 0.9,
    castle: 30,
    church: 22,
    citytower: 5,
    orpheus: 2,
    townhall: 15,
    dravatower: 7.6,
    minorite: 26,
    ribic: 9.5,
    stadium: 42,
};

/**
 * Reads the town plan out of the terrain model: its markers say which model
 * (and which part of it) stands where, and its path points are gathered by
 * path name in order.
 */
export function layout(models: Models): Layout {
    const terrain = models.terrain.scene;
    terrain.updateMatrixWorld(true);

    const spots = new Map<string, THREE.Matrix4[]>();
    const paths = new Map<string, THREE.Vector3[]>();
    const widths = new Map<string, number[]>();
    const obstacles: Obstacle[] = [];
    let water: THREE.Mesh | undefined;
    terrain.traverse((object) => {
        const { model, part, path, index, width } = object.userData;
        if (model) {
            const key = part ? `${model}/${part}` : model;
            const list = spots.get(key) ?? [];
            list.push(object.matrixWorld.clone());
            spots.set(key, list);
            const reach = REACH[key] ?? REACH[model];
            if (reach) {
                const at = object.getWorldPosition(new THREE.Vector3());
                obstacles.push({
                    x: at.x,
                    z: at.z,
                    radius: reach * object.getWorldScale(new THREE.Vector3()).x,
                });
            }
        } else if (path) {
            const list = paths.get(path) ?? [];
            list[index] = object.getWorldPosition(new THREE.Vector3());
            paths.set(path, list);
            if (width !== undefined) {
                const halves = widths.get(path) ?? [];
                halves[index] = width;
                widths.set(path, halves);
            }
        }
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
            if (mesh.name === "Water") {
                water = mesh;
            } else {
                mesh.material = toon(mesh.material);
                mesh.receiveShadow = true;
            }
        }
    });
    if (!water) {
        throw new Error("terrain has no Water mesh");
    }

    const instances = new THREE.Group();
    for (const [key, matrices] of spots) {
        const [model = "", part] = key.split("/");
        instances.add(instance(source(models, model, part), matrices));
    }
    return { terrain, water, instances, paths, widths, obstacles };
}

/** One instanced mesh per mesh of the source, placed at every matrix. */
function instance(object: THREE.Object3D, matrices: THREE.Matrix4[]) {
    object.updateMatrixWorld(true);
    const inverse = object.matrixWorld.clone().invert();
    const group = new THREE.Group();
    const matrix = new THREE.Matrix4();
    object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) {
            return;
        }
        const local = inverse.clone().multiply(mesh.matrixWorld);
        const instanced = new THREE.InstancedMesh(
            mesh.geometry,
            toon(mesh.material),
            matrices.length,
        );
        matrices.forEach((spot, index) => {
            instanced.setMatrixAt(index, matrix.multiplyMatrices(spot, local));
        });
        instanced.castShadow = true;
        instanced.receiveShadow = true;
        instanced.computeBoundingSphere();
        group.add(instanced);
    });
    return group;
}

/** Faceted waves rolling over the surface of the Drava and the lake. */
function useWaves(mesh: THREE.Mesh) {
    const { geometry, base } = useMemo(() => {
        const geometry = mesh.geometry.index
            ? mesh.geometry.toNonIndexed()
            : mesh.geometry.clone();
        mesh.geometry = geometry;
        mesh.material = toonColored("water", "#3fa7d6");
        Object.assign(mesh.material, { transparent: true, opacity: 0.85 });
        mesh.receiveShadow = true;
        const base = Float32Array.from(geometry.attributes.position!.array);
        return { geometry, base };
    }, [mesh]);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const position = geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < position.count; i++) {
            const x = base[3 * i]!;
            const y = base[3 * i + 1]!;
            const z = base[3 * i + 2]!;
            // only the surface moves, not the bottom of the cut at the edge
            if (y > WATER_LEVEL - 0.05) {
                position.setY(
                    i,
                    y +
                        0.25 * Math.sin(x * 0.09 - t * 1.3) +
                        0.15 * Math.sin(z * 0.13 + x * 0.05 + t * 0.9),
                );
            }
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
    });
}

export function Town({ town }: { town: Layout }) {
    useWaves(town.water);
    return (
        <>
            <primitive object={town.terrain} />
            <primitive object={town.instances} />
        </>
    );
}
