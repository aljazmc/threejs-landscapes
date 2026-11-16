import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Ground } from "./ground";
import { Icons } from "./icons";
import { type MapData, type Polygon, pairs } from "./map";
import { FALLBACK, MODELS, reach } from "./models";
import { LIFT, type Terrain } from "./terrain";

/**
 * The colors of the map, all cyan on a dark ground, as on the vector
 * screens of the 80s and 90s.
 */
export const PALETTE = {
    sky: "#010508",
    wireframe: "#0a6f82",
    shade: "#03202a",
    land: "#03141b",
    woods: "#05303a",
    vineyards: "#062731",
    parks: "#073a44",
    water: "#06495e",
    shore: "#3ff4ff",
    stream: "#1aa9c4",
    road: "#00c8ec",
    major: "#7ff6ff",
    rail: "#8ffaff",
    outline: "#00e5ff",
    border: "#00e5ff",
    car: "#3fd8ee",
    train: "#e0ffff",
    icon: "#5ff0ff",
    landmark: "#e6ffff",
};

// layers drawn bottom up: the areas flat into the ground's texture, where
// the order decides; over the hills, the ground hides what lies behind it,
// and among the lines and points on it, the order decides
const ORDER = {
    ground: -1,
    wireframe: 0,
    land: 1,
    cover: 2,
    water: 3,
    quarter: 4,
    lines: 5,
    outline: 6,
    icons: 7,
    traffic: 8,
    // over all of it: the veil over the quarters not chosen, and the bold
    // border of the chosen one
    veil: 9,
    chosen: 10,
};
// major roads and the minor ones by the kinds of the map
const MAJOR = ["motorway", "trunk", "primary"];
const MEDIUM = ["secondary", "tertiary"];

export interface Quarter {
    name: string;
    kind: "quarter" | "village";
    shapes: Polygon[];
    /** Where its name stands, on the ground. */
    label: THREE.Vector3;
    /**
     * Its land, hidden but for dimming it when another quarter is chosen;
     * it can also be colored by a value, such as a statistic of the
     * quarter.
     */
    fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    border: LineSegments2;
    box: THREE.Box2;
}

/** The kinds of places with icons; the landmarks shine brightest. */
export const GROUPS = {
    landmark: PALETTE.landmark,
    health: PALETTE.icon,
    public: PALETTE.icon,
    education: PALETTE.icon,
    food: PALETTE.icon,
} as const;
export type Group = keyof typeof GROUPS;

/** A place shown with an icon: a landmark or a point of interest. */
export interface Place {
    name: string;
    group: Group;
    at: THREE.Vector3;
}

export interface MapScene {
    group: THREE.Group;
    quarters: Quarter[];
    /** The places with icons, most important first. */
    places: Place[];
    icons: Icons;
    bounds: THREE.Box3;
    ground: Ground;
}

/**
 * Segments along a line of points, for LineSegmentsGeometry, lying on the
 * ground: cut into pieces no longer than a quarter of the grid of the
 * terrain, so they follow its flat triangles over the hills.
 */
function segments(
    terrain: Terrain,
    flat: number[],
    closed = false,
    out: number[] = [],
) {
    const points = pairs(flat);
    const count = closed ? points.length : points.length - 1;
    const most = terrain.step / 4;
    const lift = LIFT.lines;
    for (let k = 0; k < count; k++) {
        const [ax, ay] = points[k]!;
        const [bx, by] = points[(k + 1) % points.length]!;
        const pieces = Math.max(
            1,
            Math.ceil(Math.hypot(bx - ax, by - ay) / most),
        );
        let x = ax;
        let y = ay;
        let h = terrain.heightAt(x, y) + lift;
        for (let i = 1; i <= pieces; i++) {
            const nx = ax + ((bx - ax) * i) / pieces;
            const ny = ay + ((by - ay) * i) / pieces;
            const nh = terrain.heightAt(nx, ny) + lift;
            out.push(x, h, -y, nx, nh, -ny);
            x = nx;
            y = ny;
            h = nh;
        }
    }
    return out;
}

/** Keeps a material to the inside of the municipality's land. */
function insideLand(material: THREE.Material) {
    material.stencilWrite = true;
    material.stencilRef = 1;
    material.stencilFunc = THREE.EqualStencilFunc;
    material.stencilFail = THREE.KeepStencilOp;
    material.stencilZFail = THREE.KeepStencilOp;
    material.stencilZPass = THREE.KeepStencilOp;
    return material;
}

/**
 * Lines as wide in pixels as asked, whatever the zoom; only a glow adds up
 * its light where lines cross, the rest stay as bright as they are.
 */
