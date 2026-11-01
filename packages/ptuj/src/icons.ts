import * as THREE from "three";

// pixels of each icon in the atlas, and on the screen
const CELL = 128;
export const ICON_PIXELS = 22;

export interface IconPlace {
    at: THREE.Vector3;
    icon: string;
    color: string;
}

/**
 * The icons of all the places on the map in one draw call: the SVG icons
 * (drawn for Inkscape in src/icons) are drawn into one atlas texture, and
 * every place is a point that shows its cell of it, tinted, as many pixels
 * wide at any zoom. Any place can be hidden, to keep icons from crowding.
 */
export class Icons {
    readonly points: THREE.Points;
    private readonly alphas: THREE.BufferAttribute;
    private readonly visible: Uint8Array;

    constructor(places: IconPlace[], dpr: number, order: number) {
        const names = [...new Set(places.map(({ icon }) => icon))];
        const columns = Math.ceil(Math.sqrt(names.length));
        const rows = Math.ceil(names.length / columns);
        const canvas = document.createElement("canvas");
        canvas.width = columns * CELL;
        canvas.height = rows * CELL;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const context = canvas.getContext("2d");
        names.forEach((name, k) => {
            const image = new Image(CELL, CELL);
            image.onload = () => {
                context?.drawImage(
                    image,
                    (k % columns) * CELL,
                    Math.floor(k / columns) * CELL,
                    CELL,
                    CELL,
                );
                texture.needsUpdate = true;
            };
            image.src = `icons/${name}.svg`;
        });

        const count = places.length;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const cells = new Float32Array(count * 2);
        const color = new THREE.Color();
        places.forEach(({ at, icon, color: tint }, k) => {
            at.toArray(positions, k * 3);
            color.set(tint).toArray(colors, k * 3);
            const index = names.indexOf(icon);
            cells[k * 2] = index % columns;
            cells[k * 2 + 1] = Math.floor(index / columns);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
        );
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("cell", new THREE.BufferAttribute(cells, 2));
        this.alphas = new THREE.BufferAttribute(
            new Float32Array(count).fill(1),
            1,
        );
        this.alphas.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("alpha", this.alphas);
        this.visible = new Uint8Array(count).fill(1);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                atlas: { value: texture },
                grid: { value: new THREE.Vector2(columns, rows) },
                size: { value: ICON_PIXELS * dpr },
            },
            vertexShader: `
                attribute vec3 color;
                attribute vec2 cell;
                attribute float alpha;
                uniform float size;
                varying vec3 vColor;
                varying vec2 vCell;
                varying float vAlpha;
                void main() {
                    vColor = color;
                    vCell = cell;
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix *
                        vec4(position, 1.0);
                    gl_PointSize = alpha > 0.0 ? size : 0.0;
                }`,
            fragmentShader: `
                uniform sampler2D atlas;
                uniform vec2 grid;
                varying vec3 vColor;
                varying vec2 vCell;
                varying float vAlpha;
                void main() {
                    // the atlas is flipped: its first row is at the top
                    vec2 uv = vec2(
                        (vCell.x + gl_PointCoord.x) / grid.x,
                        1.0 - (vCell.y + gl_PointCoord.y) / grid.y
                    );
                    float a = texture2D(atlas, uv).a * vAlpha;
                    if (a < 0.02) discard;
                    gl_FragColor = vec4(vColor, a);
                }`,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.points.renderOrder = order;
    }

    /** Shows or hides the icon of a place. */
    show(index: number, shown: boolean) {
        const value = shown ? 1 : 0;
        if (this.visible[index] !== value) {
            this.visible[index] = value;
            this.alphas.setX(index, value);
            this.alphas.needsUpdate = true;
        }
    }
}
