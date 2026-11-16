import * as THREE from "three";

/** How much taller the hills stand than they are, so they show from afar. */
export const EXAGGERATION = 2;
/**
 * Meters between the points of the ground, coarser than the data: a low
 * poly ground of flat triangles, which everything on it follows exactly.
 */
const LOW_POLY = 150;

/** How high above the ground things are drawn, in meters. */
export const LIFT = {
    wireframe: 0.5,
    lines: 1,
    // the wireframe models stand on the ground
    traffic: 0.3,
    icons: 0.3,
    // the veil over the quarters not chosen, over the lines and the icons
    veil: 2.5,
};

/**
 * The height of the ground on a grid, as inkscape-scripts/osm/terrain.py
 * writes it: heights in decimeters above base (meters above the sea), as
 * little endian 16 bit integers in base64, row by row from the south,
 * each row from the west; x0 and y0 are the map's meters east and north
 * of the town hall of the first point.
 */
export interface TerrainData {
    source: string;
    step: number;
    x0: number;
    y0: number;
    columns: number;
    rows: number;
    base: number;
    heights: string;
}

export async function loadTerrain(
    url = "map/terrain.json",
): Promise<TerrainData | null> {
    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`${url}: ${response.status}, the ground is flat`);
        return null;
    }
    return response.json();
}

/**
 * The ground of the scene, low poly: flat triangles between the points of
 * a coarse grid (every LOW_POLY meters, each the mean of the data round
 * it), two to each square, cut from its south west to its north east
 * corner. Its height (three.js y, from 0 at the lowest point, with the
 * hills exaggerated) is known anywhere on the map, held at the edge of the
 * grid beyond it; it is flat without terrain data.
 */
export class Terrain {
    readonly step: number;
    readonly x0: number;
    readonly y0: number;
    readonly columns: number;
    readonly rows: number;
    /** The highest point of the ground. */
    readonly top: number;
    private readonly heights: Float32Array;

