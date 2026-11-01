import * as THREE from "three";

/**
 * The map of the municipality, as inkscape-scripts/osm/ptujmap.py writes it
 * from OpenStreetMap data: positions are flat lists of x (meters east of
 * the town hall) and y (meters north of it), x0, y0, x1, y1, ...
 */
export interface MapData {
    outline: number[];
    water: Polygon[];
    streams: number[][];
    woods: number[][];
    vineyards: number[][];
    parks: number[][];
    quarters: {
        name: string;
        kind: "quarter" | "village";
        label: [number, number];
        shapes: Polygon[];
    }[];
    landmarks: { name: string; icon: string; at: [number, number] }[];
    /** Schools, health care, institutions, restaurants and bars. */
    pois?: {
        name: string;
        icon: string;
        group: "health" | "public" | "education" | "food";
        at: [number, number];
    }[];
    roads: Network & { kinds: string[] };
    rails: Network;
}

export interface Polygon {
    outer: number[];
    holes: number[][];
}

/**
 * Nodes, and edges between them with the points along them; road edges
 * are [from, to, kind, points], rail edges [from, to, points]. Exits are
 * the nodes where a way leaves the municipality.
 */
export interface Network {
    nodes: number[];
    exits: number[];
    edges: (number | number[])[][];
}

export async function loadMap(url = "map/ptuj.json"): Promise<MapData> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

/**
 * The map lies on the ground of the scene: x stays east, and north, the
 * map's y, runs along -z, since three.js has y up.
 */
export function ground(x: number, y: number, height = 0) {
    return new THREE.Vector3(x, height, -y);
}

/** The points of a flat list as pairs. */
export function pairs(flat: number[]) {
    const result: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
        result.push([flat[i]!, flat[i + 1]!]);
    }
    return result;
}

/** Even-odd test of a point against a ring given as a flat list. */
export function within(x: number, y: number, ring: number[]) {
    let result = false;
    const n = ring.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const ax = ring[i]!;
        const ay = ring[i + 1]!;
        const bx = ring[j]!;
        const by = ring[j + 1]!;
        if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) {
            result = !result;
        }
    }
    return result;
}

export function inPolygon(x: number, y: number, polygon: Polygon) {
    return (
        within(x, y, polygon.outer) &&
        !polygon.holes.some((hole) => within(x, y, hole))
    );
}
