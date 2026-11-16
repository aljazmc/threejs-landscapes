import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { Terrain } from "./terrain";

// how the camera looks down at the map at first: from the south, tilted
const VIEW = new THREE.Vector3(0, Math.cos(0.45), Math.sin(0.45));
const EYE = 2; // meters: the lowest the camera comes above the ground
const LOOK_UP = 1.2; // radians above the horizon
const LOOK_DOWN = -Math.PI / 2 + 0.001; // straight down
const ZOOM = 0.0015; // per pixel of the wheel
const CLOSEST = 8; // meters: as near as zooming comes to a point
const WALK = 1; // the height above the ground walked a second
const SLOWEST = 10; // meters a second
const KEYS = {
    forward: ["KeyW", "ArrowUp"],
    back: ["KeyS", "ArrowDown"],
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
    up: ["KeyE", "PageUp"],
    down: ["KeyQ", "PageDown"],
};
const MOVING = new Set(Object.values(KEYS).flat());

export interface Goal {
    target: THREE.Vector3;
    distance: number;
    /** Whether to turn to look down at it from VIEW on the way. */
    turn?: boolean;
}

/** Where the camera looks and flies to, shared by the parts of the scene. */
export interface View {
    /** The point of the ground in the middle of the view. */
    focus: THREE.Vector3;
    /** How far the camera is from it, or would be, looking at the sky. */
    distance: number;
    goal: Goal | null;
    overview: Goal | null;
    selected: string | null;
}

export function createView(): View {
    return {
        focus: new THREE.Vector3(),
        distance: 1000,
        goal: null,
        overview: null,
        selected: null,
    };
}

/** How far to stand back to see a box whole. */
export function fit(bounds: THREE.Box3, fov: number, aspect: number) {
    const size = bounds.getSize(new THREE.Vector3());
    const half = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    return Math.max(size.z / 2 / half, size.x / 2 / (half * aspect)) * 1.1;
}

/** The difference of two angles, between -PI and PI. */
const turn = (from: number, to: number) =>
    THREE.MathUtils.euclideanModulo(to - from + Math.PI, 2 * Math.PI) - Math.PI;

/**
 * Moving over the map as in a first person game: the camera turns where
 * it stands, held by yaw (round the vertical) and pitch (up and down).
 * Dragging with the left button (or one finger) looks around, the right
 * or middle button (or two fingers) drags the ground along, the wheel (or
 * pinching) comes nearer to or goes away from the point of the ground in
 * the middle of the view, W A S D or the arrows walk, E and Q rise and
 * sink, Shift hurries; flights to a goal ease the camera there.
 */
class FirstPerson {
    private yaw = 0;
    private pitch = 0;
    /** Pixels of the wheel still to zoom by, eased over a few frames. */
    private zoom = 0;
    private readonly keys = new Set<string>();
    private readonly pointers = new Map<number, THREE.Vector2>();
    private mode: "look" | "pan" | "pinch" | null = null;
    /** The point of the ground held under the pointer while panning. */
    private readonly grab = new THREE.Vector3();
    private pinch = 0;
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private readonly plane = new THREE.Plane();
    private readonly hit = new THREE.Vector3();
    private readonly target = new THREE.Vector3();
    private readonly offset = new THREE.Vector3();

    constructor(
        private readonly camera: THREE.PerspectiveCamera,
        private readonly element: HTMLElement,
        private readonly terrain: Terrain,
        private readonly view: View,
    ) {
        camera.rotation.order = "YXZ";
    }

    /** Stands back from a goal along VIEW, looking at it. */
    place(goal: Goal) {
        this.camera.position
            .copy(VIEW)
            .multiplyScalar(goal.distance)
            .add(goal.target);
        this.turnTo(goal.target, 1);
    }

    /** Turns (by a share, 1 for all the way) to look at a point. */
    private turnTo(point: THREE.Vector3, share: number) {
        const d = this.offset.subVectors(point, this.camera.position);
        const yaw = Math.atan2(-d.x, -d.z);
        const pitch = THREE.MathUtils.clamp(
            Math.atan2(d.y, Math.hypot(d.x, d.z)),
            LOOK_DOWN,
            LOOK_UP,
        );
        this.yaw += turn(this.yaw, yaw) * share;
        this.pitch += (pitch - this.pitch) * share;
        return Math.max(
            Math.abs(turn(this.yaw, yaw)),
            Math.abs(pitch - this.pitch),
        );
    }

