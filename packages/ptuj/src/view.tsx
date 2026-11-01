import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MOUSE, TOUCH } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// how the camera looks down at the map at first: from the south, tilted
const VIEW = new THREE.Vector3(0, Math.cos(0.45), Math.sin(0.45));
const MAX_TILT = 1.15; // radians from looking straight down

export interface Goal {
    target: THREE.Vector3;
    distance: number;
    /** Whether to turn to look down at it from VIEW on the way. */
    turn?: boolean;
}

/** Where the camera looks and flies to, shared by the parts of the scene. */
export interface View {
    focus: THREE.Vector3;
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

/**
 * Moving over the map: dragging pans it, the right button (or two fingers)
 * turns and tilts it, the wheel zooms to the pointer, and flights to a
 * goal ease the camera there. Only the user moves the camera.
 */
export function Controls({ view }: { view: View }) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
    const element = useThree((state) => state.gl.domElement);
    const controls = useMemo(
        () => new OrbitControls(camera, element),
        [camera, element],
    );
    useEffect(() => {
        const start = view.overview!;
        controls.target.copy(start.target);
        camera.position
            .copy(VIEW)
            .multiplyScalar(start.distance)
            .add(start.target);
        controls.mouseButtons = {
            LEFT: MOUSE.PAN,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.ROTATE,
        };
        controls.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
        // pan over the ground, not across the screen
        controls.screenSpacePanning = false;
        controls.enableDamping = true;
        controls.maxPolarAngle = MAX_TILT;
        controls.minDistance = 40;
        controls.maxDistance = start.distance * 1.8;
        controls.zoomSpeed = 1.4;
        controls.zoomToCursor = true;
        const stop = () => {
            view.goal = null;
        };
        controls.addEventListener("start", stop);
        return () => {
            controls.removeEventListener("start", stop);
            controls.dispose();
        };
    }, [controls, camera, view]);

    const offset = useMemo(() => new THREE.Vector3(), []);
    useFrame((_, delta) => {
        const goal = view.goal;
        if (goal) {
            // fly there, easing out, maybe turning to look down at it
            const k = 1 - Math.exp(-delta * 2.2);
            offset.subVectors(camera.position, controls.target);
            const distance = offset.length();
            offset.normalize();
            if (goal.turn) {
                offset.lerp(VIEW, k * 0.5).normalize();
            }
            controls.target.lerp(goal.target, k);
            camera.position
                .copy(offset)
                .multiplyScalar(distance + (goal.distance - distance) * k)
                .add(controls.target);
            if (
                controls.target.distanceTo(goal.target) < 0.5 &&
                Math.abs(distance / goal.distance - 1) < 0.005
            ) {
                view.goal = null;
            }
        }
        controls.update(delta);
        view.focus.copy(controls.target);
        view.distance = camera.position.distanceTo(controls.target);
        const near = THREE.MathUtils.clamp(view.distance / 500, 0.5, 50);
        const far = view.distance * 20 + 5000;
        if (camera.near !== near || camera.far !== far) {
            camera.near = near;
            camera.far = far;
            camera.updateProjectionMatrix();
        }
    });
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
