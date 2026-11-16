import * as THREE from "three";
import { LIFT, type Terrain } from "./terrain";

/**
 * The filled areas of the map laid over the low poly hills, which a light
 * shades face by face: the areas are drawn flat,
 * from straight above, into a texture of the whole grid of the terrain,
 * which covers its surface. The land, woods, vineyards, parks and waters
 * are drawn once; the veils over the quarters change, so they go into a
 * second texture on a copy of the surface a little above the lines and
 * icons, drawn again whenever a veil changes.
 */
export class Ground {
    /** The surface of the ground and the veils, to add to the scene. */
    readonly group = new THREE.Group();
    /** The flat areas, drawn into the textures; add meshes to these. */
    readonly areas = new THREE.Scene();
    readonly veils = new THREE.Scene();
    private readonly camera: THREE.OrthographicCamera;
    private readonly surface: THREE.WebGLRenderTarget;
    private readonly veiling: THREE.WebGLRenderTarget;
    private readonly veil: THREE.Mesh;
    private drawn = false;
    private state = "";

    constructor(
        terrain: Terrain,
        background: string,
        shade: string,
        order: { ground: number; veil: number },
        size: number,
    ) {
        const extent = terrain.extent;
        const across = extent.getSize(new THREE.Vector2());
        // the camera looks down at the map with north up, its view the
        // extent of the grid
        this.camera = new THREE.OrthographicCamera(
            extent.min.x,
            extent.max.x,
            extent.max.y,
            extent.min.y,
            1,
            10000,
        );
        this.camera.position.set(0, 5000, 0);
        this.camera.up.set(0, 0, -1);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld();
        const width = size;
        const height = Math.round((size * across.y) / across.x);
        const options = {
            colorSpace: THREE.SRGBColorSpace,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            anisotropy: 8,
            samples: 4,
        };
        // the land marks the stencil to keep the areas on it inside
        this.surface = new THREE.WebGLRenderTarget(width, height, {
            ...options,
            stencilBuffer: true,
        });
        this.veiling = new THREE.WebGLRenderTarget(
            width / 2,
            height / 2,
            options,
        );
        this.areas.background = new THREE.Color(background);

        const geometry = terrain.geometry();
        const ground = new THREE.Mesh(
            geometry,
            new THREE.MeshLambertMaterial({
                // the areas shine on their own; the light only shades the
                // flat faces a little, for the low poly look
                color: shade,
                emissive: 0xffffff,
                emissiveMap: this.surface.texture,
                flatShading: true,
                // behind the lines lying on it, wherever it is seen from
                polygonOffset: true,
                polygonOffsetFactor: 2,
                polygonOffsetUnits: 2,
            }),
        );
        ground.renderOrder = order.ground;
        this.veil = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
                map: this.veiling.texture,
                transparent: true,
                // the veils are drawn over nothing, so their colors are
                // already multiplied by their opacity
                premultipliedAlpha: true,
                depthWrite: false,
            }),
        );
        this.veil.position.y = LIFT.veil;
        this.veil.renderOrder = order.veil;
        this.veil.visible = false;
        this.group.add(ground, this.veil);
    }

    /** Draws the textures that are not up to date, before the frame. */
    update(renderer: THREE.WebGLRenderer) {
        const state = this.veilState();
        if (this.drawn && state === this.state) {
            return;
        }
        const target = renderer.getRenderTarget();
        const clear = renderer.getClearColor(new THREE.Color());
        const alpha = renderer.getClearAlpha();
        if (!this.drawn) {
            renderer.setRenderTarget(this.surface);
            renderer.render(this.areas, this.camera);
            this.drawn = true;
        }
        if (state !== this.state) {
            this.state = state;
            this.veil.visible = state !== "";
            renderer.setRenderTarget(this.veiling);
            renderer.setClearColor(0x000000, 0);
            renderer.clear();
            renderer.render(this.veils, this.camera);
        }
        renderer.setClearColor(clear, alpha);
        renderer.setRenderTarget(target);
    }

    /** What the veils look like now: empty when none shows. */
    private veilState() {
        let state = "";
        for (const child of this.veils.children) {
            const mesh = child as THREE.Mesh<
                THREE.BufferGeometry,
                THREE.MeshBasicMaterial
            >;
            if (mesh.visible && mesh.material.opacity > 0.005) {
                state += `${mesh.id}:${mesh.material.opacity.toFixed(3)}:${mesh.material.color.getHexString()};`;
            }
        }
        return state;
    }

    dispose() {
        this.surface.dispose();
        this.veiling.dispose();
        this.group.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                object.material.dispose();
            }
        });
    }
}
