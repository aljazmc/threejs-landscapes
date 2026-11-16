import * as THREE from "three";

/**
 * Very low poly wireframe models, as lists of line segments (x, y, z of
 * both ends), standing on the origin with y up, in meters: the icons of
 * the places, a car and a train's wagon, drawn as glowing vector lines.
 */
type Lines = number[];
type P = [number, number, number];

function seg(out: Lines, a: P, b: P) {
    out.push(...a, ...b);
}

/** A closed line through points. */
function loop(out: Lines, points: P[]) {
    points.forEach((p, k) => {
        seg(out, p, points[(k + 1) % points.length]!);
    });
}

/** A box standing on (x, y, z). */
function box(out: Lines, w: number, h: number, d: number, x = 0, y = 0, z = 0) {
    const [x0, x1, z0, z1] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
    for (const yy of [y, y + h]) {
        loop(out, [
            [x0, yy, z0],
            [x1, yy, z0],
            [x1, yy, z1],
            [x0, yy, z1],
        ]);
    }
    for (const [xx, zz] of [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
    ] as const) {
        seg(out, [xx, y, zz], [xx, y + h, zz]);
    }
}

/** A gable roof on (x, y, z), its ridge h high along z (or x). */
function gable(
    out: Lines,
    w: number,
    h: number,
    d: number,
    x = 0,
    y = 0,
    z = 0,
    alongX = false,
) {
    // the two gables, then the ridge and the eaves
    const at = (u: number, v: number, s: number): P =>
        alongX ? [x + s, y + v, z + u] : [x + u, y + v, z + s];
    const [half, length] = alongX ? [d / 2, w / 2] : [w / 2, d / 2];
    for (const s of [-length, length]) {
        loop(out, [at(-half, 0, s), at(half, 0, s), at(0, h, s)]);
    }
    seg(out, at(0, h, -length), at(0, h, length));
    seg(out, at(-half, 0, -length), at(-half, 0, length));
    seg(out, at(half, 0, -length), at(half, 0, length));
}

/** A pyramid on a w by d base at (x, y, z), h high. */
function pyramid(
    out: Lines,
    w: number,
    d: number,
    h: number,
    x = 0,
    y = 0,
    z = 0,
) {
    const base: P[] = [
        [x - w / 2, y, z - d / 2],
        [x + w / 2, y, z - d / 2],
        [x + w / 2, y, z + d / 2],
        [x - w / 2, y, z + d / 2],
    ];
    loop(out, base);
    for (const p of base) {
        seg(out, p, [x, y + h, z]);
    }
}

/**
 * An n sided prism, frustum or (with no top radius) cone on (x, y, z);
 * an n sided ring is one without height.
 */
function prism(
    out: Lines,
    n: number,
    bottom: number,
    top: number,
    h: number,
    x = 0,
    y = 0,
    z = 0,
    turn = 0,
) {
    const ring = (r: number, yy: number) =>
        Array.from({ length: n }, (_, k): P => {
            const a = turn + (k / n) * Math.PI * 2;
            return [x + r * Math.cos(a), yy, z + r * Math.sin(a)];
        });
    const low = ring(bottom, y);
    const high = ring(top, y + h);
    if (bottom > 0) {
        loop(out, low);
    }
    if (top > 0 && h > 0) {
        loop(out, high);
    }
    if (h > 0) {
        low.forEach((p, k) => {
            seg(out, p, high[k]!);
        });
    }
}

/** A plus sign standing upright, facing z, centered s over (x, y, z). */
function cross(out: Lines, s: number, t: number, x = 0, y = 0, z = 0) {
    const a = s / 2;
    const b = t / 2;
    const c = y + a;
    loop(
        out,
        (
            [
                [-b, a],
                [b, a],
                [b, b],
                [a, b],
                [a, -b],
                [b, -b],
                [b, -a],
                [-b, -a],
                [-b, -b],
                [-a, -b],
                [-a, b],
                [-b, b],
            ] as const
        ).map(([u, v]): P => [x + u, c + v, z]),
    );
}

