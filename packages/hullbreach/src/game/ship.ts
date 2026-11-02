import * as THREE from "three";
import type { Light, LightPool } from "../lights";
import { jointRotation, joints, nodeName, place, toThree } from "../space";
import * as Gfx from "./gfx";
import { Lang } from "./lang";
import * as Res from "./res";

export interface Prop {
    name: string;
    x: number;
    y: number;
    angle: number;
    blocked: number[] | null;
}

const TILE = 256;
/** Cells per side of the meshes the hull is cut into. */
const CHUNK = 4;
/** Base, panel, top, floor, ceiling. */
const KINDS = 5;
/** The tile of the bow window. */
const WINDOW = 4 * 5;

const NEIGHBORS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
] as const;

interface Group {
    tile: number;
    cx: number;
    cy: number;
    points: number[];
    uvs: number[];
    idx: number[];
}

const turn = new THREE.Quaternion();

/** How near a prop may come to a cell's center before paths avoid the cell. */
const PATH_CLEARANCE = 0.3;

/** The space a prop fills: a box standing on the floor, in game coordinates. */
interface Blocker {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    top: number;
}

/**
 * The spaceship of res/shooter-map.txt (written by
 * blender-scripts/exportmap.py): walls, floors and ceilings built from the
 * textures of res/shooter-tiles.png, the props (models) and the lights.
 * Cell (x, y) is the 1x1 m square from world (x, y) to (x + 1, y + 1), Z up,
 * in the game's coordinates (see space.ts).
 *
 * It also answers where things can go: walkable cells, free circles, rays
 * stopped by walls and props, and paths.
 */
export class Ship {
    width = 0;
    height = 0;
    readonly props: Prop[] = [];
    playerStart = { x: 0, y: 0, angle: 0 };
    readonly alienStarts: { x: number; y: number }[] = [];
    readonly root = new THREE.Group();

    private readonly rows: string[] = [];
    /** Per cell, 0 where no prop stands (for paths, see free). */
    private propHeight: number[] = [];
    /** The boxes of the props that can't be walked through (for collisions and rays). */
    private readonly blockers: Blocker[] = [];
    /** The room of each cell (see area). */
    private areas: number[] = [];
    private readonly spinners: { obj: THREE.Object3D; speed: number }[] = [];
    private readonly pumps: {
        obj: THREE.Object3D;
        z: number;
        phase: number;
    }[] = [];
    private time = 0;

    constructor(scene: THREE.Scene, lights: LightPool) {
        this.parse(Res.text("map.txt"));
        this.labelAreas();
        scene.add(this.root);
        this.buildHull();
        this.placeProps();
        this.placeLights(lights);
    }

    private parse(text: string): void {
        for (const raw of text.split("\n")) {
            const line = raw.replace(/\r$/, "");
            if (line.length === 0) continue;
            if (!/[0-9]/.test(line)) {
                this.rows.push(line);
                continue;
            }
            const t = line.split(" ");
            const num = (i: number) => Number.parseFloat(t[i] ?? "0");
            switch (t[0]) {
                case "player":
                    this.playerStart = { x: num(1), y: num(2), angle: num(3) };
                    break;
                case "alien":
                    this.alienStarts.push({ x: num(2), y: num(3) });
                    break;
                default: {
                    const cells = t[4];
                    this.props.push({
                        name: t[0] ?? "",
                        x: num(1),
                        y: num(2),
                        angle: num(3),
                        blocked:
                            cells === undefined || cells === "-"
                                ? null
                                : cells
                                      .split(",")
                                      .map((v) => Number.parseInt(v, 10)),
                    });
                }
            }
        }
        this.height = this.rows.length;
        this.width = this.rows[0]?.length ?? 0;
        this.propHeight = new Array<number>(this.width * this.height).fill(0);
    }

    // --- the map --------------------------------------------------------

    charAt(x: number, y: number): string {
        return x < 0 || y < 0 || x >= this.width || y >= this.height
            ? " "
            : (this.rows[y]![x] ?? " ");
    }

    isFloor(x: number, y: number): boolean {
        return "ehrcd".includes(this.charAt(x, y));
    }

