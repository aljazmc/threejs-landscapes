import * as THREE from "three";
import * as Res from "./res";

/**
 * The graphics of res/: the models (GLB, written by
 * blender-scripts/exportglb.py), textures cut from the sprite sheets, and
 * the materials and meshes of glows and beams.
 *
 * The game lights and blends in the colors as stored, without converting sRGB,
 * so the textures are uploaded as they are (NoColorSpace), color
 * management is off and the renderer writes its results unconverted (see
 * Main).
 */

/** RGBA pixels, rows from the top. */
export interface Pixels {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

export function pixels(img: HTMLImageElement): Pixels {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    return { width: img.width, height: img.height, data };
}

export function sub(
    p: Pixels,
    x: number,
    y: number,
    w: number,
    h: number,
): Pixels {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
        const from = ((y + row) * p.width + x) * 4;
        data.set(p.data.subarray(from, from + w * 4), row * w * 4);
    }
    return { width: w, height: h, data };
}

/**
 * A texture of the pixels; its first row is at v = 0, as the UVs expect. Mipmapped textures repeat (walls, floors).
 */
export function texture(p: Pixels, mipMaps: boolean): THREE.DataTexture {
    const tex = new THREE.DataTexture(
        p.data,
        p.width,
        p.height,
        THREE.RGBAFormat,
    );
    tex.colorSpace = THREE.NoColorSpace;
    tex.magFilter = THREE.LinearFilter;
    if (mipMaps) {
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    } else {
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
    }
    tex.needsUpdate = true;
    return tex;
}

/** True when RGBA pixels are not all black (an emission tile with some glow). */
export function lit(p: Pixels): boolean {
    const d = p.data;
    for (let i = 0; i < d.length; i += 4)
        if (d[i]! > 6 || d[i + 1]! > 6 || d[i + 2]! > 6) return true;
    return false;
}

const sheets = new Map<string, THREE.DataTexture[][]>();

/**
 * The cells of res/shooter-<name>.png as textures, by row and column.
 * Premultiplied (color times alpha) for sprites drawn additively, which
 * ignores alpha.
 */
export function sheet(
    name: string,
    cellW: number,
    cellH: number,
    premultiply = false,
): THREE.DataTexture[][] {
    const key = `${name}:${premultiply}`;
    const cached = sheets.get(key);
    if (cached) return cached;
    const all = pixels(Res.image(name));
    if (premultiply) {
        const d = all.data;
        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3]! / 255;
            d[i] = Math.trunc(d[i]! * a);
            d[i + 1] = Math.trunc(d[i + 1]! * a);
            d[i + 2] = Math.trunc(d[i + 2]! * a);
        }
    }
    const cells: THREE.DataTexture[][] = [];
    for (let y = 0; y < Math.trunc(all.height / cellH); y++) {
        const row: THREE.DataTexture[] = [];
        for (let x = 0; x < Math.trunc(all.width / cellW); x++)
            row.push(
                texture(sub(all, x * cellW, y * cellH, cellW, cellH), false),
            );
        cells.push(row);
    }
    sheets.set(key, cells);
    return cells;
}

export type Blend = "add" | "alpha";

/** Material settings of a glow: unlit, not writing depth, blended. */
function glowSettings(blend: Blend): THREE.MaterialParameters {
    const common = {
        depthWrite: false,
        transparent: true,
        side: THREE.DoubleSide,
    };
    if (blend === "alpha") return { ...common, blending: THREE.NormalBlending };
    // additive: the color added as it is, alpha ignored
    return {
        ...common,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
    };
}

/** Unlit material adding its texture's light to what is behind. */
export function glowMaterial(
    tex: THREE.Texture,
    blend: Blend = "add",
): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map: tex, ...glowSettings(blend) });
}

/** A glow sprite, always facing the camera. */
export function spriteMaterial(
    tex: THREE.Texture,
    blend: Blend = "add",
): THREE.SpriteMaterial {
    return new THREE.SpriteMaterial({ map: tex, ...glowSettings(blend) });
}

/**
 * The model's materials as the game draws them: "Glow" (the neon parts)
 * without lighting, as the light it gives itself, the others lit. Done
 * once per loaded model; its instances share them.
 */
const prepared = new WeakSet<THREE.Object3D>();

function prepare(scene: THREE.Group): void {
    if (prepared.has(scene)) return;
    prepared.add(scene);
    const converted = new Map<THREE.Material, THREE.Material>();
    scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const convert = (m: THREE.Material): THREE.Material => {
            let done = converted.get(m);
            if (!done) {
                const map = (m as THREE.MeshStandardMaterial).map ?? null;
                if (map) {
                    map.colorSpace = THREE.NoColorSpace;
                    map.needsUpdate = true;
                }
                done =
                    m.name === "Glow"
                        ? new THREE.MeshBasicMaterial({ map, fog: false })
                        : new THREE.MeshLambertMaterial({ map, fog: false });
                done.name = m.name;
                converted.set(m, done);
            }
            return done;
        };
        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(convert)
            : convert(mesh.material);
    });
}

/**
 * A new instance of res/shooter-<name>.glb. ownMaterials gives it copies
 * of the materials, to be tinted on their own (a hit alien flashes).
 */
export function model(name: string, ownMaterials = false): THREE.Object3D {
    const source = Res.model(name);
    prepare(source);
    const obj = source.clone(true);
    if (ownMaterials) {
        const copies = new Map<THREE.Material, THREE.Material>();
        const copy = (m: THREE.Material) => {
            let c = copies.get(m);
            if (!c) {
                c = m.clone();
                copies.set(m, c);
            }
            return c;
        };
        obj.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(copy)
                : copy(mesh.material);
        });
    }
    return obj;
}

/** The materials of a model, each once. */
export function materials(
    obj: THREE.Object3D,
): (THREE.MeshBasicMaterial | THREE.MeshLambertMaterial)[] {
    const found = new Set<
        THREE.MeshBasicMaterial | THREE.MeshLambertMaterial
    >();
    obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const list = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        for (const m of list)
            found.add(m as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial);
    });
    return [...found];
}

/** The bounds of a model standing at the origin, unturned. */
export function bounds(obj: THREE.Object3D): THREE.Box3 {
    obj.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(obj);
}

let beam: THREE.BufferGeometry | null = null;

/** Two crossed strips along X from 0 to 1, 1 wide, for laser beams. */
export function beamGeometry(): THREE.BufferGeometry {
    if (!beam) {
        beam = new THREE.BufferGeometry();
        const stripY = [0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0];
        const stripZ = [0, 0, -0.5, 1, 0, -0.5, 1, 0, 0.5, 0, 0, 0.5];
        const points = [...stripY, ...stripZ];
        const uvs = [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0];
        beam.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(points, 3),
        );
        beam.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        beam.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    }
    return beam;
}

/** A soft glowing line across the texture height, for beams. */
export function beamTexture(color: number): THREE.DataTexture {
    const data = new Uint8ClampedArray(4 * 32 * 4);
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    for (let y = 0; y < 32; y++) {
        const d = (y - 15.5) / 15.5;
        const core = Math.exp(-d * d * 40);
        const halo = Math.exp(-d * d * 5) * 0.55;
        const channel = (c: number) =>
            Math.trunc(Math.min(255, (c * halo + core) * 255));
        for (let x = 0; x < 4; x++) {
            const i = (y * 4 + x) * 4;
            data[i] = channel(r);
            data[i + 1] = channel(g);
            data[i + 2] = channel(b);
            data[i + 3] = 255;
        }
    }
    return texture({ width: 4, height: 32, data }, false);
}
