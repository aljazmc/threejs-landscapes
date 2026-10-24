import * as THREE from "three";
import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { type Models, source, toonColored, toonify } from "./models";
import type { Obstacle } from "./town";

const FUR = ["#f3ede2", "#2e2622", "#8a6446", "#c9c2b8", "#5b4636"];
const PARADE_SPEED = 1.4;
const FIGURE_SCALE = 1.5;
const CYCLIST_SCALE = 1.65;

type Figure = "kurent" | "rusa" | "krampus";

// The groups in their order round the parade: the big one with the rusa
// and two krampuses, two of five kurents, two of three and four loners.
const GROUPS: Figure[][] = [
    ["rusa", "krampus", "krampus", ...Array<Figure>(15).fill("kurent")],
    ["kurent"],
    Array<Figure>(5).fill("kurent"),
    Array<Figure>(3).fill("kurent"),
    ["kurent"],
    Array<Figure>(5).fill("kurent"),
    ["kurent"],
    Array<Figure>(3).fill("kurent"),
    ["kurent"],
];
// how far apart the figures keep, from the middle of each
const RADIUS: Record<Figure, number> = { kurent: 1.1, krampus: 1.1, rusa: 1.9 };
const ROOM = 6; // square meters a figure takes in a group
const STREET_HALF = 3.4; // half the width of the streets, see ptuj-terrain
const MARGIN = 1.1; // kept free between a figure and the side of the way

// The cyclist rides round the parade for RIDE_MIN to RIDE_MAX seconds,
// weaving round the groups, before he rides into the next of the bigger
// ones. The parade stops while it deals with him, timed in seconds after
// the crash: the brawl, five kurents grabbing him and his bike, carrying
// them to the river, swinging him three times and throwing both in, and
// walking back to their places. He swims to his bike, tows it ashore,
// drags it up to the road and rides on.
const RIDE_MIN = 50;
const RIDE_MAX = 60;
const BRAWL = 1;
const GRAB = 16;
const CARRY = 17;
const SWING = 25; // turning to the water first
const SWING_TIME = 1.1;
const RELEASE = SWING + 0.5 + 2.75 * SWING_TIME; // forward in the third
const FLIGHT = 1.2;
const LANDED = RELEASE + FLIGHT;
const BACK = LANDED + 0.5; // the carriers walk back
const RESUME = BACK + 4; // and the parade walks on
const SURFACE = LANDED + 1.2;
const SWIM_SPEED = 1.1;
const WALK_SPEED = 1.3;
// the cyclist's speed in kurents' speeds: on a free way, and passing them
const FREE_PACE = 4.7;
const PASSING_PACE = 2.8;
const GREEN = 3.5; // meters of grass beside the way he overtakes over
const LOOK = [0, 4, 8, 14]; // meters ahead he looks for room on the grass
const BIG_GROUP = 5;
const BRIDGE_CLEAR = 30; // meters of way before and after a bridge kept calm
const RAMP = 8; // meters of way before and after a bridge counted as on it
const YIELD_AFTER = 3; // seconds he rides stuck behind a small group there
const LINE_GAP = 2.3; // meters apart they then line up along the railing
const CROWD = 8; // kurents who gather round the cyclist
const CARRIERS = 4; // who carry him, and the next one carries the bike
const RING = 2.4;
const OVERHEAD = 3; // how high the carriers hold him
const SWUNG = 2.4; // and how high they swing him
const BANK = 23; // meters from the middle of the river to its bank
const BLOW = 1.4; // seconds between the blows of a kurent in the brawl
const STRIKE = 0.6; // when in a blow the ježevka comes down
const KICK = 0.45; // and when a kick lands
const DAZED = 8; // seconds the kurent he rode into takes to recover
const DUST = 8;
const STARS = 4;
const SPLASH = 14;
const BIKE_SPLASH = 8;

interface Member {
    object: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    /** Meters ahead of the middle of the group. */
    along: number;
    /** Share of the free half width of the way, to the right. */
    across: number;
    phase: number;
    radius: number;
    /** Its place in the group's single file, from the back. */
    rank: number;
    /** The arm with the ježevka and the kicking leg, if it has them. */
    arm?: THREE.Object3D | undefined;
    leg?: THREE.Object3D | undefined;
    /** Where it walks now: meters along the parade and to the right. */
    s: number;
    lateral: number;
}

interface Group {
    /** Meters along the parade of the middle of the group at the start. */
    offset: number;
    phase: number;
    members: Member[];
    /** Whether it is giving way to the cyclist on a bridge, how far along
     * it is in lining up (0 to 1), and on which side. */
    yielding: boolean;
    give: number;
    side: number;
}

/** A part of the cyclist and where it sits on the bike when riding. */
interface Part {
    object: THREE.Object3D;
    parent: THREE.Object3D;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
}

interface Crash {
    start: number;
    group: Group;
    /** The kurent he rode into, knocked over the way he came. */
    victim: Member;
    push: THREE.Vector3;
    /** Where the rider lies after the crash, at his feet and his middle. */
    at: THREE.Vector3;
    lies: THREE.Vector3;
    /** Where they carry him, the way there and across it. */
    bank: THREE.Vector3;
    way: THREE.Vector3;
    across: THREE.Vector3;
    /** Towards the water from the bank, and across that. */
    inward: THREE.Vector3;
    along: THREE.Vector3;
    /** Where he and his bike fall in, where he climbs out and rides on. */
    water: THREE.Vector3;
    bikeWater: THREE.Vector3;
    shore: THREE.Vector3;
    road: THREE.Vector3;
    roadS: number;
    /** When he reaches his bike, the shore, his feet, the road, the bike. */
    fetched: number;
    ashore: number;
    standing: number;
    onRoad: number;
    mounted: number;
    riderFrom: THREE.Vector3;
    riderTurn: THREE.Quaternion;
    /** How he lies on the carriers' hands, face up and head first. */
    carried: THREE.Quaternion;
    swung: THREE.Quaternion;
    bikeFrom: THREE.Vector3;
    bikeTurn: THREE.Quaternion;
    /** The kurents round him, the first five of them his carriers. */
    crowd: { member: Member; ring: THREE.Vector3 }[];
}