function neon(
    positions: number[],
    color: string,
    width: number,
    opacity: number,
    order: number,
    dpr: number,
    glow = false,
) {
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    const material = new LineMaterial({
        color,
        linewidth: width * dpr,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const lines = new LineSegments2(geometry, material);
    lines.userData.width = width * dpr;
    lines.renderOrder = order;
    return lines;
}

function shapes(polygons: Polygon[]) {
    return polygons.map((polygon) => {
        const shape = new THREE.Shape(
            pairs(polygon.outer).map(([x, y]) => new THREE.Vector2(x, y)),
        );
        for (const hole of polygon.holes) {
            shape.holes.push(
                new THREE.Path(
                    pairs(hole).map(([x, y]) => new THREE.Vector2(x, y)),
                ),
            );
        }
        return shape;
    });
}

/** Flat filled areas, to draw into the texture of the ground. */
function fill(
    polygons: Polygon[],
    color: string,
    opacity: number,
    order: number,
) {
    const geometry = new THREE.ShapeGeometry(shapes(polygons), 1);
    // the shapes are drawn in the map's x and y; lay them down
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
            color,
            transparent: opacity < 1,
            opacity,
            depthTest: false,
            depthWrite: false,
        }),
    );
    mesh.renderOrder = order;
    return mesh;
}

const rings = (list: number[][]) => list.map((outer) => ({ outer, holes: [] }));

// meters left between the icons set apart
const ICON_GAP = 3;

/**
 * Where the icons of places stand, in the map's x and y: where they are,
 * but places so near each other that their models would touch, turning
 * at their real size (several in one building), are set apart, evenly
 * round a ring about their middle, in the order they lie round it.
 */
function spread(places: { at: [number, number]; icon: string }[]) {
    const reaches = places.map(({ icon }) => reach(MODELS[icon] ?? FALLBACK));
    // gather the places that touch, and those touching them, into groups
    const group = places.map((_, k) => k);
    const root = (k: number): number =>
        group[k] === k ? k : (group[k] = root(group[k]!));
    places.forEach((a, i) => {
        for (let j = i + 1; j < places.length; j++) {
            const b = places[j]!;
            const apart = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
            if (apart < reaches[i]! + reaches[j]! + ICON_GAP) {
                group[root(j)] = root(i);
            }
        }
    });
    const members = new Map<number, number[]>();
    places.forEach((_, k) => {
        const r = root(k);
        members.set(r, [...(members.get(r) ?? []), k]);
    });
    const result = places.map(({ at }): [number, number] => [at[0], at[1]]);
    for (const list of members.values()) {
        if (list.length < 2) {
            continue;
        }
        const n = list.length;
        const mx = list.reduce((sum, k) => sum + places[k]!.at[0], 0) / n;
        const my = list.reduce((sum, k) => sum + places[k]!.at[1], 0) / n;
        // neighbors on the ring as far apart as the widest two need
        const widest = Math.max(...list.map((k) => reaches[k]!));
        const radius = (widest + ICON_GAP / 2) / Math.sin(Math.PI / n);
        const angle = (k: number) =>
            Math.atan2(places[k]!.at[1] - my, places[k]!.at[0] - mx);
        const round = [...list].sort((a, b) => angle(a) - angle(b));
        const start = angle(round[0]!);
        round.forEach((k, i) => {
            const a = start + (i / n) * Math.PI * 2;
            result[k] = [mx + radius * Math.cos(a), my + radius * Math.sin(a)];
        });
    }
    return result;
}

/**
 * The map as cyan vector lines over the low poly hills of a dark ground:
 * the wireframe of the ground, the land of the municipality with its woods, vineyards and waters, the
 * streams, roads, railway, the borders of the quarters and the bright
 * outline, and the icons of the landmarks and other places. size is the
 * width in pixels of the texture the areas are drawn into.
 */