    constructor(data: TerrainData | null) {
        if (!data) {
            this.step = 1e6;
            this.x0 = -1e6;
            this.y0 = -1e6;
            this.columns = 3;
            this.rows = 3;
            this.heights = new Float32Array(9);
            this.top = 0;
            return;
        }
        const bytes = Uint8Array.from(atob(data.heights), (c) =>
            c.charCodeAt(0),
        );
        const view = new DataView(bytes.buffer);
        const fine = (c: number, r: number) =>
            view.getUint16(
                2 *
                    (THREE.MathUtils.clamp(r, 0, data.rows - 1) * data.columns +
                        THREE.MathUtils.clamp(c, 0, data.columns - 1)),
                true,
            ) / 10;
        const every = Math.max(1, Math.round(LOW_POLY / data.step));
        const reach = Math.floor(every / 2);
        this.step = data.step * every;
        this.x0 = data.x0;
        this.y0 = data.y0;
        this.columns = Math.floor((data.columns - 1) / every) + 1;
        this.rows = Math.floor((data.rows - 1) / every) + 1;
        this.heights = new Float32Array(this.columns * this.rows);
        let top = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                let sum = 0;
                let count = 0;
                for (let j = -reach; j <= reach; j++) {
                    for (let i = -reach; i <= reach; i++) {
                        sum += fine(c * every + i, r * every + j);
                        count++;
                    }
                }
                const height = (sum / count) * EXAGGERATION;
                this.heights[r * this.columns + c] = height;
                top = Math.max(top, height);
            }
        }
        this.top = top;
    }

    /** The map's x and y of the grid's corners. */
    get extent() {
        return new THREE.Box2(
            new THREE.Vector2(this.x0, this.y0),
            new THREE.Vector2(
                this.x0 + (this.columns - 1) * this.step,
                this.y0 + (this.rows - 1) * this.step,
            ),
        );
    }

    /** The height of the ground at the map's x and y. */
    heightAt(x: number, y: number) {
        const fx = THREE.MathUtils.clamp(
            (x - this.x0) / this.step,
            0,
            this.columns - 1,
        );
        const fy = THREE.MathUtils.clamp(
            (y - this.y0) / this.step,
            0,
            this.rows - 1,
        );
        const c = Math.min(Math.floor(fx), this.columns - 2);
        const r = Math.min(Math.floor(fy), this.rows - 2);
        const tx = fx - c;
        const ty = fy - r;
        const h = this.heights;
        const k = r * this.columns + c;
        const sw = h[k]!;
        const ne = h[k + this.columns + 1]!;
        // on the flat triangle the point lies in
        return tx >= ty
            ? sw + tx * (h[k + 1]! - sw) + ty * (ne - h[k + 1]!)
            : sw +
                  ty * (h[k + this.columns]! - sw) +
                  tx * (ne - h[k + this.columns]!);
    }

    /** The height of the ground under a point of the scene. */
    under(x: number, z: number) {
        return this.heightAt(x, -z);
    }

    /** A point of the map on the ground of the scene, raised by lift. */
    ground(x: number, y: number, lift = 0) {
        return new THREE.Vector3(x, this.heightAt(x, y) + lift, -y);
    }

    /**
     * Where a ray of the scene first meets the ground, or null if it
     * passes over it: marches along it in steps that the height above the
     * ground keeps short of any slope, then halves the last step.
     */
    raycast(ray: THREE.Ray, out = new THREE.Vector3(), far = 60000) {
        const p = out;
        let before = 0;
        let t = 0;
        for (let i = 0; i < 3000 && t < far; i++) {
            ray.at(t, p);
            const above = p.y - this.under(p.x, p.z);
            if (above <= 0) {
                let lo = before;
                let hi = t;
                for (let k = 0; k < 20; k++) {
                    const mid = (lo + hi) / 2;
                    ray.at(mid, p);
                    if (p.y > this.under(p.x, p.z)) {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
                return ray.at(hi, p);
            }
            if (p.y > this.top && ray.direction.y >= 0) {
                return null;
            }
            before = t;
            t += Math.max(above * 0.5, 0.5 + t * 0.002);
        }
        return null;
    }

    /** Whether the ground leaves a point of the scene in sight of another. */
    sees(from: THREE.Vector3, to: THREE.Vector3) {
        const distance = from.distanceTo(to);
        const steps = THREE.MathUtils.clamp(
            Math.ceil(distance / this.step),
            4,
            200,
        );
        // the last stretch is left out, as the point itself lies on it
        for (let i = 1; i < steps - 1; i++) {
            const t = i / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            const z = from.z + (to.z - from.z) * t;
            if (y < this.under(x, z)) {
                return false;
            }
        }
        return true;
    }

    /**
     * The edges of the triangles of the ground, raised by lift, as line
     * segments (x, y, z of both ends) of the scene.
     */
    wireframe(lift: number) {
        const { columns, rows, step, x0, y0, heights } = this;
        const out: number[] = [];
        const at = (c: number, r: number) => [
            x0 + c * step,
            heights[r * columns + c]! + lift,
            -(y0 + r * step),
        ];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                const here = at(c, r);
                if (c + 1 < columns) {
                    out.push(...here, ...at(c + 1, r));
                }
                if (r + 1 < rows) {
                    out.push(...here, ...at(c, r + 1));
                }
                if (c + 1 < columns && r + 1 < rows) {
                    out.push(...here, ...at(c + 1, r + 1));
                }
            }
        }
        return out;
    }

    /**
     * The surface of the ground as a mesh geometry of the grid, in the
     * scene, its uv running from the south west to the north east.
     */
    geometry() {
        const { columns, rows } = this;
        const positions = new Float32Array(columns * rows * 3);
        const uvs = new Float32Array(columns * rows * 2);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                const k = r * columns + c;
                positions[3 * k] = this.x0 + c * this.step;
                positions[3 * k + 1] = this.heights[k]!;
                positions[3 * k + 2] = -(this.y0 + r * this.step);
                uvs[2 * k] = c / (columns - 1);
                uvs[2 * k + 1] = r / (rows - 1);
            }
        }
        const indices: number[] = [];
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < columns - 1; c++) {
                const k = r * columns + c;
                // counterclockwise seen from above
                indices.push(k, k + 1, k + columns + 1);
                indices.push(k, k + columns + 1, k + columns);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
        );
        geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        // flat faces for the low poly look, each lit on its own
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        return geometry;
    }
}