const ahead = new THREE.Vector3();
const tangent = new THREE.Vector3();
const side = new THREE.Vector3();
const spot = new THREE.Vector3();
const shake = new THREE.Vector3();
const probe = new THREE.Vector3();
const probeWay = new THREE.Vector3();
const turn = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Seeded random numbers (mulberry32), so the parade is the same each time. */
function random(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const wrap = (u: number) => ((u % 1) + 1) % 1;
const ease = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);
/** Rises from 0 to 1 between a and b, and falls back between c and d. */
const bump = (x: number, a: number, b: number, c: number, d: number) =>
    ease((x - a) / (b - a)) * (1 - ease((x - c) / (d - c)));

/** A turn facing +Z along a horizontal direction, Y up. */
function facing(direction: THREE.Vector3) {
    return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(direction, new THREE.Vector3(), Y),
    );
}

/** A turn of a body lying face up along a horizontal direction, head first. */
function lying(direction: THREE.Vector3) {
    return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
            new THREE.Vector3().crossVectors(direction, Y),
            direction,
            Y,
        ),
    );
}

/** Which blow a kurent of the brawl deals, and how far into it it is. */
function blow(member: Member, time: number) {
    const count = time / BLOW + member.phase / (2 * Math.PI);
    const round = Math.floor(count);
    const kick = (round + Math.floor(3 * member.phase)) % 3 === 0;
    return { kick, p: count - round };
}

/** How hard a kurent's last blow still shakes the cyclist, 1 when it lands. */
function impact(member: Member, time: number) {
    const { kick, p } = blow(member, time);
    const since = p - (kick ? KICK : STRIKE);
    return since < 0 ? 0 : Math.exp(-since * BLOW * 7);
}

/** The ježevka raised overhead and brought down, as the arm's turn. */
function strikeAngle(p: number) {
    if (p < STRIKE - 0.15) {
        return THREE.MathUtils.lerp(-0.4, -2.8, ease(p / (STRIKE - 0.15)));
    }
    if (p < STRIKE) {
        return THREE.MathUtils.lerp(-2.8, -0.9, (p - STRIKE + 0.15) / 0.15);
    }
    return THREE.MathUtils.lerp(-0.9, -0.4, ease((p - STRIKE) / (1 - STRIKE)));
}

/** The leg drawn back and kicked forward, as the leg's turn. */
function kickAngle(p: number) {
    if (p < KICK - 0.15) {
        return THREE.MathUtils.lerp(0, 0.6, ease(p / (KICK - 0.15)));
    }
    if (p < KICK) {
        return THREE.MathUtils.lerp(0.6, -1.3, (p - KICK + 0.15) / 0.15);
    }
    return THREE.MathUtils.lerp(-1.3, 0, ease((p - KICK) / (1 - KICK)));
}

/** Signed meters from b to a along a loop of a length. */
function apart(a: number, b: number, length: number) {
    return ((((a - b) % length) + 1.5 * length) % length) - 0.5 * length;
}

/** A ballistic arc from one point to another, u running from 0 to 1. */
function arc(from: THREE.Vector3, to: THREE.Vector3, rise: number, u: number) {
    return new THREE.Vector3()
        .lerpVectors(from, to, u)
        .addScaledVector(Y, 4 * rise * u * (1 - u));
}

/** Water thrown up round where something fell in, u running from 0 to 1. */
function splash(
    puffs: THREE.Mesh[],
    water: THREE.Vector3,
    u: number,
    size: number,
    column: number,
) {
    const ring = puffs.length - column;
    puffs.forEach((mesh, index) => {
        mesh.visible = u > 0 && u < 1;
        if (index < ring) {
            const angle = (2 * Math.PI * index) / ring;
            const radius = size * (0.15 + u);
            mesh.position.set(
                water.x + Math.cos(angle) * radius,
                water.y + 0.6 * size * Math.sin(Math.PI * u),
                water.z + Math.sin(angle) * radius,
            );
            mesh.scale.setScalar(0.35 * size * (1 - u) + 0.1);
        } else {
            const height = (index - ring + 1) / column;
            mesh.position.set(
                water.x + 0.3 * Math.sin(index),
                water.y + 1.3 * size * height * Math.sin(Math.PI * u),
                water.z + 0.3 * Math.cos(index),
            );
            mesh.scale.setScalar(0.3 * size * (1 - 0.7 * u));
        }
    });
}

/** A carnival figure playing its looping hop, kurents in their own fur. */
function figure(models: Models, kind: Figure, fur: string, rng: () => number) {
    const object = toonify(source(models, kind).clone(true));
    if (kind === "kurent") {
        const material = toonColored("fur", fur);
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (
                mesh.isMesh &&
                (mesh.material as THREE.Material).name === "fur"
            ) {
                mesh.material = material;
            }
        });
    }
    object.scale.setScalar(FIGURE_SCALE);
    const mixer = new THREE.AnimationMixer(object);
    const clip = models[kind].animations[0];
    if (clip) {
        const action = mixer.clipAction(clip).play();
        action.time = rng() * clip.duration;
        action.timeScale = 0.85 + rng() * 0.3;
    }
    return { object, mixer };
}

/**
 * Spreads a group loosely over the way, each figure at a random spot clear
 * of the others, and returns how far it reaches ahead and behind.
 */
function scatter(kinds: Figure[], rng: () => number) {
    const free = STREET_HALF - MARGIN;
    const reach = (kinds.length * ROOM) / (4 * free);
    const spots: { kind: Figure; along: number; across: number }[] = [];
    for (const kind of kinds) {
        let best = { kind, along: 0, across: 0 };
        let bestGap = -Infinity;
        for (let attempt = 0; attempt < 200 && bestGap < 0; attempt++) {
            const spot = {
                kind,
                along: (2 * rng() - 1) * reach,
                across: kinds.length > 1 ? 2 * rng() - 1 : 0,
            };
            const gap = Math.min(
                ...spots.map(
                    (other) =>
                        Math.hypot(
                            spot.along - other.along,
                            (spot.across - other.across) * free,
                        ) -
                        RADIUS[kind] -
                        RADIUS[other.kind],
                ),
            );
            if (gap > bestGap) {
                best = spot;
                bestGap = gap;
            }
        }
        spots.push(best);
    }
    return { spots, reach };
}

function part(root: THREE.Object3D, name: string): Part {
    const object = root.getObjectByName(name);
    if (!object?.parent) {
        throw new Error(`cyclist has no ${name}`);
    }
    return {
        object,
        parent: object.parent,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
    };
}

function puff(material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7), material);
    mesh.visible = false;
    mesh.userData.puff = true;
    return mesh;
}

