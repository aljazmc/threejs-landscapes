import { createRoot } from "react-dom/client";
import React, { Component, type ReactNode, Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useModels } from "./models";
import { layout, Town } from "./town";
import { Clouds, Rafts } from "./life";
import { Parade } from "./parade";

// in front of Dravski stolp, on the promenade (three.js has Y up, Z south)
const FOCUS: [number, number, number] = [78, 0, 25];

function Controls() {
    const camera = useThree((state) => state.camera);
    const element = useThree((state) => state.gl.domElement);
    const controls = React.useMemo(
        () => new OrbitControls(camera, element),
        [camera, element],
    );
    useEffect(() => {
        controls.target.set(...FOCUS);
        controls.enableDamping = true;
        controls.maxPolarAngle = 1.4;
        controls.minDistance = 15;
        controls.maxDistance = 750;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        const stop = () => {
            controls.autoRotate = false;
        };
        controls.addEventListener("start", stop);
        return () => {
            controls.removeEventListener("start", stop);
            controls.dispose();
        };
    }, [controls]);
    useFrame((_, delta) => controls.update(delta));
    return null;
}

function Sun() {
    const shadow = 360;
    return (
        <directionalLight
            position={[-220, 320, 180]}
            intensity={2.2}
            color="#fff4dc"
            castShadow
            shadow-mapSize={[4096, 4096]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.4}
            shadow-camera-left={-shadow}
            shadow-camera-right={shadow}
            shadow-camera-top={shadow}
            shadow-camera-bottom={-shadow}
            shadow-camera-near={10}
            shadow-camera-far={1200}
        />
    );
}

function Ptuj() {
    const models = useModels();
    const town = React.useMemo(() => layout(models), [models]);
    const parade = town.paths.get("parade");
    const widths = town.widths.get("parade");
    const river = town.paths.get("river");
    return (
        <>
            <Town town={town} />
            {parade && widths && river && (
                <Parade
                    models={models}
                    path={parade}
                    widths={widths}
                    river={river}
                    obstacles={town.obstacles}
                />
            )}
            {river && <Rafts models={models} path={river} />}
            <Clouds models={models} />
        </>
    );
}

class ModelsMissing extends Component<
    { children: ReactNode },
    { error?: Error }
> {
    state: { error?: Error } = {};

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <div className="message">
                    <h1>Ptuj could not be loaded</h1>
                    <p>{this.state.error.message}</p>
                    <p>
                        Build the models with Blender first:
                        <code>
                            packages/ptuj/blender-scripts/project.sh all glb
                        </code>
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}

createRoot(document.getElementById("root")!).render(
    <ModelsMissing>
        <Canvas
            shadows="percentage"
            camera={{ position: [263, 170, 245], fov: 45, near: 1, far: 3000 }}
        >
            <color attach="background" args={["#a8dcff"]} />
            <fog attach="fog" args={["#cdeaff", 700, 1600]} />
            <hemisphereLight args={["#d8efff", "#6f8f4f", 1.4]} />
            <Sun />
            <Controls />
            <Suspense fallback={null}>
                <Ptuj />
            </Suspense>
        </Canvas>
        <div className="title">
            <h1>Ptuj</h1>
            <p>drag to orbit · scroll to zoom</p>
        </div>
    </ModelsMissing>,
);
