import * as THREE from "three";
import type { MapData, Network } from "./map";
import { PALETTE, TRAFFIC_ORDER } from "./layers";

// the traffic runs this many times faster than real, so it shows on a map
// many kilometers wide
const TIME_SCALE = 6;
const CARS = 900;
// km/h and how much traffic each kind of road carries, by the kinds of
// the map; none on the pedestrian zones
const ROADS: Record<string, { speed: number; weight: number }> = {
    motorway: { speed: 110, weight: 8 },
    trunk: { speed: 90, weight: 6 },
    primary: { speed: 70, weight: 6 },
    secondary: { speed: 60, weight: 4 },
    tertiary: { speed: 50, weight: 3 },
    unclassified: { speed: 40, weight: 1 },
    residential: { speed: 30, weight: 1 },
    living_street: { speed: 15, weight: 0.3 },
    pedestrian: { speed: 0, weight: 0 },
};
const KEEP_RIGHT = 2; // meters right of the middle of the road
const TRAINS = 3;
const WAGONS = 5;
const WAGON = 26; // meters from one wagon to the next
const TRAIN_SPEED = 80; // km/h
const STATION_STOP = 4; // seconds a train stands at the station
const SLOWING = 600; // meters before the station a train starts to slow
const STOP_WITHIN = 60; // meters from the station a train stops

const kmh = (speed: number) => (speed / 3.6) * TIME_SCALE;

interface Edge {
    a: number;
    b: number;
    kind: string;
    /** x and z of its points in the scene, and the distance to each. */
    points: Float32Array;
    along: Float32Array;
    length: number;
}

/** A network of the map, ready to drive on. */
class Graph {
    readonly edges: Edge[];
    /** The edges at each node. */
    readonly at: number[][];
    readonly exits: Set<number>;
    readonly exitList: number[];

    constructor(network: Network, kinds?: string[]) {
        const count = network.nodes.length / 2;
        this.at = Array.from({ length: count }, () => []);
        this.edges = network.edges.map((raw, index) => {
            const a = raw[0] as number;
            const b = raw[1] as number;
            const flat = (kinds ? raw[3] : raw[2]) as number[];
            const kind = kinds ? kinds[raw[2] as number]! : "rail";
            const n = flat.length / 2;
            const points = new Float32Array(n * 2);
            const along = new Float32Array(n);
            for (let k = 0; k < n; k++) {
                points[2 * k] = flat[2 * k]!;
                points[2 * k + 1] = -flat[2 * k + 1]!;
                if (k > 0) {
                    along[k] =
                        along[k - 1]! +
                        Math.hypot(
                            points[2 * k]! - points[2 * k - 2]!,
                            points[2 * k + 1]! - points[2 * k - 1]!,
                        );
                }
            }
            this.at[a]!.push(index);
            if (b !== a) {
                this.at[b]!.push(index);
            }
            return { a, b, kind, points, along, length: along[n - 1]! };
        });
        this.exits = new Set(network.exits);
        this.exitList = network.exits.filter((node) => this.at[node]!.length);
    }

    /**
     * The point at a distance along an edge, driven forwards (a to b) or
     * backwards, and the direction there, into out: x, z, dx, dz.
     */
    sample(edge: Edge, s: number, forward: boolean, out: Float32Array) {
        const distance = forward ? s : edge.length - s;
        const along = edge.along;
        let lo = 0;
        let hi = along.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (along[mid]! <= distance) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        const span = along[hi]! - along[lo]! || 1;
        const t = Math.min(Math.max((distance - along[lo]!) / span, 0), 1);
        const p = edge.points;
        const dx = p[2 * hi]! - p[2 * lo]!;
        const dz = p[2 * hi + 1]! - p[2 * lo + 1]!;
        const norm = Math.hypot(dx, dz) || 1;
        out[0] = p[2 * lo]! + dx * t;
        out[1] = p[2 * lo + 1]! + dz * t;
        out[2] = ((forward ? 1 : -1) * dx) / norm;
        out[3] = ((forward ? 1 : -1) * dz) / norm;
    }

    /** The node at the end of an edge driven one way, and the far one. */
    end(edge: Edge, forward: boolean) {
        return forward ? edge.b : edge.a;
    }