/**
 * Kurents running their round along the river in small, loose groups. The
 * figures of a group wander about their spots in it, and close up into a
 * longer file where the way narrows.
 *
 * A "professional" cyclist rides round with them, weaving past the groups
 * until, every minute or so, he rides into one of the bigger ones. The
 * parade stops to watch: the kurents beat him up in a cloud of dust, carry
 * him and his bike to the river and throw them in from the bank or over
 * the railing of a bridge. He swims out with his bike and rides on.
 */
export function Parade({
    models,
    path,
    widths,
    river,
    obstacles,
}: {
    models: Models;
    path: THREE.Vector3[];
    widths: number[];
    river: THREE.Vector3[];
    obstacles: Obstacle[];
}) {
    const scene = useMemo(() => {
        const curve = new THREE.CatmullRomCurve3(path, true);
        const length = curve.getLength();
        const rng = random(1848);
        let furs = 0;
        const scattered = GROUPS.map((kinds) => scatter(kinds, rng));
        const taken = scattered.reduce((sum, { reach }) => sum + 2 * reach, 0);
        const gaps = scattered.map(() => 0.6 + 0.8 * rng());
        const total = gaps.reduce((sum, gap) => sum + gap, 0);
        let offset = 0;
        const groups: Group[] = scattered.map(({ spots, reach }, index) => {
            const group = {
                offset: offset + reach,
                phase: 2 * Math.PI * rng(),
                members: spots.map(({ kind, along, across }) => {
                    const made = figure(
                        models,
                        kind,
                        FUR[furs++ % FUR.length]!,
                        rng,
                    );
                    return {
                        ...made,
                        along,
                        across,
                        phase: 2 * Math.PI * rng(),
                        radius: 0.85 * RADIUS[kind],
                        rank: spots.filter((other) => other.along < along)
                            .length,
                        arm: made.object.getObjectByName("ArmR"),
                        leg: made.object.getObjectByName("LegR"),
                        s: 0,
                        lateral: 0,
                    };
                }),
                yielding: false,
                give: 0,
                side: 1,
            };
            offset += 2 * reach + ((length - taken) * gaps[index]!) / total;
            return group;
        });

        const cyclist = toonify(source(models, "cyclist").clone(true));
        cyclist.scale.setScalar(CYCLIST_SCALE);
        const mixer = new THREE.AnimationMixer(cyclist);
        const clip = models.cyclist.animations[0];
        if (!clip) {
            throw new Error("cyclist has no clip");
        }
        // the clip's two loops, see ptuj-cyclist
        const cut = (name: string, first: number, last: number) =>
            mixer
                .clipAction(
                    THREE.AnimationUtils.subclip(clip, name, first, last),
                )
                .play();
        const gaits = {
            pedalling: cut("pedalling", 0, 30),
            walking: cut("walking", 40, 70),
            crawl: cut("crawl", 80, 110),
            towing: cut("towing", 120, 150),
        };
        const white = toonColored("cloud", "#ffffff");
        const gold = toonColored("gold", "#f5c242");
        const stars = Array.from({ length: STARS }, () => {
            const mesh = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.45),
                gold,
            );
            mesh.visible = false;
            return mesh;
        });
        const puffs = (count: number) =>
            Array.from({ length: count }, () => puff(white));
        const dust = puffs(DUST);
        const splashes = puffs(SPLASH);
        const bikeSplashes = puffs(BIKE_SPLASH);
        const stage = new THREE.Group();
        stage.add(cyclist, ...dust, ...stars, ...splashes, ...bikeSplashes);
        for (const { members } of groups) {
            for (const { object } of members) {
                stage.add(object);
            }
        }
        const track = curve.getSpacedPoints(Math.round(length));
        const water = new THREE.CatmullRomCurve3(river).getSpacedPoints(400);
        // where the way crosses the river, and so near the bridges, about a
        // meter apart
        const wet = track.map((point) =>
            water.some(
                (spot) => Math.hypot(spot.x - point.x, spot.z - point.z) < BANK,
            ),
        );
        const calm = track.map(
            (_, i) =>
                !wet.some(
                    (over, j) =>
                        over &&
                        Math.abs(apart(j, i, track.length)) < BRIDGE_CLEAR,
                ),
        );
        const bridge = track.map((_, i) =>
            wet.some(
                (over, j) => over && Math.abs(apart(j, i, track.length)) < RAMP,
            ),
        );
        return {
            curve,
            length,
            track,
            // only what stands near the parade's way can be in his way
            obstacles: obstacles.filter(({ x, z, radius }) =>
                track.some(
                    (point) =>
                        Math.hypot(point.x - x, point.z - z) <
                        radius + STREET_HALF + GREEN + 2,
                ),
            ),
            groups,
            stage,
            cyclist,
            mixer,
            gaits,
            stars,
            bike: part(cyclist, "Bike"),
            rider: part(cyclist, "Rider"),
            dust,
            splashes,
            bikeSplashes,
            water,
            calm,
            bridge,
            state: {
                rng,
                /** Seconds the parade has walked, leaving out its stops. */
                walked: 0,
                /** The cyclist: meters along the parade and to the right. */
                s: (groups[0]!.offset + groups[1]!.offset) / 2,
                lateral: 0,
                /** The lateral he steers for, and how fast he drifts there. */
                lane: 0,
                drift: 0,
                /** Where he faces, turning after the way a little late. */
                facing: new THREE.Quaternion(),
                fresh: true,
                speed: 0,
                rideEnd: RIDE_MIN + (RIDE_MAX - RIDE_MIN) * rng(),
                crash: undefined as Crash | undefined,
                /** The small group he is stuck behind on a bridge, and since
                 * how long. */
                blockedBy: undefined as Group | undefined,
                blockedFor: 0,
            },
        };
    }, [models, path, river, obstacles]);

    useFrame(({ clock }, frame) => {
        const { curve, length, track, groups, stage, cyclist, mixer } = scene;
        const { bike, rider, dust, stars, water, state } = scene;
        const t = clock.elapsedTime;
        const delta = Math.min(frame, 0.1);
        const brawl = state.crash;
        const c = brawl ? t - brawl.start : 0; // seconds after the crash
        if (!brawl || c > RESUME) {
            state.walked += delta;
        }

        /** Half the width of the way at a distance along the parade. */
        const halfWidth = (at: number) => {
            const position = wrap(at / length) * widths.length;
            const index = Math.floor(position);
            const next = widths[(index + 1) % widths.length]!;
            return THREE.MathUtils.lerp(widths[index]!, next, position - index);
        };
        const squeeze = (at: number) =>
            Math.max(
                1,
                (STREET_HALF - MARGIN) / Math.max(halfWidth(at) - MARGIN, 0.5),
            );
        /** Puts an object on the way, leaving the way's direction in tangent. */
        const place = (object: THREE.Object3D, at: number, lateral: number) => {
            const u = wrap(at / length);
            curve.getPointAt(u, object.position);
            curve.getTangentAt(u, tangent);
            side.set(-tangent.z, 0, tangent.x).normalize();
            object.position.addScaledVector(side, lateral);
        };
        const watch = (object: THREE.Object3D) => {
            spot.copy(brawl && c < GRAB ? brawl.lies : rider.object.position);
            spot.y = object.position.y;
            object.lookAt(spot);
        };

        /** Whether a crash may happen there: on the banks, off the bridges. */
        const calmAt = (at: number) =>
            scene.calm[Math.floor(wrap(at / length) * (scene.calm.length - 1))];
        /** Whether a point of the way is on a bridge, or its ramps. */
        const bridgeAt = (at: number) =>
            scene.bridge[
                Math.floor(wrap(at / length) * (scene.bridge.length - 1))
            ];
        /** Whether kurents walk close by a point of the way. */
        const crowded = (point: THREE.Vector3) =>
            groups.some(({ members }) =>
                members.some(
                    ({ object }) =>
                        Math.hypot(
                            object.position.x - point.x,
                            object.position.z - point.z,
                        ) < 2.5,
                ),
            );
        /** Which of his loops the cyclist moves in. */
        const gait = (name: keyof typeof scene.gaits) => {
            for (const [gait, action] of Object.entries(scene.gaits)) {
                action.setEffectiveWeight(gait === name ? 1 : 0);
            }
        };
        for (const star of stars) {
            star.visible = false;
        }

        // the kurents, some of them busy with the cyclist
        for (const group of groups) {
            const middle =
                group.offset +
                state.walked * PARADE_SPEED +
                3 * Math.sin(state.walked * 0.05 + group.phase);
            const stretch = squeeze(middle);
            // a small group giving way on a bridge, until he is past them
            // or they are off it
            if (
                group.yielding &&
                (group.members.every(
                    (member) => apart(member.s, state.s, length) < -3,
                ) ||
                    !group.members.some((member) => bridgeAt(member.s)))
            ) {
                group.yielding = false;
            }
            group.give = THREE.MathUtils.clamp(
                group.give + (group.yielding ? delta / 1.5 : -delta / 2),
                0,
                1,
            );
            const line = ease(group.give);
            for (const member of group.members) {
                const { object, phase } = member;
                member.s =
                    middle +
                    member.along * stretch +
                    0.6 * Math.sin(t * 0.7 + phase);
                member.lateral =
                    THREE.MathUtils.clamp(
                        member.across + 0.15 * Math.sin(t * 0.5 + 1.3 * phase),
                        -1,
                        1,
                    ) * Math.max(halfWidth(member.s) - MARGIN, 0.3);
                if (line > 0) {
                    // in single file along the railing
                    const file =
                        middle +
                        (member.rank - (group.members.length - 1) / 2) *
                            LINE_GAP;
                    member.s = THREE.MathUtils.lerp(member.s, file, line);
                    member.lateral = THREE.MathUtils.lerp(
                        member.lateral,
                        group.side *
                            Math.max(
                                halfWidth(file) - member.radius - 0.15,
                                0.3,
                            ),
                        line,
                    );
                }
                place(object, member.s, member.lateral);
                object.lookAt(ahead.copy(object.position).add(tangent));
                object.rotateY(0.2 * Math.sin(t * 1.3 + phase));
                let hurry = 1;
                const index = brawl
                    ? brawl.crowd.findIndex((entry) => entry.member === member)
                    : -1;
                if (brawl && member === brawl.victim) {
                    hurry = knocked(member, brawl);
                } else if (brawl && index >= 0) {
                    hurry = busy(member, index, brawl);
                } else if (
                    brawl &&
                    c > BRAWL &&
                    c < RESUME &&
                    object.position.distanceTo(brawl.at) < 40
                ) {
                    watch(object); // the others nearby watch
                }
                member.mixer.update(delta * hurry);
                if (brawl && index >= 0) {
                    strike(member);
                }
            }
        }

        if (!brawl) {
            ride();
        } else if (c < brawl.mounted || crowded(brawl.road)) {
            // waiting at the roadside with his bike while kurents pass
            brawl.mounted = Math.max(brawl.mounted, c);
            deal(brawl);
        } else {
            // back on his bike
            for (const { object, parent, position, quaternion } of [
                bike,
                rider,
            ]) {
                parent.add(object);
                object.position.copy(position);
                object.quaternion.copy(quaternion);
                object.scale.setScalar(1);
                object.visible = true;
            }
            state.crash = undefined;
            state.s = brawl.roadS;
            state.lateral = 0;
            state.lane = 0;
            state.drift = 0;
            state.fresh = true;
            state.speed = 0;
            state.rideEnd = t + RIDE_MIN + (RIDE_MAX - RIDE_MIN) * state.rng();
            ride();
        }

        /**
         * Rides on at a changing speed, keeping to where the figures just
         * ahead leave the most room, and braking behind them when they
         * leave none. Once his time is up he rides into the next of the
         * bigger groups instead, but only along the banks, away from the
         * bridges.
         */
        function ride() {
            const hunting = t > state.rideEnd;
            const road = Math.max(halfWidth(state.s) - 0.4, 0.3);
            const room = road + GREEN;
            const flat = (x: number, z: number, point: THREE.Vector3) =>
                Math.hypot(point.x - x, point.z - z);
            const { x, z } = cyclist.position;
            const shore = water.filter((point) => flat(x, z, point) < 60);
            const things = scene.obstacles.filter(
                (thing) => Math.hypot(thing.x - x, thing.z - z) < 30,
            );
            /** Whether he can ride there off the way: dry, open ground. */
            const open = (lateral: number) => {
                if (Math.abs(lateral) <= road) {
                    return true;
                }
                for (const ahead of LOOK) {
                    const u = wrap((state.s + ahead) / length);
                    curve.getPointAt(u, probe);
                    curve.getTangentAt(u, probeWay);
                    probe.x -= probeWay.z * lateral;
                    probe.z += probeWay.x * lateral;
                    if (
                        shore.some(
                            (point) => flat(probe.x, probe.z, point) < BANK,
                        )
                    ) {
                        return false;
                    }
                    if (
                        things.some(
                            (thing) =>
                                Math.hypot(
                                    thing.x - probe.x,
                                    thing.z - probe.z,
                                ) <
                                thing.radius + 0.8,
                        )
                    ) {
                        return false;
                    }
                }
                return true;
            };
            let goal =
                PARADE_SPEED *
                (FREE_PACE +
                    0.2 * Math.sin(t * 0.31) +
                    0.1 * Math.sin(t * 0.83 + 1));
            let victim: Member | undefined;
            let victimGroup: Group | undefined;
            if (hunting) {
                // the nearest bigger group that will still be out on a bank
                // when he catches up with it, passing those about a bridge
                const closing = (FREE_PACE - 1) * PARADE_SPEED;
                let nearest = length;
                for (const group of groups) {
                    if (group.members.length < BIG_GROUP) {
                        continue;
                    }
                    for (const member of group.members) {
                        const ds = apart(member.s, state.s, length);
                        const caught = member.s + (PARADE_SPEED * ds) / closing;
                        if (
                            ds > 0 &&
                            ds < nearest &&
                            calmAt(member.s) &&
                            calmAt(caught)
                        ) {
                            nearest = ds;
                            victim = member;
                            victimGroup = group;
                        }
                    }
                }
            }
            // the faster he rides, the further ahead he looks
            const sight = Math.max(8, 2.2 * state.speed);
            const near = groups
                .filter((group) => group !== victimGroup)
                .flatMap(({ members }) => members)
                .map((member) => ({
                    member,
                    ds: apart(member.s, state.s, length),
                }))
                .filter(({ ds }) => ds > -1.5 && ds < sight);
            const clearance = (lateral: number) => {
                if (!open(lateral)) {
                    return -10;
                }
                let clear = 3;
                for (const { member } of near) {
                    clear = Math.min(
                        clear,
                        Math.abs(lateral - member.lateral) -
                            member.radius -
                            0.8,
                    );
                }
                return clear;
            };
            // keep to the chosen lane unless another is clearly better
            state.lane = THREE.MathUtils.clamp(state.lane, -room, room);
            let gap = clearance(state.lane);
            let best = gap;
            let lane = state.lane;
            for (let k = 0; k <= 12; k++) {
                const lateral = -room + (2 * room * k) / 12;
                const clear = clearance(lateral);
                // the way is better than the grass
                const score =
                    clear -
                    0.15 * Math.abs(lateral - state.lateral) -
                    (Math.abs(lateral) > road ? 0.6 : 0);
                if (score > best) {
                    best = score;
                    lane = lateral;
                }
            }
            if (best > gap + 0.4 || gap < 0.3) {
                state.lane = lane;
                gap = clearance(lane);
            }
            // going for his victim, as long as no one else is in the way
            const aim = victim
                ? THREE.MathUtils.clamp(victim.lateral, -room, room)
                : 0;
            if (victim && clearance(aim) >= 0.3) {
                state.lane = aim;
                gap = clearance(aim);
                goal = Math.max(goal, 4 * PARADE_SPEED);
            } else {
                // easing off as he comes up to kurents
                const closest = Math.min(
                    sight,
                    ...near.filter(({ ds }) => ds > 0).map(({ ds }) => ds),
                );
                goal = THREE.MathUtils.lerp(
                    goal,
                    PASSING_PACE * PARADE_SPEED,
                    1 - ease((closest - 3) / (sight - 3)),
                );
            }
            if (gap < 0) {
                // no way past: keep behind them, and on a bridge a small
                // group lines up along a railing after a while
                const behind = Math.min(...near.map(({ ds }) => ds));
                goal = Math.min(goal, Math.max(0, behind - 2.5) * 1.2);
                const front = near
                    .filter(({ ds }) => ds > 0)
                    .reduce<{ member: Member; ds: number } | undefined>(
                        (best, next) =>
                            best && best.ds < next.ds ? best : next,
                        undefined,
                    );
                const blocker = groups.find(
                    (group) => front && group.members.includes(front.member),
                );
                if (
                    blocker &&
                    blocker.members.length < BIG_GROUP &&
                    blocker.members.some((member) => bridgeAt(member.s))
                ) {
                    if (state.blockedBy !== blocker) {
                        state.blockedBy = blocker;
                        state.blockedFor = 0;
                    }
                    state.blockedFor += delta;
                    if (state.blockedFor > YIELD_AFTER && !blocker.yielding) {
                        blocker.yielding = true;
                        blocker.side = state.lateral > 0 ? -1 : 1;
                    }
                }
            } else {
                state.blockedFor = Math.max(0, state.blockedFor - delta);
            }
            if (Math.abs(state.lateral) > road) {
                // slower on the grass, and slower still when it runs out
                goal *= open(state.lateral) ? 0.9 : 0.5;
            }
            state.speed += THREE.MathUtils.clamp(
                goal - state.speed,
                -4 * delta,
                3 * delta,
            );
            state.s += state.speed * delta;
            // drift over to the lane gently, like a damped spring
            const pull = 1.3 * (state.lane - state.lateral) - 2.2 * state.drift;
            state.drift = THREE.MathUtils.clamp(
                state.drift + THREE.MathUtils.clamp(pull, -1.8, 1.8) * delta,
                -1.6,
                1.6,
            );
            state.lateral = THREE.MathUtils.clamp(
                state.lateral + state.drift * delta,
                -room,
                room,
            );
            place(cyclist, state.s, state.lateral);
            cyclist.lookAt(
                ahead
                    .copy(cyclist.position)
                    .add(tangent)
                    .addScaledVector(
                        side,
                        state.drift / Math.max(state.speed, 1.5),
                    ),
            );
            cyclist.rotateZ(0.12 * state.drift); // leaning into it
            if (state.fresh) {
                state.facing.copy(cyclist.quaternion);
                state.fresh = false;
            }
            state.facing.slerp(cyclist.quaternion, 1 - Math.exp(-5 * delta));
            cyclist.quaternion.copy(state.facing);
            gait("pedalling");
            mixer.update((delta * state.speed) / 3);
            if (
                victim &&
                victimGroup &&
                victim.object.position.distanceTo(cyclist.position) <
                    victim.radius + 0.8
            ) {
                state.crash = crash(victimGroup, victim);
            }
        }

        function crash(group: Group, victim: Member): Crash {
            const forward = new THREE.Vector3(tangent.x, 0, tangent.z);
            forward.normalize();
            const at = cyclist.position.clone().addScaledVector(forward, 3);
            const lies = at.clone().addScaledVector(forward, 1.2);
            const crowd = group.members
                .filter((member) => member !== victim)
                .map((member) => ({
                    member,
                    distance: member.object.position.distanceTo(at),
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, CROWD)
                .map(({ member }, index, { length: count }) => {
                    const angle = (2 * Math.PI * index) / count;
                    const ring = new THREE.Vector3(
                        Math.cos(angle) * RING,
                        0,
                        Math.sin(angle) * RING,
                    );
                    return { member, ring: ring.add(lies) };
                });
            // to the bank of the river, or the railing when on a bridge
            const flat = (a: THREE.Vector3, b: THREE.Vector3) =>
                Math.hypot(a.x - b.x, a.z - b.z);
            const middle = water.reduce((best, point) =>
                flat(point, at) < flat(best, at) ? point : best,
            );
            const shoreward = new THREE.Vector3(
                at.x - middle.x,
                0,
                at.z - middle.z,
            );
            const onBridge = shoreward.length() < BANK / 2;
            const out = new THREE.Vector3(-forward.z, 0, forward.x);
            if (onBridge) {
                // the bridge runs across the river, so its nearer end
                shoreward
                    .copy(forward)
                    .multiplyScalar(Math.sign(shoreward.dot(forward)) || 1);
            }
            shoreward.normalize();
            const bank = onBridge
                ? at.clone().addScaledVector(forward, 5).addScaledVector(out, 2)
                : middle
                      .clone()
                      .addScaledVector(shoreward, BANK)
                      .addScaledVector(forward, 5);
            bank.y = at.y;
            const inward = onBridge ? out.clone() : shoreward.clone().negate();
            const along = new THREE.Vector3(-inward.z, 0, inward.x);
            const splashAt = bank.clone().addScaledVector(inward, 9);
            splashAt.y = middle.y;
            const bikeWater = bank
                .clone()
                .addScaledVector(inward, 6)
                .addScaledVector(along, 3);
            bikeWater.y = middle.y;
            const shore = middle.clone().addScaledVector(shoreward, BANK - 1);
            // back to the parade's way where it passes the shore
            const index = track.reduce(
                (best, point, i) =>
                    flat(point, shore) < flat(track[best]!, shore) ? i : best,
                0,
            );
            const road = track[index]!.clone();
            shore.y = road.y;
            const way = bank.clone().sub(at).setY(0);
            if (way.lengthSq() < 0.01) {
                way.copy(forward);
            }
            way.normalize();
            const fetched =
                SURFACE + splashAt.distanceTo(bikeWater) / SWIM_SPEED;
            const ashore = fetched + flat(bikeWater, shore) / SWIM_SPEED;
            const standing = ashore + 1;
            const onRoad = standing + 0.5 + flat(shore, road) / WALK_SPEED;
            stage.attach(bike.object);
            stage.attach(rider.object);
            return {
                start: t,
                group,
                victim,
                push: forward,
                at,
                lies,
                bank,
                way,
                across: new THREE.Vector3(-way.z, 0, way.x),
                inward,
                along,
                water: splashAt,
                bikeWater,
                shore,
                road,
                roadS: (index / track.length) * length,
                fetched,
                ashore,
                standing,
                onRoad,
                mounted: onRoad + 1,
                riderFrom: rider.object.position.clone(),
                riderTurn: rider.object.quaternion.clone(),
                carried: lying(way),
                swung: lying(along),
                bikeFrom: bike.object.position.clone(),
                bikeTurn: bike.object.quaternion.clone(),
                crowd,
            };
        }

        /** Where the carriers carry him, on the ground under his middle. */
        function carried(crash: Crash, time: number) {
            const k = ease((time - CARRY) / (SWING - CARRY));
            return new THREE.Vector3().lerpVectors(crash.at, crash.bank, k);
        }

        /** How far forward, towards the water, they swing him. */
        function swing(time: number) {
            const since = Math.max(0, time - SWING - 0.5);
            const reach = 0.6 + (0.8 * since) / (RELEASE - SWING - 0.5);
            return -reach * Math.sin((2 * Math.PI * since) / SWING_TIME);
        }

        /** Where a carrier stands while carrying, and while swinging. */
        function bearer(crash: Crash, index: number, time: number) {
            const middle = carried(crash, Math.min(time, SWING));
            const [ahead, aside] = (
                [
                    [1, 0.9],
                    [1, -0.9],
                    [-1, 0.9],
                    [-1, -0.9],
                    [-0.3, 2.8],
                ] as const
            )[index]!;
            const carrying = middle
                .clone()
                .addScaledVector(crash.way, ahead)
                .addScaledVector(crash.across, aside);
            const swinging = middle
                .clone()
                .addScaledVector(crash.along, 1.1 * ahead)
                .addScaledVector(crash.inward, -aside)
                .addScaledVector(crash.inward, 0.4 * swing(time));
            return carrying.lerp(swinging, ease((time - SWING) / 0.5));
        }

        /**
         * The kurent he rode into: knocked flat on its face, lying still,
         * then slowly getting up and swaying, dazed, under circling stars.
         * Returns its pace.
         */
        function knocked(member: Member, crash: Crash) {
            const { object, phase } = member;
            const back = 1 - ease((c - BACK) / 4);
            object.position.addScaledVector(
                crash.push,
                1.6 * ease(c / 0.5) * back,
            );
            if (c > DAZED) {
                if (c < RESUME) {
                    watch(object);
                }
                return 1;
            }
            const down = ease(c / 0.4) * (1 - ease((c - 1.8) / 3));
            object.lookAt(ahead.copy(object.position).add(crash.push));
            object.rotateX((Math.PI / 2) * down);
            const dazed = bump(c, 1.8, 2.5, DAZED - 1, DAZED);
            object.rotateZ(0.2 * dazed * Math.sin(t * 2.5 + phase));
            object.rotateY(0.25 * dazed * Math.sin(t * 1.3));
            const head = object.position
                .clone()
                .addScaledVector(Y, 3.2 * Math.cos((Math.PI / 2) * down))
                .addScaledVector(
                    crash.push,
                    3.2 * Math.sin((Math.PI / 2) * down),
                );
            stars.forEach((star, index) => {
                const angle = t * 4 + (2 * Math.PI * index) / STARS;
                star.position
                    .copy(head)
                    .add(
                        spot.set(
                            0.7 * Math.cos(angle),
                            0.8 + 0.1 * Math.sin(t * 6 + index),
                            0.7 * Math.sin(angle),
                        ),
                    );
                star.rotation.set(0, t * 5, 0);
                star.visible = c > 0.4 && c < DAZED;
            });
            return c < 1.8 ? 0 : 0.5;
        }

        /** Swings the ježevka or kicks, after the hop has moved the limbs. */
        function strike(member: Member) {
            const w = bump(c, 2.5, 3, GRAB - 0.8, GRAB - 0.3);
            if (w <= 0) {
                return;
            }
            const { kick, p } = blow(member, t);
            if (kick && member.leg) {
                member.leg.rotation.x = THREE.MathUtils.lerp(
                    member.leg.rotation.x,
                    kickAngle(p),
                    w,
                );
            } else if (member.arm) {
                member.arm.rotation.x = THREE.MathUtils.lerp(
                    member.arm.rotation.x,
                    strikeAngle(p),
                    w,
                );
            }
            // leaning into the blow
            member.object.rotateX(
                0.15 * w * Math.max(0, Math.sin(Math.PI * p)),
            );
        }

        /** Moves a kurent of the crowd round the cyclist; returns its pace. */
        function busy(member: Member, index: number, crash: Crash) {
            const { object, phase } = member;
            const { ring } = crash.crowd[index]!;
            let pace = 1;
            if (index <= CARRIERS) {
                // a carrier: round him, carrying him off, back to its place
                spot.copy(ring);
                if (c > GRAB) {
                    spot.lerp(bearer(crash, index, c), ease(c - GRAB));
                }
                const k = ease(c - BRAWL) * (1 - ease((c - BACK) / 4));
                object.position.lerp(spot, k);
                pace = c > CARRY && c < SWING ? 1.6 : 1 + k;
            } else {
                const k = bump(c, BRAWL, 2.5, GRAB, 18);
                object.position.lerp(ring, k);
                pace = 1 + k;
            }
            // stomping during the brawl
            object.position.y +=
                0.4 *
                bump(c, 2.5, 3, GRAB - 0.5, GRAB) *
                Math.abs(Math.sin(t * 9 + phase));
            if (index <= CARRIERS && c > GRAB && c < SWING) {
                object.lookAt(ahead.copy(object.position).add(crash.way));
            } else if (index <= CARRIERS && c >= SWING && c < BACK) {
                object.lookAt(ahead.copy(object.position).add(crash.inward));
            } else if (c > BRAWL && c < RESUME) {
                watch(object);
            }
            return pace;
        }

        /** The cyclist from the crash until he is back on his bike. */
        function deal(crash: Crash) {
            const { at, inward, along } = crash;
            const body = rider.object;
            const wheels = bike.object;
            const walk = c > crash.standing && c < crash.onRoad;
            const swim = c >= SURFACE && c < crash.ashore;
            const towing = swim && c >= crash.fetched;
            gait(
                walk
                    ? "walking"
                    : towing
                      ? "towing"
                      : swim
                        ? "crawl"
                        : "pedalling",
            );
            mixer.update(
                delta *
                    (walk || swim
                        ? 1
                        : c < LANDED
                          ? 3
                          : c < crash.onRoad
                            ? 1.5
                            : 0),
            );

            // the rider: over the handlebar, beaten in the dust, carried off
            // face up, swung three times, thrown in, swimming to his bike
            // and towing it ashore, then walking it up to the road
            const held = (time: number) =>
                carried(crash, time)
                    .addScaledVector(Y, OVERHEAD + 0.08 * Math.sin(t * 6))
                    .addScaledVector(crash.way, -1.2);
            const swungAt = (time: number) => {
                const forward = swing(time);
                return carried(crash, SWING)
                    .addScaledVector(Y, SWUNG + 0.35 * Math.abs(forward))
                    .addScaledVector(inward, forward)
                    .addScaledVector(along, -1.2);
            };
            const stroke = (time: number) => {
                const from =
                    time < crash.fetched ? crash.water : crash.bikeWater;
                const to = time < crash.fetched ? crash.bikeWater : crash.shore;
                return to.clone().sub(from).setY(0).normalize();
            };
            const swimming = (time: number) => {
                if (time < crash.fetched) {
                    const k = (time - SURFACE) / (crash.fetched - SURFACE);
                    return spot.lerpVectors(crash.water, crash.bikeWater, k);
                }
                const k =
                    (time - crash.fetched) / (crash.ashore - crash.fetched);
                return spot.lerpVectors(crash.bikeWater, crash.shore, k);
            };
            if (c < BRAWL) {
                body.position
                    .lerpVectors(crash.riderFrom, at, c)
                    .addScaledVector(Y, 6 * c * (1 - c));
                body.quaternion
                    .copy(crash.riderTurn)
                    .multiply(
                        turn.setFromAxisAngle(X, 2.5 * Math.PI * ease(c)),
                    );
            } else if (c < GRAB) {
                // jolted away from every blow that lands, curling up
                const w = bump(c, 2.5, 3, GRAB - 0.8, GRAB - 0.3);
                let jolt = 0;
                shake.set(0, 0, 0);
                for (const { member } of crash.crowd) {
                    const k = impact(member, t) * w;
                    if (k > 0.01) {
                        jolt += k;
                        spot.copy(crash.lies)
                            .sub(member.object.position)
                            .setY(0)
                            .normalize();
                        shake.addScaledVector(spot, 0.3 * k);
                    }
                }
                jolt = Math.min(jolt, 1);
                body.position.copy(at).add(shake);
                body.position.y += 0.25 * jolt;
                body.quaternion
                    .copy(crash.riderTurn)
                    .multiply(
                        turn.setFromAxisAngle(
                            X,
                            2.5 * Math.PI +
                                0.05 * Math.sin(t * 23) -
                                0.35 * jolt,
                        ),
                    )
                    .multiply(
                        turn.setFromAxisAngle(Y, 0.4 * jolt * Math.sin(t * 17)),
                    );
            } else if (c < CARRY) {
                body.position.lerpVectors(at, held(CARRY), ease(c - GRAB));
                body.quaternion.slerp(crash.carried, ease(c - GRAB));
            } else if (c < SWING) {
                body.position.copy(held(c));
                body.quaternion.copy(crash.carried);
            } else if (c < RELEASE) {
                const k = ease((c - SWING) / 0.5);
                body.position.lerpVectors(held(SWING), swungAt(c), k);
                body.quaternion.slerpQuaternions(crash.carried, crash.swung, k);
            } else if (c < SURFACE) {
                const u = Math.min((c - RELEASE) / FLIGHT, 1);
                body.position.copy(arc(swungAt(RELEASE), crash.water, 1.8, u));
                // under for a moment, then up again
                body.position.y -=
                    1.5 * bump(c, LANDED, LANDED + 0.4, SURFACE - 0.4, SURFACE);
                body.quaternion
                    .copy(crash.swung)
                    .premultiply(turn.setFromAxisAngle(along, -1.2 * u));
            } else if (c < crash.ashore) {
                const heading = stroke(c);
                body.position.copy(swimming(c));
                body.position.y = Math.max(
                    crash.water.y - 0.25 + 0.12 * Math.sin(t * 4),
                    THREE.MathUtils.lerp(
                        crash.water.y,
                        crash.shore.y,
                        ease((c - crash.ashore + 2) / 2),
                    ),
                );
                // stretched out face down, rolling with his strokes
                const strokeLoop = towing
                    ? scene.gaits.towing
                    : scene.gaits.crawl;
                const strokes = strokeLoop.time / strokeLoop.getClip().duration;
                body.quaternion
                    .copy(facing(heading))
                    .multiply(turn.setFromAxisAngle(X, Math.PI / 2))
                    .multiply(
                        turn.setFromAxisAngle(
                            Y,
                            (towing ? 0.15 : 0.35) *
                                Math.sin(2 * Math.PI * strokes),
                        ),
                    );
            } else {
                const heading = crash.road.clone().sub(crash.shore).setY(0);
                if (heading.lengthSq() < 0.01) {
                    heading.copy(inward).negate();
                }
                heading.normalize();
                const k = ease(
                    (c - crash.standing - 0.5) /
                        (crash.onRoad - crash.standing),
                );
                body.position.lerpVectors(crash.shore, crash.road, k);
                // getting up, then walking his bike, upright
                const up = ease(c - crash.ashore);
                body.position.y -= 0.3 * up;
                body.quaternion
                    .copy(facing(heading))
                    .multiply(
                        turn.setFromAxisAngle(X, (Math.PI / 2) * (1 - up)),
                    );
            }
            body.visible = !(c > LANDED + 0.3 && c < SURFACE - 0.3);

            // the bike: skidding over on its side, carried by the fifth
            // kurent, thrown in after him, towed ashore and walked up
            const bikeHeld = (time: number) =>
                bearer(crash, CARRIERS, time).addScaledVector(Y, 2.9);
            const late = RELEASE + 0.3;
            const onSide = turn.setFromAxisAngle(Z, Math.PI / 2);
            if (c < GRAB) {
                wheels.position.copy(crash.bikeFrom);
                wheels.quaternion
                    .copy(crash.bikeTurn)
                    .multiply(
                        turn.setFromAxisAngle(Z, (Math.PI / 2) * ease(c)),
                    );
            } else if (c < late) {
                wheels.position.lerpVectors(
                    crash.bikeFrom,
                    bikeHeld(c),
                    ease(c - GRAB),
                );
            } else if (c < crash.fetched) {
                const u = Math.min((c - late) / FLIGHT, 1);
                wheels.position.copy(
                    arc(bikeHeld(late), crash.bikeWater, 1.4, u),
                );
                wheels.position.y = Math.max(
                    wheels.position.y,
                    crash.water.y - 0.25 + 0.08 * Math.sin(t * 3),
                );
                wheels.quaternion
                    .copy(crash.bikeTurn)
                    .multiply(onSide)
                    .premultiply(turn.setFromAxisAngle(along, 2 * Math.PI * u));
            } else if (c < crash.ashore) {
                // on its side in the water, in his right hand
                const heading = stroke(c);
                const right = new THREE.Vector3().crossVectors(Y, heading);
                spot.copy(body.position)
                    .addScaledVector(heading, 1)
                    .addScaledVector(right, 1);
                wheels.position.lerpVectors(
                    crash.bikeWater,
                    spot,
                    ease((c - crash.fetched) / 0.6),
                );
                wheels.position.y =
                    crash.water.y - 0.2 + 0.08 * Math.sin(t * 3);
                wheels.quaternion.copy(facing(heading)).multiply(onSide);
            } else {
                // stood up beside him and pushed up to the road
                const heading = crash.road.clone().sub(crash.shore).setY(0);
                if (heading.lengthSq() < 0.01) {
                    heading.copy(inward).negate();
                }
                heading.normalize();
                const up = ease(c - crash.ashore);
                wheels.position
                    .copy(body.position)
                    .addScaledVector(Y, 0.3 * up)
                    .addScaledVector(
                        new THREE.Vector3(-heading.z, 0, heading.x),
                        0.7,
                    )
                    .addScaledVector(heading, 0.4);
                wheels.quaternion
                    .copy(facing(heading))
                    .multiply(
                        turn.setFromAxisAngle(Z, (Math.PI / 2) * (1 - up)),
                    );
            }

            // dust kicked up round their feet, low enough to see the blows
            const fade = bump(c, 1.5, 2, GRAB - 0.5, GRAB);
            dust.forEach((mesh, index) => {
                const angle = (2 * Math.PI * index) / DUST + t * 1.5;
                const puffing = (t * 1.3 + index * 0.37) % 1;
                const radius = 1.4 + 1.2 * puffing;
                const { lies } = crash;
                mesh.position.set(
                    lies.x + Math.cos(angle) * radius,
                    lies.y + 0.3 + 0.8 * puffing,
                    lies.z + Math.sin(angle) * radius,
                );
                mesh.scale.setScalar(
                    fade * (0.5 + 0.9 * Math.sin(Math.PI * puffing)),
                );
                mesh.visible = fade > 0;
            });
            splash(scene.splashes, crash.water, (c - LANDED) / 2, 7, 4);
            splash(
                scene.bikeSplashes,
                crash.bikeWater,
                (c - late - FLIGHT) / 1.6,
                4,
                0,
            );
        }
    });

    return <primitive object={scene.stage} />;
}
