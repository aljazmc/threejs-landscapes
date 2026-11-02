import * as THREE from "three";
import { type LightPool, LUMENS } from "./lights";
import * as Res from "./res";
import { model, type Rig, rig } from "./rig";

/**
 * The vampire castle of res/gothic-map.txt (written by
 * blender-scripts/exportmap.py): its walls, floors and ceilings built from
 * the tiles of res/gothic-tiles.png, the props (models) and the lights.
 * Cell (x, y) is the 1x1 m square from (x, y) to (x + 1, y + 1) on the
 * floor; the game works in these map coordinates with z up, which are
 * three.js' (x, z, y).
 *
 * It also answers where things can go: walkable cells, free circles, rays
 * stopped by walls and props, and paths.
 */

const TILE = 256;
/** Base, panel, top, floor, ceiling. */
const KINDS = 5;
/** The tile of the gothic window. */
const WINDOW = 4 * KINDS;

/** Map coordinates (z up) to three.js'. */
export function world(
    x: number,
    y: number,
    z: number,
    out = new THREE.Vector3(),
): THREE.Vector3 {
    return out.set(x, z, y);
}

/** The turn around three.js' Y axis making a model (which faces +Z) face (dx, dy) on the map. */
export function facing(dx: number, dy: number): number {
    return Math.atan2(dx, dy);
}

/** How near a prop may come to a cell's center before paths avoid the cell. */
const PATH_CLEARANCE = 0.3;
/** Up to how high above the floor the parts of a prop stand in the way (not a tree's crown). */
const FOOT_HEIGHT = 2;

/** The space a prop fills: a box standing on the floor, in map coordinates. */
interface Blocker {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    top: number;
}

export interface Prop {
    name: string;
    x: number;
    y: number;
    angle: number;
    blocked: [number, number, number, number] | null;
}

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

type Moving =
    | { kind: "spin"; obj: THREE.Object3D; speed: number }
    | { kind: "pump"; obj: THREE.Object3D; y: number; phase: number }
    | {
          kind: "flame";
          obj: THREE.Object3D;
          scale: THREE.Vector3;
          phase: number;
      };

export class Castle {
    width = 0;
    height = 0;
    private readonly rows: string[] = [];
    readonly props: Prop[] = [];
    playerStart = { x: 0, y: 0, angle: 0 };
    readonly monsterStarts: { x: number; y: number }[] = [];
    /** Height of the prop standing on each cell, 0 where there is none (for paths, see free). */
    private propHeight: number[] = [];
    /** The boxes of the props that can't be walked through (for collisions and rays). */
    private readonly blockers: Blocker[] = [];
    /** The room of each cell (see area). */
    private areas: number[] = [];

    readonly root = new THREE.Group();
    private readonly moving: Moving[] = [];