    /** The point of the ground at a place of the screen, or null. */
    private ground(x: number, y: number, out: THREE.Vector3) {
        const rect = this.element.getBoundingClientRect();
        this.pointer.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            -((y - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.terrain.raycast(this.raycaster.ray, out);
    }

    /** The point of the ground in the middle of the view, or null. */
    private middle(out: THREE.Vector3) {
        this.pointer.set(0, 0);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.terrain.raycast(this.raycaster.ray, out);
    }

    /** Moves the camera so the grabbed point is under the pointer again. */
    private panTo(x: number, y: number) {
        const rect = this.element.getBoundingClientRect();
        this.pointer.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            -((y - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const ray = this.raycaster.ray;
        // near the horizon a little move of the pointer is kilometers
        if (ray.direction.y > -0.03) {
            return;
        }
        this.plane.set(new THREE.Vector3(0, 1, 0), -this.grab.y);
        const point = ray.intersectPlane(this.plane, this.hit);
        if (point) {
            this.camera.position.x += this.grab.x - point.x;
            this.camera.position.z += this.grab.z - point.z;
            this.camera.updateMatrixWorld();
        }
    }

    /**
     * Comes nearer to a point by a factor of the distance (or goes away
     * from it, over 1); without one, walks forward as far.
     */
    private dolly(point: THREE.Vector3 | null, factor: number) {
        const position = this.camera.position;
        if (point) {
            const offset = this.offset.subVectors(position, point);
            const distance = offset.length();
            const wanted = Math.max(distance * factor, CLOSEST);
            if (factor < 1 && distance <= CLOSEST) {
                return;
            }
            position.copy(point).addScaledVector(offset, wanted / distance);
        } else {
            const height =
                position.y - this.terrain.under(position.x, position.z);
            const forward = this.camera.getWorldDirection(this.offset);
            position.addScaledVector(
                forward,
                (1 - factor) * Math.max(height, 20) * 3,
            );
        }
    }

    private readonly down = (event: PointerEvent) => {
        this.element.setPointerCapture(event.pointerId);
        this.pointers.set(
            event.pointerId,
            new THREE.Vector2(event.clientX, event.clientY),
        );
        this.view.goal = null;
        if (event.pointerType === "touch") {
            this.touches();
        } else if (event.button === 0) {
            this.mode = "look";
        } else if (this.ground(event.clientX, event.clientY, this.grab)) {
            this.mode = "pan";
        } else {
            this.mode = null;
        }
    };

    /** One finger looks around, two pinch and drag the ground. */
    private touches() {
        const [a, b] = [...this.pointers.values()];
        if (a && b) {
            const x = (a.x + b.x) / 2;
            const y = (a.y + b.y) / 2;
            this.pinch = a.distanceTo(b);
            this.mode = this.ground(x, y, this.grab) ? "pinch" : null;
        } else {
            this.mode = a ? "look" : null;
        }
    }

    private readonly move = (event: PointerEvent) => {
        const last = this.pointers.get(event.pointerId);
        if (!last) {
            return;
        }
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        last.set(event.clientX, event.clientY);
        if (this.mode === "look") {
            // a drag across the view turns by about the view's angle
            const rate =
                THREE.MathUtils.degToRad(this.camera.fov) /
                Math.max(this.element.clientHeight, 1);
            this.yaw -= dx * rate;
            this.pitch = THREE.MathUtils.clamp(
                this.pitch - dy * rate,
                LOOK_DOWN,
                LOOK_UP,
            );
        } else if (this.mode === "pan") {
            this.panTo(event.clientX, event.clientY);
        } else if (this.mode === "pinch") {
            const [a, b] = [...this.pointers.values()];
            if (a && b) {
                const spread = a.distanceTo(b);
                this.dolly(this.grab, this.pinch / Math.max(spread, 1));
                this.pinch = spread;
                this.camera.updateMatrixWorld();
                this.panTo((a.x + b.x) / 2, (a.y + b.y) / 2);
            }
        }
    };

    private readonly up = (event: PointerEvent) => {
        if (this.element.hasPointerCapture(event.pointerId)) {
            this.element.releasePointerCapture(event.pointerId);
        }
        this.pointers.delete(event.pointerId);
        if (event.pointerType === "touch") {
            this.touches();
        } else {
            this.mode = null;
        }
    };

    private readonly wheel = (event: WheelEvent) => {
        event.preventDefault();
        const scale =
            event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
        this.zoom += event.deltaY * scale;
        this.view.goal = null;
    };

    private readonly press = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement) {
            return;
        }
        if (MOVING.has(event.code)) {
            this.keys.add(event.code);
            this.view.goal = null;
            event.preventDefault();
        }
        if (event.key === "Shift") {
            this.keys.add("Shift");
        }
    };

    private readonly release = (event: KeyboardEvent) => {
        this.keys.delete(event.code);
        if (event.key === "Shift") {
            this.keys.delete("Shift");
        }
    };

    private readonly blur = () => this.keys.clear();

    attach() {
        const element = this.element;
        element.style.touchAction = "none";
        element.addEventListener("pointerdown", this.down);
        element.addEventListener("pointermove", this.move);
        element.addEventListener("pointerup", this.up);
        element.addEventListener("pointercancel", this.up);
        element.addEventListener("wheel", this.wheel, { passive: false });
        window.addEventListener("keydown", this.press);
        window.addEventListener("keyup", this.release);
        window.addEventListener("blur", this.blur);
        return () => {
            element.removeEventListener("pointerdown", this.down);
            element.removeEventListener("pointermove", this.move);
            element.removeEventListener("pointerup", this.up);
            element.removeEventListener("pointercancel", this.up);
            element.removeEventListener("wheel", this.wheel);
            window.removeEventListener("keydown", this.press);
            window.removeEventListener("keyup", this.release);
            window.removeEventListener("blur", this.blur);
        };
    }

    private held(keys: string[]) {
        return keys.some((key) => this.keys.has(key)) ? 1 : 0;
    }

    update(delta: number) {
        const camera = this.camera;
        const position = camera.position;
        const terrain = this.terrain;
        const view = this.view;

        // the wheel, eased
        if (this.zoom !== 0) {
            const amount = this.zoom * (1 - Math.exp(-delta * 12));
            this.zoom =
                Math.abs(this.zoom - amount) < 0.5 ? 0 : this.zoom - amount;
            this.dolly(this.middle(this.target), Math.exp(amount * ZOOM));
        }

        // walking, at a pace that grows with the height above the ground
        const forward = this.held(KEYS.forward) - this.held(KEYS.back);
        const right = this.held(KEYS.right) - this.held(KEYS.left);
        const rise = this.held(KEYS.up) - this.held(KEYS.down);
        if (forward || right || rise) {
            const height = position.y - terrain.under(position.x, position.z);
            const speed =
                Math.max(height * WALK, SLOWEST) *
                (this.keys.has("Shift") ? 3 : 1) *
                delta;
            const sin = Math.sin(this.yaw);
            const cos = Math.cos(this.yaw);
            position.x += (-sin * forward + cos * right) * speed;
            position.z += (-cos * forward - sin * right) * speed;
            position.y += rise * speed;
        }

        // a flight to a goal: there and looking at it, easing out
        const goal = view.goal;
        if (goal) {
            const wanted = goal.turn
                ? this.target.copy(VIEW)
                : this.target.subVectors(position, goal.target).normalize();
            wanted.multiplyScalar(goal.distance).add(goal.target);
            position.lerp(wanted, 1 - Math.exp(-delta * 2.2));
            const left = this.turnTo(goal.target, 1 - Math.exp(-delta * 4));
            if (
                position.distanceTo(wanted) <
                    Math.max(0.5, goal.distance * 0.003) &&
                left < 0.002
            ) {
                view.goal = null;
            }
        }

        // above the ground, below the overview, not far off the map
        const overview = view.overview;
        if (overview) {
            const reach = overview.distance * 1.5;
            position.x = THREE.MathUtils.clamp(
                position.x,
                overview.target.x - reach,
                overview.target.x + reach,
            );
            position.z = THREE.MathUtils.clamp(
                position.z,
                overview.target.z - reach,
                overview.target.z + reach,
            );
            position.y = Math.min(position.y, overview.distance * 1.8);
        }
        const ground = terrain.under(position.x, position.z);
        position.y = Math.max(position.y, ground + EYE);
        camera.rotation.set(this.pitch, this.yaw, 0);
        camera.updateMatrixWorld();

        // what is looked at, and how near the camera may see
        const height = position.y - ground;
        const point = this.middle(view.focus);
        view.distance = point
            ? Math.min(position.distanceTo(point), height * 5)
            : height * 5;
        if (!point) {
            camera.getWorldDirection(this.offset);
            view.focus
                .copy(position)
                .addScaledVector(this.offset, view.distance);
        }
        const near = THREE.MathUtils.clamp(height * 0.5, 1, 50);
        const far = Math.max(view.distance * 20 + 5000, 60000);
        if (camera.near !== near || camera.far !== far) {
            camera.near = near;
            camera.far = far;
            camera.updateProjectionMatrix();
        }
    }
}

/** The camera's controls, see FirstPerson. */
export function Controls({ view, terrain }: { view: View; terrain: Terrain }) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
    const element = useThree((state) => state.gl.domElement);
    const controls = useMemo(
        () => new FirstPerson(camera, element, terrain, view),
        [camera, element, terrain, view],
    );
    useEffect(() => {
        controls.place(view.overview!);
        return controls.attach();
    }, [controls, view]);
    useFrame((_, delta) => controls.update(Math.min(delta, 0.1)));
    return null;
}

/**
 * Draws the scene through a bloom pass, which makes the bright lines and
 * the traffic glow like neon; the render target keeps a stencil, which
 * holds the map's fills to the land of the municipality.
 */
export function Bloom() {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const size = useThree((state) => state.size);
    const { composer, bloom } = useMemo(() => {
        const target = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
            stencilBuffer: true,
        });
        const composer = new EffectComposer(gl, target);
        composer.addPass(new RenderPass(scene, camera));
        // a faint, tight glow round only the brightest lines and the traffic
        const bloom = new UnrealBloomPass(
            new THREE.Vector2(1, 1),
            0.3,
            0.15,
            0.6,
        );
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
        return { composer, bloom };
    }, [gl, scene, camera]);
    useEffect(() => {
        composer.setPixelRatio(gl.getPixelRatio());
        composer.setSize(size.width, size.height);
        bloom.resolution.set(size.width, size.height);
    }, [composer, bloom, gl, size]);
    useEffect(() => () => composer.dispose(), [composer]);
    // a priority above zero takes the drawing over from react-three-fiber
    useFrame(() => composer.render(), 1);
    return null;
}