/** A half circle standing upright, facing z. */
function arch(out: Lines, r: number, x = 0, y = 0, z = 0, n = 6) {
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI;
        const b = ((k + 1) / n) * Math.PI;
        seg(
            out,
            [x + r * Math.cos(a), y + r * Math.sin(a), z],
            [x + r * Math.cos(b), y + r * Math.sin(b), z],
        );
    }
}

function model(draw: (out: Lines) => void) {
    const out: Lines = [];
    draw(out);
    return out;
}

const house = (out: Lines, w: number, h: number, d: number, x = 0, z = 0) => {
    box(out, w, h, d, x, 0, z);
    gable(out, w + 1, w * 0.4, d + 1, x, h, z);
};

/** The models of the places, by the names of their icons. */
export const MODELS: Record<string, Lines> = {
    museum: model((o) => {
        box(o, 32, 2, 20);
        box(o, 26, 10, 12, 0, 2, -3);
        for (let i = 0; i < 6; i++) {
            box(o, 1.4, 10, 1.4, -12.5 + i * 5, 2, 8);
        }
        gable(o, 32, 6, 20, 0, 12, 0);
    }),
    office: model((o) => {
        box(o, 26, 14, 14);
        box(o, 6, 6, 6, 0, 14, 0);
        pyramid(o, 7, 7, 4, 0, 20, 0);
        seg(o, [11, 14, 0], [11, 24, 0]);
        loop(o, [
            [11, 24, 0],
            [16, 22.5, 0],
            [11, 21, 0],
        ]);
    }),
    church: model((o) => {
        box(o, 12, 10, 24, 0, 0, -4);
        gable(o, 12, 6, 24, 0, 10, -4);
        box(o, 7, 22, 7, 0, 0, 11);
        pyramid(o, 7, 7, 12, 0, 22, 11);
        seg(o, [0, 34, 11], [0, 38, 11]);
        seg(o, [-1.5, 36.5, 11], [1.5, 36.5, 11]);
    }),
    tower: model((o) => {
        box(o, 9, 26, 9);
        box(o, 11, 2, 11, 0, 26, 0);
        pyramid(o, 9, 9, 9, 0, 28, 0);
    }),
    monument: model((o) => {
        box(o, 10, 3, 10);
        prism(o, 4, 2.6, 1.4, 18, 0, 3, 0, Math.PI / 4);
        prism(o, 4, 1.4, 0, 3, 0, 21, 0, Math.PI / 4);
    }),
    monastery: model((o) => {
        box(o, 30, 8, 6, 0, 0, -12);
        box(o, 30, 8, 6, 0, 0, 12);
        box(o, 6, 8, 18, -12, 0, 0);
        box(o, 6, 8, 18, 12, 0, 0);
        box(o, 5, 18, 5, 12, 0, -12);
        pyramid(o, 5, 5, 7, 12, 18, -12);
    }),
    restaurant: model((o) => {
        house(o, 14, 7, 12);
        box(o, 2, 6, 2, 4, 8, 2);
    }),
    stadium: model((o) => {
        prism(o, 10, 20, 26, 7);
        prism(o, 10, 14, 14, 0);
    }),
    station: model((o) => {
        box(o, 32, 7, 10);
        box(o, 38, 1, 16, 0, 8, 0);
        box(o, 4, 15, 4, -12, 0, 0);
        for (const z of [-11, -9.5]) {
            seg(o, [-30, 0, z], [30, 0, z]);
        }
    }),
    hospital: model((o) => {
        box(o, 22, 14, 16);
        cross(o, 10, 3, 0, 14, 0);
    }),
    clinic: model((o) => {
        box(o, 14, 8, 12);
        cross(o, 7, 2.2, 0, 8, 0);
    }),
    pharmacy: model((o) => {
        box(o, 10, 6, 10);
        seg(o, [0, 6, 0], [0, 9, 0]);
        cross(o, 9, 3, 0, 9, 0);
    }),
    police: model((o) => {
        box(o, 14, 8, 12);
        prism(o, 6, 1.6, 1.6, 2.5, 0, 8, 0);
        prism(o, 6, 1.6, 0, 1.5, 0, 10.5, 0);
        loop(o, [
            [-3, 3, 6.05],
            [3, 3, 6.05],
            [3, 6, 6.05],
            [0, 7, 6.05],
            [-3, 6, 6.05],
        ]);
    }),
    fire: model((o) => {
        box(o, 18, 9, 12);
        loop(o, [
            [-7, 0, 6.05],
            [-1, 0, 6.05],
            [-1, 6, 6.05],
            [-7, 6, 6.05],
        ]);
        box(o, 4, 20, 4, 8, 0, -4);
        pyramid(o, 4, 4, 3, 8, 20, -4);
    }),
    court: model((o) => {
        box(o, 22, 10, 16);
        for (const x of [-7.5, -2.5, 2.5, 7.5]) {
            box(o, 1.4, 10, 1.4, x, 0, 9);
        }
        prism(o, 8, 7, 5, 3, 0, 10, 0);
        prism(o, 8, 5, 0, 3, 0, 13, 0);
    }),
    post: model((o) => {
        box(o, 14, 9, 12);
        const z = 6.05;
        loop(o, [
            [-4, 2, z],
            [4, 2, z],
            [4, 7, z],
            [-4, 7, z],
        ]);
        seg(o, [-4, 7, z], [0, 4, z]);
        seg(o, [0, 4, z], [4, 7, z]);
    }),
    library: model((o) => {
        box(o, 20, 10, 14);
        // an open book on the roof
        seg(o, [0, 10.5, -4], [0, 10.5, 4]);
        for (const x of [-7, 7]) {
            loop(o, [
                [0, 10.5, -4],
                [x, 13, -4],
                [x, 13, 4],
                [0, 10.5, 4],
            ]);
        }
    }),
    theatre: model((o) => {
        box(o, 22, 10, 26);
        box(o, 16, 10, 10, 0, 10, -6);
        arch(o, 6, 0, 0, 13.05);
    }),
    community: model((o) => {
        house(o, 12, 6, 10, -7);
        house(o, 10, 8, 10, 7);
    }),
    school: model((o) => {
        box(o, 32, 9, 12);
        gable(o, 33, 5, 13, 0, 9, 0, true);
        box(o, 3, 4, 3, 0, 13, 0);
        pyramid(o, 3, 3, 4, 0, 17, 0);
    }),
    kindergarten: model((o) => {
        house(o, 12, 5, 10);
        box(o, 3, 3, 3, 10, 0, 3);
        box(o, 3, 3, 3, 10, 3, 3);
        box(o, 3, 3, 3, 13.5, 0, 3);
    }),
    bar: model((o) => {
        prism(o, 6, 4, 4, 0);
        prism(o, 4, 0.4, 0.4, 9);
        prism(o, 6, 0.6, 8, 9, 0, 9, 0);
    }),
    cafe: model((o) => {
        prism(o, 8, 9, 9, 0);
        prism(o, 8, 5, 6.5, 9, 0, 0.5, 0);
        const handle: P[] = Array.from({ length: 6 }, (_, k): P => {
            const a = -Math.PI / 2 + (k / 5) * Math.PI;
            return [6.5 + 3 * Math.cos(a), 5 + 2.5 * Math.sin(a), 0];
        });
        handle.slice(1).forEach((p, k) => {
            seg(o, handle[k]!, p);
        });
    }),
};

