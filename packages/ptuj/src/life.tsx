import * as THREE from "three";
import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { type Models, source, toonify } from "./models";

const RAFTS = 3;
const RAFT_SPEED = 3;
const CLOUDS = 16;
const CLOUD_SPEED = 2.5;
const CLOUD_RANGE = 340;

interface Walker {
    object: THREE.Object3D;
    offset: number;
    mixer?: THREE.AnimationMixer;
}

const ahead = new THREE.Vector3();

/** Moves walkers along a curve at a speed, each facing where it goes. */
function walk(
    curve: THREE.Curve<THREE.Vector3>,
    walkers: Walker[],
    speed: number,
    time: number,
    delta: number,
) {
    const length = curve.getLength();
    for (const { object, offset, mixer } of walkers) {
        const u = (offset + (time * speed) / length) % 1;
        curve.getPointAt(u, object.position);
        object.lookAt(ahead.copy(object.position).add(curve.getTangentAt(u)));
        mixer?.update(delta);
    }
}

/** Rafts floating down the Drava into the lake, bobbing on the waves. */
export function Rafts({
    models,
    path,
}: {
    models: Models;
    path: THREE.Vector3[];
}) {
    const { curve, walkers } = useMemo(() => {
        const curve = new THREE.CatmullRomCurve3(path);
        const walkers = Array.from({ length: RAFTS }, (_, index) => ({
            object: toonify(source(models, "raft").clone(true)),
            offset: index / RAFTS,
        }));
        return { curve, walkers };
    }, [models, path]);

    useFrame(({ clock }, delta) => {
        const t = clock.elapsedTime;
        walk(curve, walkers, RAFT_SPEED, t, delta);
        walkers.forEach(({ object }, index) => {
            object.position.y += 0.15 * Math.sin(t * 1.5 + index);
            object.rotateZ(0.03 * Math.sin(t * 1.1 + index));
        });
    });

    return (
        <>
            {walkers.map(({ object }) => (
                <primitive key={object.uuid} object={object} />
            ))}
        </>
    );
}

/** Puffy clouds drifting east over the diorama, casting their shadows. */
export function Clouds({ models }: { models: Models }) {
    const clouds = useMemo(
        () =>
            Array.from({ length: CLOUDS }, (_, index) => {
                const part = `Cloud${(index % 3) + 1}`;
                const object = toonify(source(models, "nature", part).clone());
                object.position.set(
                    ((index * 137) % (2 * CLOUD_RANGE)) - CLOUD_RANGE,
                    75 + ((index * 23) % 40),
                    ((index * 89) % 440) - 220,
                );
                object.rotation.set(0, index, 0);
                object.scale.setScalar(1 + (index % 4) * 0.35);
                return object;
            }),
        [models],
    );

    useFrame((_, delta) => {
        for (const cloud of clouds) {
            cloud.position.x += CLOUD_SPEED * delta;
            if (cloud.position.x > CLOUD_RANGE) {
                cloud.position.x -= 2 * CLOUD_RANGE;
            }
        }
    });

    return (
        <>
            {clouds.map((object) => (
                <primitive key={object.uuid} object={object} />
            ))}
        </>
    );
}