    constructor(scene: THREE.Scene, lights: LightPool, anisotropy: number) {
        this.parse(Res.mapText());
        this.labelAreas();
        scene.add(this.root);
        this.buildHull(anisotropy);
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
            const f = (i: number) => Number.parseFloat(t[i] ?? "0") || 0;
            switch (t[0]) {
                case "player":
                    this.playerStart = { x: f(1), y: f(2), angle: f(3) };
                    break;
                case "monster":
                    this.monsterStarts.push({ x: f(2), y: f(3) });
                    break;
                default: {
                    const cells = t[4];
                    let blocked: Prop["blocked"] = null;
                    if (cells !== undefined && cells !== "-") {
                        const [a = 0, b = 0, c = 0, d = 0] = cells
                            .split(",")
                            .map((v) => Number.parseInt(v, 10) || 0);
                        blocked = [a, b, c, d];
                    }
                    this.props.push({
                        name: t[0] ?? "",
                        x: f(1),
                        y: f(2),
                        angle: f(3),
                        blocked,
                    });
                }
            }
        }
        this.height = this.rows.length;
        this.width = this.rows[0]?.length ?? 0;
        this.propHeight = new Array<number>(this.width * this.height).fill(0);
    }

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
                return 7;
            case "c":
                return 4.5;
            case "d":
                return 2.4;
            case "h":
            case "r":
                return 3;
            default:
                return 0;
        }
    }

    /** Crypt, corridor, bedchambers, ballroom: the row of the textures. */
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
        return ["CRYPT", "CORRIDOR", "BEDCHAMBER", "BALLROOM"][
            this.section(Math.floor(x), Math.floor(y))
        ]!;
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
     * Distance along the ray from o in the normalized direction d (map
     * coordinates) to the first wall, floor, ceiling or prop, or maxDist.
     */
    raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): number {
        let dist = this.hullRaycast(o, d, maxDist);
        for (const b of this.blockers) {
            const t = rayBox(o, d, b);
            if (t < dist) dist = t;
        }
        return dist;
    }

    /** Like raycast, but only walls, floors and ceilings stop the ray. */
    private hullRaycast(
        o: THREE.Vector3,
        d: THREE.Vector3,
        maxDist: number,
    ): number {
        let cx = Math.floor(o.x);
        let cy = Math.floor(o.y);
        const stepX = d.x > 0 ? 1 : -1;
        const stepY = d.y > 0 ? 1 : -1;
        const BIG = 1e9;
        const deltaX = d.x === 0 ? BIG : 1 / Math.abs(d.x);
        const deltaY = d.y === 0 ? BIG : 1 / Math.abs(d.y);
        let nextX =
            d.x === 0 ? BIG : (d.x > 0 ? cx + 1 - o.x : o.x - cx) * deltaX;
        let nextY =
            d.y === 0 ? BIG : (d.y > 0 ? cy + 1 - o.y : o.y - cy) * deltaY;
        let t = 0;
        while (true) {
            if (!this.isFloor(cx, cy)) return t;
            const exit = Math.min(nextX, nextY, maxDist);
            const top = this.ceiling(cx, cy);
            const z = o.z + d.z * t;
            if (z > top || z < 0) return t; // an arch or a step in the ceiling
            if (d.z < 0 && o.z + d.z * exit < 0) return -o.z / d.z;
            if (d.z > 0 && o.z + d.z * exit > top) return (top - o.z) / d.z;
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

    private passes(x: number, y: number, dx: number, dy: number): boolean {
        return (
            dx === 0 ||
            dy === 0 ||
            (this.free(x + dx, y) && this.free(x, y + dy))
        );
    }

    /**
     * Steps (diagonals count as one, but not across corners) from the cell
     * (x, y) to every free cell, -1 where it can't be reached or is further
     * than limit steps.
     */
    distances(x: number, y: number, limit: number): number[] {
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
            const here = dist[cell]!;
            if (here >= limit) continue;
            for (const [dx, dy] of NEIGHBORS) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (!this.free(nx, ny) || dist[ny * w + nx]! >= 0) continue;
                if (!this.passes(cx, cy, dx, dy)) continue;
                dist[ny * w + nx] = here + 1;
                queue.push(ny * w + nx);
            }
        }
        return dist;
    }

    /** The neighbor cell of (x, y) that is nearer by the distances. */
    downhill(
        dist: number[],
        x: number,
        y: number,
    ): { x: number; y: number } | null {
        let best: { x: number; y: number } | null = null;
        const inside = x >= 0 && y >= 0 && x < this.width && y < this.height;
        const here = inside ? dist[y * this.width + x]! : -1;
        let bestDist = here < 0 ? Number.MAX_SAFE_INTEGER : here;
        for (const [dx, dy] of NEIGHBORS) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.free(nx, ny)) continue;
            if (!this.passes(x, y, dx, dy)) continue;
            const d = dist[ny * this.width + nx]!;
            if (d >= 0 && d < bestDist) {
                best = { x: nx, y: ny };
                bestDist = d;
            }
        }
        return best;
    }

    /** The free cell whose center is nearest to (x, y). */
    nearestFree(x: number, y: number): { x: number; y: number } {
        let best = { x: 0, y: 0 };
        let bestDist = Number.MAX_VALUE;
        for (let cy = 0; cy < this.height; cy++)
            for (let cx = 0; cx < this.width; cx++) {
                const d = (cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2;
                if (d < bestDist && this.free(cx, cy)) {
                    best = { x: cx, y: cy };
                    bestDist = d;
                }
            }
        return best;
    }

    /** The menu's camera, slowly circling the grand piano of the ballroom. */
    static flyby(camera: THREE.Camera, t: number): void {
        const a = t * 0.08 + 2.2;
        world(
            71 + 5.2 * Math.cos(a),
            10.5 + 5.2 * Math.sin(a),
            2.4 + 0.3 * Math.sin(t * 0.3),
            camera.position,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(
            world(
                71 + 1.5 * Math.cos(a + 1.2),
                10.5 + 1.5 * Math.sin(a + 1.2),
                1.4,
            ),
        );
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
        const d = new THREE.Vector3((bx - ax) / dist, (by - ay) / dist, 0);
        return (
            this.raycast(new THREE.Vector3(ax, ay, 1.2), d, dist) >= dist - 0.05
        );
    }

    /**
     * A cell to lie in wait in for someone at (fromX, fromY): one the player
     * at (px, py) can't see, close to the player's way (3 to 14 steps from
     * the player) and at most reach steps for the one hiding; none of the
     * taken cells nor their neighbors. null when there is none.
     */
    cover(
        fromX: number,
        fromY: number,
        px: number,
        py: number,
        taken: Set<number>,
        reach = 25,
    ): { x: number; y: number } | null {
        const toPlayer = this.distances(Math.floor(px), Math.floor(py), 14);
        const fromMe = this.distances(
            Math.floor(fromX),
            Math.floor(fromY),
            reach,
        );
        let best: { x: number; y: number } | null = null;
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
                best = { x, y };
                bestScore = score;
            }
        }
        if (best)
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++)
                    taken.add((best.y + dy) * this.width + best.x + dx);
        return best;
    }

    // --- building -------------------------------------------------------

    /** Walls, floors and ceilings: one mesh per texture. */
    private buildHull(anisotropy: number): void {
        const sheet = Res.image("tiles");
        const canvas = document.createElement("canvas");
        canvas.width = sheet.width;
        canvas.height = sheet.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(sheet, 0, 0);
        const lastRow = Math.trunc(sheet.height / TILE / 2);
        const surfaces = new Map<
            number,
            {
                positions: number[];
                normals: number[];
                uvs: number[];
                indices: number[];
            }
        >();

        const quad = (tile: number, corners: number[][], uvs: number[][]) => {
            let s = surfaces.get(tile);
            if (!s) {
                s = { positions: [], normals: [], uvs: [], indices: [] };
                surfaces.set(tile, s);
            }
            const [a, b, c] = corners.map(
                ([x = 0, y = 0, z = 0]) => new THREE.Vector3(x, y, z),
            );
            const normal = b!
                .clone()
                .sub(a!)
                .cross(c!.clone().sub(a!))
                .normalize();
            const base = s.positions.length / 3;
            for (let i = 0; i < 4; i++) {
                const [x = 0, y = 0, z = 0] = corners[i]!;
                s.positions.push(x, z, y);
                s.normals.push(normal.x, normal.z, normal.y);
                s.uvs.push(uvs[i]![0]!, uvs[i]![1]!);
            }
            // map space is mirrored in three.js' (y and z swap), so the winding turns
            for (const i of [0, 2, 1, 0, 3, 2]) s.indices.push(base + i);
        };

        const wall = (
            x: number,
            y: number,
            [x0, y0]: [number, number],
            [x1, y1]: [number, number],
            lo: number,
            hi: number,
            window: boolean,
        ) => {
            const row = this.section(x, y);
            const top = this.ceiling(x, y);
            const topStart = top - 1;
            const baseEnd = Math.min(topStart, 1);
            const u0 = x0 + y0;
            const u1 = x1 + y1;
            // base: the lowest meter, top: the meter under the ceiling, panels between
            const bands: [number, number, number, number][] = [
                [0, baseEnd, row * KINDS, 1],
                [baseEnd, topStart, window ? WINDOW : row * KINDS + 1, 1],
                [topStart, top, row * KINDS + 2, top],
            ];
            for (const [bandFrom, bandTo, tile, v] of bands) {
                const from = Math.max(bandFrom, lo);
                const to = Math.min(bandTo, hi);
                if (to - from < 0.001) continue;
                quad(
                    tile,
                    [
                        [x0, y0, from],
                        [x1, y1, from],
                        [x1, y1, to],
                        [x0, y0, to],
                    ],
                    [
                        [u0, v - from],
                        [u1, v - from],
                        [u1, v - to],
                        [u0, v - to],
                    ],
                );
            }
        };

        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++) {
                if (!this.isFloor(x, y)) continue;
                const top = this.ceiling(x, y);
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
                        wall(x, y, [x + 1, y + 1], [x + 1, y], lo, top, window);
                    else if (dx === -1)
                        wall(x, y, [x, y], [x, y + 1], lo, top, window);
                    else if (dy === 1)
                        wall(x, y, [x, y + 1], [x + 1, y + 1], lo, top, window);
                    else wall(x, y, [x + 1, y], [x, y], lo, top, window);
                }
                const row = this.section(x, y);
                quad(
                    row * KINDS + 3,
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
            }

        /** A tile of the sheet as a texture, mipmapped so far floors don't shimmer. */
        const tileTexture = (col: number, row: number) => {
            const data = ctx.getImageData(
                col * TILE,
                row * TILE,
                TILE,
                TILE,
            ).data;
            const tex = new THREE.DataTexture(
                data,
                TILE,
                TILE,
                THREE.RGBAFormat,
            );
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.magFilter = THREE.LinearFilter;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            tex.anisotropy = anisotropy;
            tex.needsUpdate = true;
            return { tex, data };
        };
        /** True when a glow tile has some glow in it. */
        const lit = (data: Uint8ClampedArray) => {
            for (let y = 0; y < TILE; y += 2)
                for (let x = 0; x < TILE; x += 2) {
                    const i = (y * TILE + x) * 4;
                    if (data[i]! > 8 || data[i + 1]! > 8 || data[i + 2]! > 8)
                        return true;
                }
            return false;
        };

        for (const [tile, s] of surfaces) {
            const col = tile % KINDS;
            const row = Math.trunc(tile / KINDS);
            const color = tileTexture(col, row).tex;
            const glowTile = tileTexture(col, row + lastRow);
            const glow = lit(glowTile.data) ? glowTile.tex : null;
            if (!glow) glowTile.tex.dispose();
            const material = new THREE.MeshStandardMaterial({
                map: color,
                emissive: glow
                    ? new THREE.Color(1.6, 1.6, 1.6)
                    : new THREE.Color(0, 0, 0),
                emissiveMap: glow,
                roughness: 0.75,
                metalness: 0,
            });
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(s.positions, 3),
            );
            geometry.setAttribute(
                "normal",
                new THREE.Float32BufferAttribute(s.normals, 3),
            );
            geometry.setAttribute(
                "uv",
                new THREE.Float32BufferAttribute(s.uvs, 2),
            );
            geometry.setIndex(s.indices);
            this.root.add(new THREE.Mesh(geometry, material));
        }
    }

    private placeProps(): void {
        for (const p of this.props) {
            const obj = model(p.name);
            const r: Rig = rig(obj);
            const a = THREE.MathUtils.degToRad(p.angle);
            world(p.x, p.y, 0, obj.position);
            obj.rotation.set(0, facing(Math.sin(a), -Math.cos(a)), 0);
            if (p.blocked) this.block(footprint(obj));
            this.root.add(obj);
            for (const [name, joint] of r.joints) {
                if (name.startsWith("Spin"))
                    this.moving.push({
                        kind: "spin",
                        obj: joint,
                        speed:
                            (name.startsWith("Spin-") ? -1 : 1) *
                            (0.6 + 0.4 * Math.random()),
                    });
                else if (name.startsWith("Pump "))
                    this.moving.push({
                        kind: "pump",
                        obj: joint,
                        y: joint.position.y,
                        phase:
                            (Number.parseFloat(name.substring(5)) || 0) *
                            Math.PI,
                    });
                else if (name.startsWith("Flame "))
                    this.moving.push({
                        kind: "flame",
                        obj: joint,
                        scale: joint.scale.clone(),
                        phase: Math.random() * 10,
                    });
            }
        }
    }

    /**
     * Makes the box of a placed prop (three.js coordinates) solid: exactly
     * for collisions and rays (and the shots flying over it), and for paths
     * every cell whose center it comes near. The map's blocked cells only
     * say that the prop is solid, the model itself says how much room it
     * takes.
     */
    private block(box: THREE.Box3): void {
        if (box.isEmpty()) return;
        const b: Blocker = {
            x0: box.min.x,
            y0: box.min.z,
            x1: box.max.x,
            y1: box.max.z,
            top: Math.max(box.max.y, 0.1),
        };
        this.blockers.push(b);
        const m = PATH_CLEARANCE;
        for (let y = Math.floor(b.y0 - m); y <= Math.floor(b.y1 + m); y++)
            for (let x = Math.floor(b.x0 - m); x <= Math.floor(b.x1 + m); x++) {
                if (x < 0 || y < 0 || x >= this.width || y >= this.height)
                    continue;
                if (boxDistSq(x + 0.5, y + 0.5, b.x0, b.y0, b.x1, b.y1) >= m * m)
                    continue;
                const c = y * this.width + x;
                this.propHeight[c] = Math.max(this.propHeight[c]!, b.top);
            }
    }

    /** What moves on the props: turning, bobbing and flickering joints. */
    animate(dt: number, t: number): void {
        for (const m of this.moving) {
            if (m.kind === "spin") m.obj.rotateY(m.speed * dt);
            else if (m.kind === "pump")
                m.obj.position.y = m.y + 0.06 * Math.sin(t * 2 + m.phase);
            else
                m.obj.scale.set(
                    m.scale.x,
                    m.scale.y *
                        (0.85 +
                            0.25 *
                                Math.sin(t * 13 + m.phase) *
                                Math.sin(t * 7.3 + m.phase * 2)),
                    m.scale.z,
                );
        }
    }

    /** Candles, torches and moonlight. */
    private placeLights(pool: LightPool): void {
        const moon = new THREE.Color().setRGB(
            0.6,
            0.7,
            1.0,
            THREE.SRGBColorSpace,
        );
        const fire = new THREE.Color().setRGB(
            1.0,
            0.6,
            0.28,
            THREE.SRGBColorSpace,
        );
        const blood = new THREE.Color().setRGB(
            1.0,
            0.25,
            0.2,
            THREE.SRGBColorSpace,
        );
        const light = (
            x: number,
            y: number,
            z: number,
            color: THREE.Color,
            energy: number,
            range: number,
        ) =>
            pool.add({
                position: world(x, y, z),
                color,
                lumens: energy * LUMENS,
                range,
            });
        // crypt: torches on the pillars, the blood altar's glow, candles at the coffins
        for (const x of [5.5, 11.5, 17.5])
            for (const y of [4.5, 10.5, 16.5])
                if (!(x === 11.5 && y === 10.5)) light(x, y, 3.5, fire, 0.8, 9);
        light(13, 10.5, 3.4, blood, 1.4, 10);
        light(3, 16, 1.5, fire, 0.8, 6);
        // corridor: chandeliers under the vault, cold moonlight between them
        let i = 0;
        for (let x = 26; x < 63; x += 4)
            light(x, 10.5, 2.2, i++ % 2 === 0 ? fire : moon, 0.7, 6);
        // bedchambers: a candle each
        for (let k = 0; k < 10; k++) {
            light(25.5 + 4 * k, 5.5, 1.6, fire, 0.35, 5);
            light(25.5 + 4 * k, 15.5, 1.6, fire, 0.35, 5);
        }
        // ballroom: the candelabra, the organ, moonlight through the windows
        light(65, 4.5, 2.4, fire, 1.0, 8);
        light(65, 16.5, 2.4, fire, 1.0, 8);
        light(71, 10.5, 2.0, fire, 0.9, 7);
        for (const y of [6.5, 10.5, 14.5]) light(79.5, y, 2.5, moon, 0.9, 8);
        light(74, 10.5, 3.5, fire, 0.6, 9);
    }
}