/** A skull over crossed bones, facing z, for banned employers. */
export const SKULL = model((o) => {
    // the cranium, widening then rounding off
    prism(o, 8, 7, 9, 6, 0, 8, 0, Math.PI / 8);
    prism(o, 8, 9, 6, 5, 0, 14, 0, Math.PI / 8);
    prism(o, 8, 6, 0, 3, 0, 19, 0, Math.PI / 8);
    // the eye sockets and the nose
    for (const x of [-3.6, 3.6]) {
        loop(
            o,
            Array.from({ length: 6 }, (_, k): P => {
                const a = (k / 6) * Math.PI * 2;
                return [x + 2.2 * Math.cos(a), 12 + 2.2 * Math.sin(a), 7.9];
            }),
        );
    }
    loop(o, [
        [0, 10.5, 8.3],
        [1.2, 8.6, 8.1],
        [-1.2, 8.6, 8.1],
    ]);
    // the jaw and its teeth
    box(o, 9, 4, 7, 0, 4, 1.5);
    for (let x = -3; x <= 3; x += 1.5) {
        seg(o, [x, 5.2, 5.05], [x, 8, 5.05]);
    }
    seg(o, [-4.5, 6.6, 5.05], [4.5, 6.6, 5.05]);
    // the crossed bones, knobbed at the ends
    for (const [a, b] of [
        [
            [-12, 0.8, 7],
            [12, 0.8, -7],
        ],
        [
            [-12, 0.8, -7],
            [12, 0.8, 7],
        ],
    ] as [P, P][]) {
        seg(o, a, b);
        for (const [x, y, z] of [a, b]) {
            prism(o, 6, 1.4, 1.4, 1.2, x, y - 0.6, z);
        }
    }
});