    /** The direction an edge leaves a node in. */
    leaving(edge: Edge, node: number, out: Float32Array) {
        this.sample(edge, 0, edge.a === node, out);
        return out;
    }
}

/** Glowing points, round or square, as many pixels wide at any zoom. */
function glowing(count: number, color: string, size: number, square: boolean) {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    const alphas = new THREE.BufferAttribute(new Float32Array(count), 1);
    alphas.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positions);
    geometry.setAttribute("alpha", alphas);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(color) },
            size: { value: size },
        },
        vertexShader: `
            attribute float alpha;
            uniform float size;
            varying float vAlpha;
            void main() {
                vAlpha = alpha;
                gl_Position = projectionMatrix * modelViewMatrix *
                    vec4(position, 1.0);
                gl_PointSize = size;
            }`,
        fragmentShader: `
            uniform vec3 color;
            varying float vAlpha;
            void main() {
                vec2 p = gl_PointCoord - 0.5;
                float d = ${square ? "max(abs(p.x), abs(p.y))" : "length(p)"};
                // a crisp core with only a faint rim of glow, kept dim
                // enough that the bloom hardly takes it up
                float core = 1.0 - smoothstep(0.3, 0.38, d);
                float glow = (1.0 - smoothstep(0.3, 0.5, d)) * 0.12;
                float light = (core * 0.7 + glow) * vAlpha;
                if (light < 0.01) discard;
                gl_FragColor = vec4(color * light, light);
            }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // they move all over the map
    points.renderOrder = TRAFFIC_ORDER;
    return { points, positions, alphas };
}

function pick<T>(items: T[], weight: (item: T) => number) {
    let total = 0;
    for (const item of items) {
        total += weight(item);
    }
    let r = Math.random() * total;
    for (const item of items) {
        r -= weight(item);
        if (r <= 0) {
            return item;
        }
    }
    return items[items.length - 1];
}

/**
 * Cars as glowing dots driving the roads at their speeds, keeping right,
 * turning at random where roads meet, rather onto the bigger roads, and
 * leaving and entering the municipality where its roads cross its border.
 */
class Cars {
    readonly points: THREE.Points;
    private readonly positions: THREE.BufferAttribute;
    private readonly alphas: THREE.BufferAttribute;
    private readonly edge: Int32Array;
    private readonly s: Float32Array;
    private readonly forward: Uint8Array;
    private readonly fade: Float32Array;
    private readonly sample = new Float32Array(4);
    private readonly driven: number[];

    constructor(
        private readonly graph: Graph,
        count: number,
        dpr: number,
    ) {
        const made = glowing(count, PALETTE.car, 4 * dpr, false);
        this.points = made.points;
        this.positions = made.positions;
        this.alphas = made.alphas;
        this.edge = new Int32Array(count);
        this.s = new Float32Array(count);
        this.forward = new Uint8Array(count);
        this.fade = new Float32Array(count);
        this.driven = graph.edges
            .map((_, index) => index)
            .filter((index) => this.weight(index) > 0);
        for (let car = 0; car < count; car++) {
            this.place(car);
        }
    }

    private weight(index: number) {
        return ROADS[this.graph.edges[index]!.kind]?.weight ?? 0;
    }

    /** Puts a car somewhere on the roads, more likely on the busy ones. */
    private place(car: number) {
        const index = pick(
            this.driven,
            (i) => this.weight(i) * this.graph.edges[i]!.length,
        )!;
        this.edge[car] = index;
        this.s[car] = Math.random() * this.graph.edges[index]!.length;
        this.forward[car] = Math.random() < 0.5 ? 1 : 0;
        this.fade[car] = 0;
    }

    /** Has a car come in over the border of the municipality. */
    private enter(car: number) {
        const node =
            this.graph.exitList[
                Math.floor(Math.random() * this.graph.exitList.length)
            ];
        const edges = node === undefined ? [] : this.graph.at[node]!;
        const index = edges.find((i) => this.weight(i) > 0);
        if (index === undefined) {
            this.place(car);
            return;
        }
        this.edge[car] = index;
        this.s[car] = 0;
        this.forward[car] = this.graph.edges[index]!.a === node ? 1 : 0;
        this.fade[car] = 0;
    }

    update(delta: number) {
        const graph = this.graph;
        const sample = this.sample;
        for (let car = 0; car < this.edge.length; car++) {
            let edge = graph.edges[this.edge[car]!]!;
            const speed = kmh(ROADS[edge.kind]!.speed);
            this.s[car]! += speed * delta;
            while (this.s[car]! > edge.length) {
                this.s[car]! -= edge.length;
                const node = graph.end(edge, this.forward[car] === 1);
                if (graph.exits.has(node)) {
                    this.enter(car);
                    edge = graph.edges[this.edge[car]!]!;
                    break;
                }
                const options = graph.at[node]!.filter(
                    (i) => i !== this.edge[car] && this.weight(i) > 0,
                );
                const next = options.length
                    ? pick(options, (i) => this.weight(i))!
                    : this.edge[car]!; // a dead end: turn round
                this.edge[car] = next;
                edge = graph.edges[next]!;
                this.forward[car] = edge.a === node ? 1 : 0;
            }
            graph.sample(edge, this.s[car]!, this.forward[car] === 1, sample);
            // keep right: the right of heading (dx, dz) is (-dz, dx)
            this.positions.setXYZ(
                car,
                sample[0]! - sample[3]! * KEEP_RIGHT,
                0,
                sample[1]! + sample[2]! * KEEP_RIGHT,
            );
            this.fade[car] = Math.min(this.fade[car]! + delta * 2, 1);
            this.alphas.setX(car, this.fade[car]!);
        }
        this.positions.needsUpdate = true;
        this.alphas.needsUpdate = true;
    }
}

interface Train {
    edge: number;
    s: number;
    forward: boolean;
    speed: number;
    /** Seconds it still stands at the station. */
    standing: number;
    /** Whether it has stopped at the station on this run. */
    stopped: boolean;
    /** Where the head has been, x and z, most recent last. */
    trail: number[];
    /** Seconds before it comes in again, after leaving the map. */
    away: number;
}

/**
 * Trains as glowing squares, a locomotive and its wagons, running the
 * railway straight through its switches, slowing down to stop at the
 * station of Ptuj, and leaving and entering the municipality at its ends.
 */
class Trains {
    readonly points: THREE.Points;
    private readonly positions: THREE.BufferAttribute;
    private readonly alphas: THREE.BufferAttribute;
    private readonly trains: Train[];
    private readonly sample = new Float32Array(4);
    private readonly other = new Float32Array(4);

    constructor(
        private readonly graph: Graph,
        private readonly station: THREE.Vector3 | undefined,
        dpr: number,
    ) {
        const made = glowing(TRAINS * WAGONS, PALETTE.train, 7 * dpr, true);
        this.points = made.points;
        this.positions = made.positions;
        this.alphas = made.alphas;
        this.trains = Array.from({ length: TRAINS }, (_, k) => {
            const train = this.enter();
            train.away = k * 25; // one after the other
            return train;
        });
    }

    /** A train coming in at one of the ends of the railway. */
    private enter(): Train {
        const ends = this.graph.exitList;
        const node = ends[Math.floor(Math.random() * ends.length)];
        const edge = node === undefined ? 0 : (this.graph.at[node]![0] ?? 0);
        return {
            edge,
            s: 0,
            forward: this.graph.edges[edge]?.a === node,
            speed: kmh(TRAIN_SPEED),
            standing: 0,
            stopped: false,
            trail: [],
            away: 5 + Math.random() * 20,
        };
    }

    /** The edge that goes on from a node most nearly straight on. */
    private straightOn(train: Train, node: number) {
        const graph = this.graph;
        const edge = graph.edges[train.edge]!;
        graph.sample(edge, edge.length, train.forward, this.sample);
        let best: number | undefined;
        let bestDot = 0.3; // no sharper than about 70 degrees
        for (const index of graph.at[node]!) {
            if (index === train.edge) {
                continue;
            }
            graph.leaving(graph.edges[index]!, node, this.other);
            const dot =
                this.sample[2]! * this.other[2]! +
                this.sample[3]! * this.other[3]!;
            if (dot > bestDot) {
                bestDot = dot;
                best = index;
            }
        }
        return best;
    }

    update(delta: number) {
        const graph = this.graph;
        if (!graph.edges.length) {
            return;
        }
        this.trains.forEach((train, t) => {
            if (train.away > 0) {
                train.away -= delta;
                for (let w = 0; w < WAGONS; w++) {
                    this.alphas.setX(t * WAGONS + w, 0);
                }
                return;
            }
            // slow down for the station, stand there a while, set off
            const target = kmh(TRAIN_SPEED);
            let wanted = target;
            const head = this.sample;
            graph.sample(
                graph.edges[train.edge]!,
                train.s,
                train.forward,
                head,
            );
            if (this.station && !train.stopped) {
                const d = Math.hypot(
                    head[0]! - this.station.x,
                    head[1]! - this.station.z,
                );
                if (d < SLOWING) {
                    wanted = target * Math.max(d / SLOWING, 0.04);
                }
                if (d < STOP_WITHIN) {
                    train.stopped = true;
                    train.standing = STATION_STOP;
                    train.speed = 0;
                }
            }
            if (train.standing > 0) {
                train.standing -= delta;
                wanted = 0;
            }
            train.speed += (wanted - train.speed) * Math.min(delta * 1.5, 1);
            train.s += train.speed * delta;
            let edge = graph.edges[train.edge]!;
            while (train.s > edge.length) {
                train.s -= edge.length;
                const node = graph.end(edge, train.forward);
                if (graph.exits.has(node)) {
                    Object.assign(train, this.enter());
                    return;
                }
                const next = this.straightOn(train, node);
                if (next === undefined) {
                    // the end of a siding: back out of it
                    train.forward = !train.forward;
                    train.s = edge.length - train.s;
                    train.trail = [];
                    continue;
                }
                train.edge = next;
                edge = graph.edges[next]!;
                train.forward = edge.a === node;
            }
            graph.sample(edge, train.s, train.forward, head);
            const trail = train.trail;
            const n = trail.length;
            if (
                n < 2 ||
                Math.hypot(head[0]! - trail[n - 2]!, head[1]! - trail[n - 1]!) >
                    2
            ) {
                trail.push(head[0]!, head[1]!);
                if (trail.length > 2 * 120) {
                    trail.splice(0, trail.length - 2 * 120);
                }
            }
            // the wagons follow the trail of the head
            for (let w = 0; w < WAGONS; w++) {
                const index = t * WAGONS + w;
                let behind = w * WAGON;
                let k = trail.length - 2;
                let x = head[0]!;
                let z = head[1]!;
                while (behind > 0 && k >= 0) {
                    const step = Math.hypot(trail[k]! - x, trail[k + 1]! - z);
                    if (step >= behind) {
                        x += ((trail[k]! - x) * behind) / step;
                        z += ((trail[k + 1]! - z) * behind) / step;
                        behind = 0;
                        break;
                    }
                    behind -= step;
                    x = trail[k]!;
                    z = trail[k + 1]!;
                    k -= 2;
                }
                this.positions.setXYZ(index, x, 0, z);
                // a wagon shows once the train has come that far in
                this.alphas.setX(index, behind > 0 ? 0 : 1);
            }
            if (train.stopped && this.station) {
                const d = Math.hypot(
                    head[0]! - this.station.x,
                    head[1]! - this.station.z,
                );
                train.stopped = d < SLOWING * 1.5;
            }
        });
        this.positions.needsUpdate = true;
        this.alphas.needsUpdate = true;
    }
}

/** The road and railway traffic of the municipality. */
export class Traffic {
    readonly group = new THREE.Group();
    private readonly cars: Cars;
    private readonly trains: Trains;

    constructor(map: MapData, dpr: number) {
        const station = map.landmarks.find(({ icon }) => icon === "station");
        this.cars = new Cars(new Graph(map.roads, map.roads.kinds), CARS, dpr);
        this.trains = new Trains(
            new Graph(map.rails),
            station && new THREE.Vector3(station.at[0], 0, -station.at[1]),
            dpr,
        );
        this.group.add(this.cars.points, this.trains.points);
    }

    update(delta: number) {
        // a long pause, as in a hidden tab, is not driven through
        const step = Math.min(delta, 0.1);
        this.cars.update(step);
        this.trains.update(step);
    }
}