    ceiling(x: number, y: number): number {
        switch (this.charAt(x, y)) {
            case "e":
                return 7.0;
            case "c":
                return 4.5;
            case "d":
                return 2.4;
            case "h":
            case "r":
                return 3.0;
            default:
                return 0.0;
        }
    }

    /** Engine room, hallway, cabins, control room: the row of the textures. */
    private section(x: number, y: number): number {
        switch (this.charAt(x, y)) {
            case "e":
                return 0;
            case "r":
                return 2;
            case "c":
                return 3;
            default:
                return 1;
        }
    }

    sectionName(x: number, y: number): string {
        const names = [
            "ENGINE ROOM",
            "PERSONNEL DECK",
            "CREW CABIN",
            "CONTROL ROOM",
        ];
        return Lang.t(names[this.section(Math.floor(x), Math.floor(y))]!);
    }

    /** A cell that figures can stand in: a floor without a prop on it. */
    free(x: number, y: number): boolean {
        return this.isFloor(x, y) && this.propHeight[y * this.width + x] === 0;
    }

    /** True when a circle of radius r around (x, y) touches no wall and no prop. */
    circleFree(x: number, y: number, r: number): boolean {
        for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++)
            for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
                if (this.isFloor(cx, cy)) continue;
                if (boxDistSq(x, y, cx, cy, cx + 1, cy + 1) < r * r)
                    return false;
            }
        for (const b of this.blockers)
            if (boxDistSq(x, y, b.x0, b.y0, b.x1, b.y1) < r * r) return false;
        return true;
    }

    /**
     * Distance along the ray from (ox, oy, oz) in the normalized direction
     * (dx, dy, dz) to the first wall, floor, ceiling or prop, or maxDist.
     */
    raycast(
        ox: number,
        oy: number,
        oz: number,
        dx: number,
        dy: number,
        dz: number,
        maxDist: number,
    ): number {
        let dist = this.hullRaycast(ox, oy, oz, dx, dy, dz, maxDist);
        for (const b of this.blockers) {
            const t = rayBox(ox, oy, oz, dx, dy, dz, b);
            if (t < dist) dist = t;
        }
        return dist;
    }

    /** Like raycast, but only walls, floors and ceilings stop the ray. */
    private hullRaycast(
        ox: number,
        oy: number,
        oz: number,
        dx: number,
        dy: number,
        dz: number,
        maxDist: number,
    ): number {
        let cx = Math.floor(ox);
        let cy = Math.floor(oy);
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        const big = 1e9;
        const deltaX = dx === 0 ? big : 1 / Math.abs(dx);
        const deltaY = dy === 0 ? big : 1 / Math.abs(dy);
        let nextX = dx === 0 ? big : (dx > 0 ? cx + 1 - ox : ox - cx) * deltaX;
        let nextY = dy === 0 ? big : (dy > 0 ? cy + 1 - oy : oy - cy) * deltaY;
        let t = 0;
        while (true) {
            if (!this.isFloor(cx, cy)) return t;
            const exit = Math.min(Math.min(nextX, nextY), maxDist);
            const top = this.ceiling(cx, cy);
            const z = oz + dz * t;
            if (z > top || z < 0) return t; // a lintel or a step in the ceiling
            if (dz < 0 && oz + dz * exit < 0) return -oz / dz;
            if (dz > 0 && oz + dz * exit > top) return (top - oz) / dz;
            if (exit >= maxDist) return maxDist;
            if (nextX < nextY) {
                cx += stepX;
                t = nextX;
                nextX += deltaX;
            } else {
                cy += stepY;
                t = nextY;
                nextY += deltaY;
            }
        }
    }

    /** Whether the diagonal step n from (x, y) cuts no corner. */
    private passes(
        x: number,
        y: number,
        n: readonly [number, number],
    ): boolean {
        return (
            n[0] === 0 ||
            n[1] === 0 ||
            (this.free(x + n[0], y) && this.free(x, y + n[1]))
        );
    }

    /**
     * Steps (diagonals count as one, but not across corners) from the cell
     * (x, y) to every free cell, -1 where it can't be reached or is further
     * than limit steps.
     */
    distances(x: number, y: number, limit = 1000): number[] {
        const w = this.width;
        const dist = new Array<number>(w * this.height).fill(-1);
        if (!this.free(x, y)) return dist;
        const queue = [y * w + x];
        dist[queue[0]!] = 0;
        let head = 0;
        while (head < queue.length) {
            const cell = queue[head++]!;
            const cx = cell % w;
            const cy = Math.trunc(cell / w);
            if (dist[cell]! >= limit) continue;
            for (const n of NEIGHBORS) {
                const nx = cx + n[0];
                const ny = cy + n[1];
                if (!this.free(nx, ny) || dist[ny * w + nx]! >= 0) continue;
                if (!this.passes(cx, cy, n)) continue;
                dist[ny * w + nx] = dist[cell]! + 1;
                queue.push(ny * w + nx);
            }
        }
        return dist;
    }

    /** The free cell whose center is nearest to (x, y). */
    nearestFree(x: number, y: number): number {
        let best = -1;
        let bestDist = 1e9;
        for (let cy = 0; cy < this.height; cy++)
            for (let cx = 0; cx < this.width; cx++) {
                const d =
                    (cx + 0.5 - x) * (cx + 0.5 - x) +
                    (cy + 0.5 - y) * (cy + 0.5 - y);
                if (d < bestDist && this.free(cx, cy)) {
                    best = cy * this.width + cx;
                    bestDist = d;
                }
            }
        return best;
    }

    /** The neighbor cell of (x, y) that is nearer by the distances, or -1. */
    downhill(dist: number[], x: number, y: number): number {
        let best = -1;
        let bestDist = dist[y * this.width + x] ?? -1;
        if (bestDist < 0) bestDist = 1 << 30;
        for (const n of NEIGHBORS) {
            const nx = x + n[0];
            const ny = y + n[1];
            if (!this.free(nx, ny)) continue;
            if (!this.passes(x, y, n)) continue;
            const d = dist[ny * this.width + nx]!;
            if (d >= 0 && d < bestDist) {
                best = ny * this.width + nx;
                bestDist = d;
            }
        }
        return best;
    }

    // --- rooms and cover -----------------------------------------------

    /** The rooms: floor cells of the same section joined side by side share a number (-1 off the floor). */
    private labelAreas(): void {
        const w = this.width;
        this.areas = new Array<number>(w * this.height).fill(-1);
        let next = 0;
        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < w; x++) {
                if (!this.isFloor(x, y) || this.areas[y * w + x] !== -1)
                    continue;
                const section = this.section(x, y);
                const id = next++;
                const stack = [y * w + x];
                this.areas[y * w + x] = id;
                while (stack.length > 0) {
                    const cell = stack.pop()!;
                    const cx = cell % w;
                    const cy = Math.trunc(cell / w);
                    for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (
                            !this.isFloor(nx, ny) ||
                            this.section(nx, ny) !== section
                        )
                            continue;
                        if (this.areas[ny * w + nx] !== -1) continue;
                        this.areas[ny * w + nx] = id;
                        stack.push(ny * w + nx);
                    }
                }
            }
    }

    /** The room of the cell (x, y), or -1 off the floor. */
    area(x: number, y: number): number {
        return x < 0 || y < 0 || x >= this.width || y >= this.height
            ? -1
            : this.areas[y * this.width + x]!;
    }

    /** Whether a figure at (ax, ay) sees one at (bx, by): no wall nor tall prop between them, at chest height. */
    sees(ax: number, ay: number, bx: number, by: number): boolean {
        const dist = Math.hypot(bx - ax, by - ay);
        if (dist < 0.01) return true;
        return (
            this.raycast(
                ax,
                ay,
                1.2,
                (bx - ax) / dist,
                (by - ay) / dist,
                0,
                dist,
            ) >=
            dist - 0.05
        );
    }

    /**
     * A cell to lie in wait in for someone at (fromX, fromY): one the
     * commando at (px, py) can't see, close to his way (3 to 14 steps from
     * him) and at most reach steps for the one hiding; none of the taken
     * cells nor their neighbors. -1 when there is none.
     */
    cover(
        fromX: number,
        fromY: number,
        px: number,
        py: number,
        taken: Set<number>,
        reach = 25,
    ): number {
        const toPlayer = this.distances(Math.floor(px), Math.floor(py), 14);
        const fromMe = this.distances(
            Math.floor(fromX),
            Math.floor(fromY),
            reach,
        );
        let best = -1;
        let bestScore = Number.MAX_VALUE;
        for (let i = 0; i < fromMe.length; i++) {
            const mine = fromMe[i]!;
            const theirs = toPlayer[i]!;
            if (mine < 0 || theirs < 3 || taken.has(i)) continue;
            const x = i % this.width;
            const y = Math.trunc(i / this.width);
            if (this.sees(px, py, x + 0.5, y + 0.5)) continue;
            const score = theirs + 0.5 * mine;
            if (score < bestScore) {
                best = i;
                bestScore = score;
            }
        }
        if (best >= 0)
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++)
                    taken.add(best + dy * this.width + dx);
        return best;
    }

    // --- building -------------------------------------------------------

    /** Walls, floors and ceilings, grouped by texture into chunks of cells. */
    private buildHull(): void {
        const all = Gfx.pixels(Res.image("tiles"));
        const lastRow = Math.trunc(all.height / TILE / 2);
        const groups = new Map<number, Group>();

        const quad = (
            tile: number,
            cellX: number,
            cellY: number,
            corners: number[][],
            uvs: number[][],
        ) => {
            const chunkX = Math.trunc(cellX / CHUNK);
            const chunkY = Math.trunc(cellY / CHUNK);
            const key = (tile * 100 + chunkY) * 100 + chunkX;
            let g = groups.get(key);
            if (!g) {
                g = {
                    tile,
                    cx: (chunkX + 0.5) * CHUNK,
                    cy: (chunkY + 0.5) * CHUNK,
                    points: [],
                    uvs: [],
                    idx: [],
                };
                groups.set(key, g);
            }
            const base = g.points.length / 3;
            for (let i = 0; i < 4; i++) {
                const [x = 0, y = 0, z = 0] = corners[i]!;
                // in three.js, around the chunk's center (see space.ts)
                g.points.push(x - g.cx, -(y - g.cy), z);
                g.uvs.push(uvs[i]![0]!, uvs[i]![1]!);
            }
            // y is mirrored, so the corners turn the other way
            for (const i of [0, 2, 1, 0, 3, 2]) g.idx.push(base + i);
        };

        /** Wall face on the edge from (x0, y0) to (x1, y1), between heights lo and hi. */
        const wall = (
            x: number,
            y: number,
            x0: number,
            y0: number,
            x1: number,
            y1: number,
            lo: number,
            hi: number,
            top: number,
            window: boolean,
        ) => {
            const row = this.section(x, y);
            const topStart = top - 1;
            const baseEnd = Math.min(1, topStart);
            const u0 = x0 + y0;
            const u1 = x1 + y1;
            // base: the lowest meter, top: the meter under the ceiling, panels between
            const bands = [
                { from: 0, to: baseEnd, tile: row * KINDS, v: 1 },
                {
                    from: baseEnd,
                    to: topStart,
                    tile: window ? WINDOW : row * KINDS + 1,
                    v: 1,
                },
                { from: topStart, to: top, tile: row * KINDS + 2, v: top },
            ];
            for (const b of bands) {
                const from = Math.max(b.from, lo);
                const to = Math.min(b.to, hi);
                if (to - from < 0.001) continue;
                quad(
                    b.tile,
                    x,
                    y,
                    [
                        [x0, y0, from],
                        [x1, y1, from],
                        [x1, y1, to],
                        [x0, y0, to],
                    ],
                    [
                        [u0, b.v - from],
                        [u1, b.v - from],
                        [u1, b.v - to],
                        [u0, b.v - to],
                    ],
                );
            }
        };

        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++) {
                if (!this.isFloor(x, y)) continue;
                const row = this.section(x, y);
                const top = this.ceiling(x, y);
                quad(
                    row * KINDS + 3,
                    x,
                    y,
                    [
                        [x, y, 0],
                        [x + 1, y, 0],
                        [x + 1, y + 1, 0],
                        [x, y + 1, 0],
                    ],
                    [
                        [x, y],
                        [x + 1, y],
                        [x + 1, y + 1],
                        [x, y + 1],
                    ],
                );
                quad(
                    row * KINDS + 4,
                    x,
                    y,
                    [
                        [x, y, top],
                        [x, y + 1, top],
                        [x + 1, y + 1, top],
                        [x + 1, y, top],
                    ],
                    [
                        [x, y],
                        [x, y + 1],
                        [x + 1, y + 1],
                        [x + 1, y],
                    ],
                );
                // each edge towards a wall, or towards a lower ceiling
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ] as const) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const lo = this.isFloor(nx, ny) ? this.ceiling(nx, ny) : 0;
                    if (lo >= top) continue;
                    const window = this.charAt(nx, ny) === "W";
                    if (dx === 1)
                        wall(
                            x,
                            y,
                            x + 1,
                            y + 1,
                            x + 1,
                            y,
                            lo,
                            top,
                            top,
                            window,
                        );
                    else if (dx === -1)
                        wall(x, y, x, y, x, y + 1, lo, top, top, window);
                    else if (dy === 1)
                        wall(
                            x,
                            y,
                            x,
                            y + 1,
                            x + 1,
                            y + 1,
                            lo,
                            top,
                            top,
                            window,
                        );
                    else wall(x, y, x + 1, y, x, y, lo, top, top, window);
                }
            }

        const materials = new Map<
            number,
            {
                color: THREE.MeshLambertMaterial;
                glow: THREE.MeshBasicMaterial | null;
            }
        >();
        for (const g of groups.values()) {
            let mat = materials.get(g.tile);
            if (!mat) {
                const col = g.tile % KINDS;
                const row = Math.trunc(g.tile / KINDS);
                const glow = Gfx.sub(
                    all,
                    col * TILE,
                    (row + lastRow) * TILE,
                    TILE,
                    TILE,
                );
                const color = Gfx.sub(all, col * TILE, row * TILE, TILE, TILE);
                let glowMat: THREE.MeshBasicMaterial | null = null;
                if (Gfx.lit(glow)) {
                    glowMat = Gfx.glowMaterial(Gfx.texture(glow, true));
                    glowMat.depthFunc = THREE.LessEqualDepth;
                }
                mat = {
                    color: new THREE.MeshLambertMaterial({
                        map: Gfx.texture(color, true),
                        side: THREE.DoubleSide,
                    }),
                    glow: glowMat,
                };
                materials.set(g.tile, mat);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(g.points, 3),
            );
            geometry.setAttribute(
                "uv",
                new THREE.Float32BufferAttribute(g.uvs, 2),
            );
            geometry.setIndex(g.idx);
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, mat.color);
            toThree(g.cx, g.cy, 0, mesh.position);
            this.root.add(mesh);
            if (mat.glow) {
                const glow = new THREE.Mesh(geometry, mat.glow);
                glow.position.copy(mesh.position);
                this.root.add(glow);
            }
        }
    }

    private placeProps(): void {
        for (const p of this.props) {
            const obj = Gfx.model(p.name);
            place(obj, p.x, p.y, 0, (p.angle * Math.PI) / 180);
            if (p.blocked) this.block(Gfx.bounds(obj));
            this.root.add(obj);
            for (const o of joints(obj)) {
                const name = nodeName(o);
                if (name.startsWith("Spin"))
                    this.spinners.push({
                        obj: o,
                        speed:
                            (name.charAt(4) === "-" ? -1 : 1) *
                            (0.8 + 0.4 * Math.random()),
                    });
                if (name.startsWith("Pump"))
                    this.pumps.push({
                        obj: o,
                        z: o.position.z,
                        phase: Number.parseInt(name.substring(5), 10) * Math.PI,
                    });
            }
        }
    }

    /**
     * Makes the box of a placed prop (three.js coordinates) solid: exactly
     * for collisions and rays, and for paths every cell whose center it
     * comes near. The map's blocked cells only say that the prop is solid,
     * the model itself says how much room it takes.
     */
    private block(box: THREE.Box3): void {
        const b: Blocker = {
            x0: box.min.x,
            y0: -box.max.y,
            x1: box.max.x,
            y1: -box.min.y,
            top: Math.max(box.max.z, 0.1),
        };
        this.blockers.push(b);
        const m = PATH_CLEARANCE;
        for (let y = Math.floor(b.y0 - m); y <= Math.floor(b.y1 + m); y++)
            for (let x = Math.floor(b.x0 - m); x <= Math.floor(b.x1 + m); x++) {
                if (x < 0 || y < 0 || x >= this.width || y >= this.height)
                    continue;
                if (
                    boxDistSq(x + 0.5, y + 0.5, b.x0, b.y0, b.x1, b.y1) >=
                    m * m
                )
                    continue;
                const i = y * this.width + x;
                this.propHeight[i] = Math.max(this.propHeight[i]!, b.top);
            }
    }

    /** Lamps under the ceilings and the glow of the big machines. */
    private placeLights(pool: LightPool): void {
        const light = (
            x: number,
            y: number,
            z: number,
            color: number,
            power = 1.0,
        ): Light =>
            pool.add({
                x,
                y,
                z,
                color: new THREE.Color(color).multiplyScalar(power),
                constant: 0.5,
                linear: 0.15,
                quadratic: 0.22,
            });
        // engine room: amber work lights high up, the reactor's cyan core
        for (const x of [5.5, 11.5, 17.5])
            for (const y of [4.5, 10.5, 16.5])
                if (!(x === 11.5 && y === 10.5))
                    light(x, y, 5.5, 0xffa040, 1.6);
        light(13, 10.5, 2.8, 0x40e8ff, 3.0);
        light(3, 16, 2.5, 0xff3030, 1.4); // the pods' warning lights
        // hallway: cool white lamps, every other one with a magenta tint
        let i = 0;
        for (let x = 26; x < 63; x += 4)
            light(x, 10.5, 2.6, i++ % 2 === 0 ? 0xc8dcff : 0xff60e0, 1.1);
        // cabins: a dim violet lamp each
        for (let k = 0; k < 10; k++) {
            light(25.5 + 4 * k, 5.5, 2.6, 0xb070ff, 0.8);
            light(25.5 + 4 * k, 15.5, 2.6, 0xb070ff, 0.8);
        }
        // control room: cyan over the consoles, white at the helm, starlight
        for (const x of [67.0, 74.0])
            for (const y of [5.5, 15.5]) light(x, y, 4.0, 0x40d8ff, 1.3);
        light(71, 10.5, 2.5, 0x60f0ff, 1.2); // the star map
        light(79, 10.5, 3.8, 0xe0ecff, 1.2);
    }

    update(dt: number): void {
        this.time += dt;
        for (const s of this.spinners)
            s.obj.quaternion.multiply(jointRotation(0, 0, s.speed * dt, turn));
        for (const p of this.pumps)
            p.obj.position.z = p.z + 0.22 * Math.sin(this.time * 3 + p.phase);
    }

    /** The menu's camera, slowly circling the star map of the control room. */
    flyby(camera: THREE.PerspectiveCamera, t: number): void {
        const a = t * 0.08 + 2.2;
        toThree(
            71 + 5.2 * Math.cos(a),
            10.5 + 5.2 * Math.sin(a),
            2.4 + 0.3 * Math.sin(t * 0.3),
            camera.position,
        );
        camera.up.set(0, 0, 1);
        camera.lookAt(
            toThree(
                71 + 1.5 * Math.cos(a + 1.2),
                10.5 + 1.5 * Math.sin(a + 1.2),
                1.6,
            ),
        );
    }
}

/** The squared distance from (x, y) to the rectangle (x0, y0)-(x1, y1). */
function boxDistSq(
    x: number,
    y: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): number {
    const dx = x - THREE.MathUtils.clamp(x, x0, x1);
    const dy = y - THREE.MathUtils.clamp(y, y0, y1);
    return dx * dx + dy * dy;
}

/**
 * Distance along the ray from (ox, oy, oz) in the direction (dx, dy, dz) to
 * the box of a prop, 0 from inside it, Infinity when it misses.
 */
function rayBox(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    b: Blocker,
): number {
    let near = 0;
    let far = Infinity;
    const slab = (
        from: number,
        dir: number,
        lo: number,
        hi: number,
    ): boolean => {
        if (dir === 0) return from >= lo && from <= hi;
        let t0 = (lo - from) / dir;
        let t1 = (hi - from) / dir;
        if (t0 > t1) [t0, t1] = [t1, t0];
        if (t0 > near) near = t0;
        if (t1 < far) far = t1;
        return near <= far;
    };
    return slab(ox, dx, b.x0, b.x1) &&
        slab(oy, dy, b.y0, b.y1) &&
        slab(oz, dz, 0, b.top)
        ? near
        : Infinity;
}