/**
 * The box (three.js coordinates) of the parts of a placed model lower than
 * FOOT_HEIGHT, reaching up to the model's top.
 */
function footprint(obj: THREE.Object3D): THREE.Box3 {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    let top = 0;
    obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const pos = mesh.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
            if (v.y > top) top = v.y;
            if (v.y < FOOT_HEIGHT) box.expandByPoint(v);
        }
    });
    if (!box.isEmpty()) box.max.y = Math.max(box.max.y, top);
    return box;
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
 * Distance along the ray from o in the direction d (map coordinates) to the
 * box of a prop, 0 from inside it, Infinity when it misses.
 */
function rayBox(o: THREE.Vector3, d: THREE.Vector3, b: Blocker): number {
    let near = 0;
    let far = Infinity;
    const slab = (from: number, dir: number, lo: number, hi: number): boolean => {
        if (dir === 0) return from >= lo && from <= hi;
        let t0 = (lo - from) / dir;
        let t1 = (hi - from) / dir;
        if (t0 > t1) [t0, t1] = [t1, t0];
        if (t0 > near) near = t0;
        if (t1 < far) far = t1;
        return near <= far;
    };
    return slab(o.x, d.x, b.x0, b.x1) &&
        slab(o.y, d.y, b.y0, b.y1) &&
        slab(o.z, d.z, 0, b.top)
        ? near
        : Infinity;
}