/** For an icon without a model. */
export const FALLBACK = model((o) => pyramid(o, 10, 10, 14));

/** How tall a model is, and its largest size across any way. */
export function extent(lines: Lines) {
    const box = new THREE.Box3().setFromArray(lines);
    const size = box.getSize(new THREE.Vector3());
    return { height: box.max.y, size: Math.max(size.x, size.y, size.z) };
}

/** How far a model reaches from its middle, turning round the vertical. */
export function reach(lines: Lines) {
    let most = 0;
    for (let i = 0; i < lines.length; i += 3) {
        most = Math.max(most, Math.hypot(lines[i]!, lines[i + 2]!));
    }
    return most;
}

/** A car, its front along +x. */
export const CAR = model((o) => {
    box(o, 4.4, 1, 1.8, 0, 0.3, 0);
    box(o, 2.2, 0.8, 1.6, -0.3, 1.3, 0);
});

/** A train's wagon, its front along +x. */
export const WAGON = model((o) => {
    box(o, 22, 3.4, 3, 0, 0.6, 0);
    gable(o, 22, 0.6, 3, 0, 4, 0, true);
});

/**
 * Shared by every wireframe: the meters a pixel spans at a meter from the
 * camera (2 tan(fov / 2) / the height of the view), and the time.
 */
export const WIRE = {
    perPixel: { value: 0.001 },
    time: { value: 0 },
};

export interface Wire {
    object: THREE.LineSegments;
    /** Where each one stands, its turn round the vertical and alpha. */
    offsets: THREE.InstancedBufferAttribute;
    headings: THREE.InstancedBufferAttribute;
    alphas: THREE.InstancedBufferAttribute;
    /** With a morph model: whether each copy morphs (1) or stays (0). */
    morphs: THREE.InstancedBufferAttribute;
}

/**
 * Many copies of a wireframe model in one draw call, glowing: each at its
 * offset, turned by its heading (and slowly spun, if spin is given in
 * radians a second), at its real size near the camera and farther away
 * never smaller than pixels high, as a symbol. An alpha of 0 hides one.
 * The glow fades with the distance: full up to fade.near meters from the
 * camera, down to fade.floor of it from fade.far on, so from afar the
 * many copies don't add up to one blinding light. Given a morph model,
 * each copy turns into it and back, over and over, with a glitch on the
 * way: its lines, matched in order (the fewer padded with lines of no
 * length), slide from one model to the other.
 */