export function buildMap(
    map: MapData,
    terrain: Terrain,
    dpr: number,
    size: number,
): MapScene {
    const group = new THREE.Group();
    const ground = new Ground(
        terrain,
        PALETTE.sky,
        PALETTE.shade,
        { ground: ORDER.ground, veil: ORDER.veil },
        size,
    );
    group.add(ground.group);
    const outline = { outer: map.outline, holes: [] };
    const line = (flat: number[], closed = false, out: number[] = []) =>
        segments(terrain, flat, closed, out);

    const bounds = new THREE.Box3();
    for (const [x, y] of pairs(map.outline)) {
        bounds.expandByPoint(terrain.ground(x, y));
    }

    // the low poly ground as a faint wireframe of its triangles, and a light
    // from the north west, high up, to shade its faces
    const wireframe = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
                terrain.wireframe(LIFT.wireframe),
                3,
            ),
        ),
        new THREE.LineBasicMaterial({
            color: PALETTE.wireframe,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        }),
    );
    wireframe.renderOrder = ORDER.wireframe;
    group.add(wireframe);
    const light = new THREE.DirectionalLight(0xffffff, 1.6);
    light.position.set(-0.6, 1, -0.5);
    group.add(light);

    // the land, marking the stencil, which keeps what is drawn on it inside
    const land = fill([outline], PALETTE.land, 1, ORDER.land);
    Object.assign(land.material, {
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
    });
    ground.areas.add(land);
    for (const [list, color, opacity] of [
        [map.woods, PALETTE.woods, 0.7],
        [map.vineyards, PALETTE.vineyards, 0.6],
        [map.parks, PALETTE.parks, 0.6],
    ] as const) {
        const cover = fill(rings(list), color, opacity, ORDER.cover);
        insideLand(cover.material);
        ground.areas.add(cover);
    }
    const water = fill(map.water, PALETTE.water, 1, ORDER.water);
    insideLand(water.material);
    ground.areas.add(water);

    // the lines on the land
    const shore: number[] = [];
    for (const { outer, holes } of map.water) {
        line(outer, true, shore);
        for (const hole of holes) {
            line(hole, true, shore);
        }
    }
    const shoreLines = neon(shore, PALETTE.shore, 1.5, 0.9, ORDER.lines, dpr);
    insideLand(shoreLines.material);
    group.add(shoreLines);
    const streams: number[] = [];
    for (const stream of map.streams) {
        line(stream, false, streams);
    }
    group.add(neon(streams, PALETTE.stream, 1, 0.6, ORDER.lines, dpr));

    const kinds = map.roads.kinds;
    const roads = {
        major: [] as number[],
        medium: [] as number[],
        minor: [] as number[],
    };
    for (const edge of map.roads.edges) {
        const kind = kinds[edge[2] as number]!;
        const layer = MAJOR.includes(kind)
            ? roads.major
            : MEDIUM.includes(kind)
              ? roads.medium
              : roads.minor;
        line(edge[3] as number[], false, layer);
    }
    group.add(neon(roads.minor, PALETTE.road, 1, 0.28, ORDER.lines, dpr));
    group.add(neon(roads.medium, PALETTE.road, 1.3, 0.55, ORDER.lines, dpr));
    group.add(neon(roads.major, PALETTE.major, 1.8, 0.8, ORDER.lines, dpr));
    const rails: number[] = [];
    for (const edge of map.rails.edges) {
        line(edge[2] as number[], false, rails);
    }
    group.add(neon(rails, PALETTE.rail, 1.8, 0.85, ORDER.lines, dpr));

    // the quarters, their borders faint until pointed at
    const quarters = map.quarters.map((quarter) => {
        const fillMesh = fill(quarter.shapes, PALETTE.border, 0, ORDER.quarter);
        fillMesh.visible = false;
        const lines: number[] = [];
        const box = new THREE.Box2();
        for (const { outer, holes } of quarter.shapes) {
            line(outer, true, lines);
            for (const hole of holes) {
                line(hole, true, lines);
            }
            for (const [x, y] of pairs(outer)) {
                box.expandByPoint(new THREE.Vector2(x, y));
            }
        }
        const border = neon(lines, PALETTE.border, 1, 0.2, ORDER.lines, dpr);
        ground.veils.add(fillMesh);
        group.add(border);
        return {
            name: quarter.name,
            kind: quarter.kind,
            shapes: quarter.shapes,
            label: terrain.ground(...quarter.label, LIFT.icons),
            fill: fillMesh,
            border,
            box,
        };
    });

    // the outline, bright, over a wide soft glow
    const edge = line(map.outline, true);
    group.add(neon(edge, PALETTE.outline, 4, 0.05, ORDER.outline, dpr, true));
    group.add(neon(edge, PALETTE.outline, 1.3, 0.65, ORDER.outline, dpr));

    // the icons of the landmarks first, brighter, then of the other places,
    // set apart where they would touch
    const all = [...map.landmarks, ...(map.pois ?? [])];
    const spots = spread(all);
    const places: Place[] = [
        ...map.landmarks.map(({ name }) => ({
            name,
            group: "landmark" as Group,
        })),
        ...(map.pois ?? []).map(({ name, group }) => ({ name, group })),
    ].map((place, k) => ({
        ...place,
        at: terrain.ground(...spots[k]!, LIFT.icons),
    }));
    const icons = new Icons(
        all.map((place, k) => ({
            icon: place.icon,
            at: places[k]!.at,
            bright: places[k]!.group === "landmark",
            ban: (place as { ban?: string }).ban,
        })),
        { bright: PALETTE.landmark, dim: PALETTE.icon },
        ORDER.icons,
    );
    group.add(icons.group);

    return { group, quarters, places, icons, bounds, ground };
}

export { ORDER };
export const TRAFFIC_ORDER = ORDER.traffic;
