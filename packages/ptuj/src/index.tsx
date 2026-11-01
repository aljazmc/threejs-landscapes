import { createRoot } from "react-dom/client";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { loadMap, type MapData } from "./map";
import { buildMap, PALETTE } from "./layers";
import { Traffic } from "./traffic";
import { placeKey, Quarters } from "./quarters";
import { Bloom, Controls, createView, fit, type View } from "./view";

function Ptuj({
    map,
    view,
    labels,
    onHover,
    onSelect,
}: {
    map: MapData;
    view: View;
    labels: React.RefObject<Map<string, HTMLDivElement>>;
    onHover: (name: string | null) => void;
    onSelect: (name: string | null) => void;
}) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
    const dpr = useThree((state) => state.viewport.dpr);
    const scene = useMemo(() => buildMap(map, dpr), [map, dpr]);
    const traffic = useMemo(() => new Traffic(map, dpr), [map, dpr]);
    if (!view.overview) {
        const target = scene.bounds.getCenter(new THREE.Vector3());
        view.overview = {
            target,
            distance: fit(scene.bounds, camera.fov, camera.aspect),
            turn: true,
        };
    }
    useFrame((_, delta) => traffic.update(delta));
    return (
        <>
            <Controls view={view} />
            <Bloom />
            <primitive object={scene.group} />
            <primitive object={traffic.group} />
            <Quarters
                quarters={scene.quarters}
                places={scene.places}
                icons={scene.icons}
                view={view}
                labels={labels}
                onHover={onHover}
                onSelect={onSelect}
            />
        </>
    );
}

/**
 * Where the map comes from and under which license: the outline, places,
 * waters, roads, railway and land use are OpenStreetMap data, which the
 * Open Database License asks to credit wherever it is shown.
 */
function License() {
    const [open, setOpen] = useState(true);
    return (
        <div className={`license${open ? " open" : ""}`}>
            {open ? (
                <>
                    <p>
                        The map of Mestna občina Ptuj is drawn from{" "}
                        <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noreferrer"
                        >
                            OpenStreetMap
                        </a>{" "}
                        data: its outline, places, rivers, roads, railway, woods
                        and vineyards. The data is available under the{" "}
                        <a
                            href="https://opendatacommons.org/licenses/odbl/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Open Database License (ODbL)
                        </a>
                        . The borders of the quarters are approximate and the
                        traffic is simulated.
                    </p>
                    <button type="button" onClick={() => setOpen(false)}>
                        OK
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    className="credit"
                    onClick={() => setOpen(true)}
                >
                    Map data © OpenStreetMap contributors, ODbL
                </button>
            )}
        </div>
    );
}

const KINDS = { quarter: "mestna četrt", village: "naselje" };

function App() {
    const view = useMemo(createView, []);
    const labels = useRef(new Map<string, HTMLDivElement>());
    const [map, setMap] = useState<MapData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        loadMap().then(setMap, (reason: Error) => setError(reason.message));
    }, []);
    const back = useCallback(() => {
        view.selected = null;
        view.goal = view.overview;
        setSelected(null);
    }, [view]);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                back();
            }
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [back]);
    // the labels: the quarters by name, the places by their place in the
    // list, as their names may repeat
    const named = useMemo(
        () =>
            map
                ? [
                      ...map.quarters.map(({ name, kind }) => ({
                          key: name,
                          name,
                          kind: kind as string,
                      })),
                      ...[
                          ...map.landmarks.map(({ name }) => ({
                              name,
                              kind: "landmark",
                          })),
                          ...(map.pois ?? []).map(({ name, group }) => ({
                              name,
                              kind: group as string,
                          })),
                      ].map((place, k) => ({ key: placeKey(k), ...place })),
                  ]
                : [],
        [map],
    );
    const shown = map?.quarters.find(
        ({ name }) => name === (hovered ?? selected),
    );
    if (error) {
        return (
            <div className="message">
                <h1>Ptuj could not be loaded</h1>
                <p>{error}</p>
                <p>
                    Make the map from OpenStreetMap data first:
                    <code>packages/ptuj/inkscape-scripts/project.sh all</code>
                </p>
            </div>
        );
    }
    return (
        <>
            <div className="stage">
                {map && (
                    <Canvas
                        // sharp enough on dense screens without drawing
                        // every pixel
                        dpr={[1, 1.5]}
                        gl={{
                            powerPreference: "high-performance",
                            stencil: true,
                        }}
                        camera={{ fov: 45, near: 1, far: 60000 }}
                        style={{ cursor: hovered ? "pointer" : "grab" }}
                    >
                        <color attach="background" args={[PALETTE.sky]} />
                        <Ptuj
                            map={map}
                            view={view}
                            labels={labels}
                            onHover={setHovered}
                            onSelect={setSelected}
                        />
                    </Canvas>
                )}
                <div className="labels">
                    {named.map(({ key, name, kind }) => (
                        <div
                            key={key}
                            className={`label ${kind}`}
                            ref={(element) => {
                                if (element) {
                                    labels.current.set(key, element);
                                } else {
                                    labels.current.delete(key);
                                }
                            }}
                        >
                            {name}
                        </div>
                    ))}
                </div>
                <div className="title">
                    <h1>Ptuj</h1>
                    <p>
                        {shown
                            ? `${shown.name} · ${KINDS[shown.kind]}`
                            : "Mestna občina Ptuj"}
                    </p>
                    <p className="hint">
                        drag to move · right drag to turn and tilt · scroll to
                        zoom to the pointer · click a spot to center it, double
                        click to zoom in · Esc for the whole map
                    </p>
                </div>
                {selected && (
                    <button type="button" className="back" onClick={back}>
                        ← vsa občina
                    </button>
                )}
            </div>
            <License />
        </>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