export function wire(
    lines: Lines,
    count: number,
    options: {
        color: string;
        pixels: number;
        opacity?: number;
        spin?: number;
        fade?: { near: number; far: number; floor: number };
        morph?: Lines;
    },
): Wire {
    let morph: Lines | undefined;
    if (options.morph) {
        // as many lines in both, the extra ones of no length in the middle
        const length = Math.max(lines.length, options.morph.length);
        const pad = (from: Lines) => {
            const middle = [0, extent(from).height / 2, 0];
            const out = [...from];
            while (out.length < length) {
                out.push(...middle);
            }
            return out;
        };
        lines = pad(lines);
        morph = pad(options.morph);
    }
    const fade = options.fade ?? { near: 800, far: 5000, floor: 0.15 };
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(lines, 3),
    );
    const offsets = new THREE.InstancedBufferAttribute(
        new Float32Array(count * 3),
        3,
    );
    const headings = new THREE.InstancedBufferAttribute(
        new Float32Array(count),
        1,
    );
    const alphas = new THREE.InstancedBufferAttribute(
        new Float32Array(count).fill(1),
        1,
    );
    const morphs = new THREE.InstancedBufferAttribute(
        new Float32Array(count).fill(1),
        1,
    );
    for (const attribute of [offsets, headings, alphas, morphs]) {
        attribute.setUsage(THREE.DynamicDrawUsage);
    }
    geometry.setAttribute(
        "target",
        new THREE.Float32BufferAttribute(morph ?? lines, 3),
    );
    geometry.setAttribute("offset", offsets);
    geometry.setAttribute("heading", headings);
    geometry.setAttribute("alpha", alphas);
    geometry.setAttribute("morphs", morphs);
    geometry.instanceCount = count;
    const largest = Math.max(
        extent(lines).size,
        morph ? extent(morph).size : 0,
    );
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(options.color) },
            opacity: { value: options.opacity ?? 1 },
            perPixel: WIRE.perPixel,
            time: WIRE.time,
            pixels: { value: options.pixels },
            size: { value: largest },
            morphing: { value: morph ? 1 : 0 },
            spin: { value: options.spin ?? 0 },
            fade: { value: new THREE.Vector3(fade.near, fade.far, fade.floor) },
        },
        vertexShader: `
            attribute vec3 offset;
            attribute float heading;
            attribute float alpha;
            attribute float morphs;
            attribute vec3 target;
            uniform float morphing;
            uniform float perPixel;
            uniform float pixels;
            uniform float size;
            uniform float spin;
            uniform float time;
            uniform vec3 fade;
            varying float vAlpha;
            void main() {
                vAlpha = alpha;
                if (alpha <= 0.0) {
                    // out of the view
                    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
                    return;
                }
                // the morph: 3 s as it is, 1 s turning, 3 s as the other,
                // 1 s back, each copy at its own time
                float cycle = mod(time + heading * 1.3, 8.0);
                float m = morphing * morphs *
                    (smoothstep(3.0, 4.0, cycle) - smoothstep(7.0, 8.0, cycle));
                vec3 q = mix(position, target, m);
                // a glitch on the way, strongest half way
                float glitch = m * (1.0 - m) * 4.0;
                q.x += glitch * 1.5 * sin(time * 47.0 + q.y * 3.1);
                q.y += glitch * 1.0 * sin(time * 61.0 + q.x * 2.3);
                float a = heading + spin * time;
                float c = cos(a);
                float s = sin(a);
                vec3 p = vec3(
                    c * q.x + s * q.z,
                    q.y,
                    -s * q.x + c * q.z
                );
                float d = distance(cameraPosition, offset);
                float k = max(1.0, d * perPixel * pixels / size);
                vAlpha *= mix(1.0, fade.z, smoothstep(fade.x, fade.y, d));
                gl_Position = projectionMatrix * viewMatrix *
                    vec4(offset + p * k, 1.0);
            }`,
        fragmentShader: `
            uniform vec3 color;
            uniform float opacity;
            varying float vAlpha;
            void main() {
                gl_FragColor = vec4(color, opacity * vAlpha);
            }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const object = new THREE.LineSegments(geometry, material);
    object.frustumCulled = false;
    return { object, offsets, headings, alphas, morphs };
}

/** The turn round the vertical that heads +x along (dx, dz). */
export const heading = (dx: number, dz: number) => Math.atan2(-dz, dx);
