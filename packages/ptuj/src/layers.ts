import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Icons } from "./icons";
import { ground, type MapData, pairs, type Polygon } from "./map";

/** The neon colors of the map on its dark ground. */
export const PALETTE = {
    sky: "#02050b",
    grid: "#0b3442",
    land: "#061520",
    woods: "#0a3a2a",
    vineyards: "#2a1640",
    parks: "#0c3a30",
    water: "#062a56",
    shore: "#2f9bff",
    stream: "#1e7bff",
    road: "#ffb000",
    major: "#ffcf40",
    rail: "#ff3df0",
    outline: "#00e5ff",
    border: "#00e5ff",
    car: "#fff2b0",
    train: "#ff5cf4",
};

// layers drawn bottom up; the map is flat, so the order decides, not depth
const ORDER = {
    grid: 0,
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
const GRID = 1000; // meters between the lines of the grid

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

/** The kinds of places with icons, each in its color. */
export const GROUPS = {
    landmark: "#7df9ff",
    health: "#ff6b8a",
    public: "#b48cff",
    education: "#9dff7a",
    food: "#ffcf40",
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
}

/** Segments along a line of points, for LineSegmentsGeometry. */
function segments(flat: number[], closed = false, out: number[] = []) {
    const points = pairs(flat);
    const count = closed ? points.length : points.length - 1;
    for (let k = 0; k < count; k++) {
        const [ax, ay] = points[k]!;
        const [bx, by] = points[(k + 1) % points.length]!;
        out.push(ax, 0, -ay, bx, 0, -by);
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
        depthTest: false,
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

/** Flat filled areas, lying on the ground. */
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

/**
 * The map as neon lines on a dark ground: a faint grid, the land of the
 * municipality with its woods, vineyards and waters, the streams, roads,
 * railway, the borders of the quarters and the bright outline, and the
 * icons of the landmarks and other places.
 */
export function buildMap(map: MapData, dpr: number): MapScene {
    const group = new THREE.Group();
    const outline = { outer: map.outline, holes: [] };

    const bounds = new THREE.Box3();
    for (const [x, y] of pairs(map.outline)) {
        bounds.expandByPoint(ground(x, y));
    }

    // a faint grid round the municipality, a kilometer apart
    const grid: number[] = [];
    const x0 = Math.floor(bounds.min.x / GRID - 3) * GRID;
    const x1 = Math.ceil(bounds.max.x / GRID + 3) * GRID;
    const z0 = Math.floor(bounds.min.z / GRID - 3) * GRID;
    const z1 = Math.ceil(bounds.max.z / GRID + 3) * GRID;
    for (let x = x0; x <= x1; x += GRID) {
        grid.push(x, 0, z0, x, 0, z1);
    }
    for (let z = z0; z <= z1; z += GRID) {
        grid.push(x0, 0, z, x1, 0, z);
    }
    group.add(neon(grid, PALETTE.grid, 1, 0.8, ORDER.grid, dpr));

    // the land, marking the stencil, which keeps what is drawn on it inside
    const land = fill([outline], PALETTE.land, 1, ORDER.land);
    Object.assign(land.material, {
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
    });
    group.add(land);
    for (const [list, color, opacity] of [
        [map.woods, PALETTE.woods, 0.7],
        [map.vineyards, PALETTE.vineyards, 0.6],
        [map.parks, PALETTE.parks, 0.6],
    ] as const) {
        const cover = fill(rings(list), color, opacity, ORDER.cover);
        insideLand(cover.material);
        group.add(cover);
    }
    const water = fill(map.water, PALETTE.water, 1, ORDER.water);
    insideLand(water.material);
    group.add(water);

    // the lines on the land
    const shore: number[] = [];
    for (const { outer, holes } of map.water) {
        segments(outer, true, shore);
        for (const hole of holes) {
            segments(hole, true, shore);
        }
    }
    const shoreLines = neon(shore, PALETTE.shore, 1.5, 0.9, ORDER.lines, dpr);
    insideLand(shoreLines.material);
    group.add(shoreLines);
    const streams: number[] = [];
    for (const stream of map.streams) {
        segments(stream, false, streams);
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
        segments(edge[3] as number[], false, layer);
    }
    group.add(neon(roads.minor, PALETTE.road, 1, 0.28, ORDER.lines, dpr));
    group.add(neon(roads.medium, PALETTE.road, 1.3, 0.55, ORDER.lines, dpr));
    group.add(neon(roads.major, PALETTE.major, 1.8, 0.8, ORDER.lines, dpr));
    const rails: number[] = [];
    for (const edge of map.rails.edges) {
        segments(edge[2] as number[], false, rails);
    }
    group.add(neon(rails, PALETTE.rail, 1.8, 0.85, ORDER.lines, dpr));

    // the quarters, their borders faint until pointed at
    const quarters = map.quarters.map((quarter) => {
        const fillMesh = fill(quarter.shapes, PALETTE.border, 0, ORDER.quarter);
        fillMesh.visible = false;
        const lines: number[] = [];
        const box = new THREE.Box2();
        for (const { outer, holes } of quarter.shapes) {
            segments(outer, true, lines);
            for (const hole of holes) {
                segments(hole, true, lines);
            }
            for (const [x, y] of pairs(outer)) {
                box.expandByPoint(new THREE.Vector2(x, y));
            }
        }
        const border = neon(lines, PALETTE.border, 1, 0.2, ORDER.lines, dpr);
        group.add(fillMesh, border);
        return {
            name: quarter.name,
            kind: quarter.kind,
            shapes: quarter.shapes,
            label: ground(...quarter.label),
            fill: fillMesh,
            border,
            box,
        };
    });

    // the outline, bright, over a wide soft glow
    const edge = segments(map.outline, true);
    group.add(neon(edge, PALETTE.outline, 4, 0.05, ORDER.outline, dpr, true));
    group.add(neon(edge, PALETTE.outline, 1.3, 0.65, ORDER.outline, dpr));

    // the icons of the landmarks first, then of the other places
    const places: Place[] = [
        ...map.landmarks.map(({ name, at }) => ({
            name,
            group: "landmark" as Group,
            at: ground(...at),
        })),
        ...(map.pois ?? []).map(({ name, group, at }) => ({
            name,
            group,
            at: ground(...at),
        })),
    ];
    const icons = new Icons(
        [...map.landmarks, ...(map.pois ?? [])].map(({ icon }, k) => ({
            icon,
            at: places[k]!.at,
            color: GROUPS[places[k]!.group],
        })),
        dpr,
        ORDER.icons,
    );
    group.add(icons.points);

    return { group, quarters, places, icons, bounds };
}

export { ORDER };
export const TRAFFIC_ORDER = ORDER.traffic;
