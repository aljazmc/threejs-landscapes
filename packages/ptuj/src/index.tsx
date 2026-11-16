import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { buildMap, PALETTE } from "./layers";
import { banned, loadMap, type MapData, type PlaceInfo } from "./map";
import { WIRE } from "./models";
import { placeKey, Quarters } from "./quarters";
import { loadTerrain, Terrain, type TerrainData } from "./terrain";
import { Traffic } from "./traffic";
import { Bloom, Controls, createView, fit, type View } from "./view";

function Ptuj({
    map,
    terrain,
    view,
    labels,
    onHover,
    onSelect,
    onPoint,
}: {
    map: MapData;
    terrain: Terrain;
    view: View;
    labels: React.RefObject<Map<string, HTMLDivElement>>;
    onHover: (name: string | null) => void;
    onSelect: (name: string | null) => void;
    onPoint: (place: number | null, x: number, y: number) => void;
}) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
    const gl = useThree((state) => state.gl);
    const dpr = useThree((state) => state.viewport.dpr);
    // the areas' texture: some 4 m a pixel, less where a finger points,
    // as on phones
    const size = Math.min(
        gl.capabilities.maxTextureSize,
        window.matchMedia("(pointer: coarse)").matches ? 2048 : 4096,
    );
    const scene = useMemo(
        () => buildMap(map, terrain, dpr, size),
        [map, terrain, dpr, size],
    );
    useEffect(() => () => scene.ground.dispose(), [scene]);
    const traffic = useMemo(() => new Traffic(map, terrain), [map, terrain]);
    if (!view.overview) {
        const target = scene.bounds.getCenter(new THREE.Vector3());
        view.overview = {
            target,
            distance: fit(scene.bounds, camera.fov, camera.aspect),
            turn: true,
        };
    }
    const viewport = useThree((state) => state.size);
    useFrame(({ clock }, delta) => {
        // the wireframes' symbol size and spin
        WIRE.perPixel.value =
            (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
            Math.max(viewport.height, 1);
        WIRE.time.value = clock.elapsedTime;
        scene.ground.update(gl);
        traffic.update(delta);
    });
    return (
        <>
            <Controls view={view} terrain={terrain} />
            <Bloom />
            <primitive object={scene.group} />
            <primitive object={traffic.group} />
            <Quarters
                quarters={scene.quarters}
                places={scene.places}
                icons={scene.icons}
                terrain={terrain}
                view={view}
                labels={labels}
                onHover={onHover}
                onSelect={onSelect}
                onPoint={onPoint}
            />
        </>
    );
}

/**
 * Where the map comes from and under which license: the outline, places,
 * waters, roads, railway and land use are OpenStreetMap data, which the
 * Open Database License asks to credit wherever it is shown.
 */
function License({ listed }: { listed: string | undefined }) {
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
                        . The heights of the ground, raised twice, are from{" "}
                        <a
                            href="https://registry.opendata.aws/terrain-tiles/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Mapzen Terrain Tiles
                        </a>
                        : Europe terrain data produced using Copernicus data and
                        information funded by the European Union - EU-DEM
                        layers; SRTM and GMTED2010 terrain data courtesy of the
                        U.S. Geological Survey.
                        {listed && (
                            <>
                                {" "}
                                The bans on employing foreigners are from the{" "}
                                <a
                                    href="https://www.ess.gov.si/delodajalci/zaposlovanje-tujcev/"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    list of the Employment Service of Slovenia
                                </a>{" "}
                                of {date(listed)}, matched to the places by
                                their address and name.
                            </>
                        )}{" "}
                        The borders of the quarters are approximate and the
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

/** The kinds of places, by their icons, in Slovene. */
const PLACE_KINDS: Record<string, string> = {
    museum: "muzej",
    office: "urad",
    church: "cerkev",
    tower: "stolp",
    monument: "spomenik",
    monastery: "samostan",
    restaurant: "restavracija",
    stadium: "stadion",
    station: "železniška postaja",
    hospital: "bolnišnica",
    clinic: "ambulanta",
    pharmacy: "lekarna",
    police: "policija",
    fire: "gasilski dom",
    court: "sodišče",
    post: "pošta",
    library: "knjižnica",
    theatre: "gledališče",
    community: "dom krajanov, kulturni center",
    school: "šola",
    kindergarten: "vrtec",
    bar: "bar",
    cafe: "kavarna",
};

/** yyyy-mm-dd as a Slovene date, d. m. yyyy. */
function date(day: string) {
    const [y, m, d] = day.split("-").map(Number);
    return `${d}. ${m}. ${y}`;
}

/**
 * What is known of the place pointed at, beside the pointer: its name and
 * kind, address, operator, opening hours, phone and website, and for an
 * employer banned from employing foreigners, a note of until when.
 */
function PlaceCard({
    place,
    x,
    y,
}: {
    place: {
        name: string;
        icon: string;
        landmark: boolean;
        info?: PlaceInfo;
        ban?: string;
    };
    x: number;
    y: number;
}) {
    const info = place.info ?? {};
    const kind = PLACE_KINDS[place.icon] ?? "";
    const rows: [string, string | undefined][] = [
        ["naslov", info.address],
        ["upravlja", info.operator !== place.name ? info.operator : undefined],
        ["odprto", info.hours],
        ["telefon", info.phone],
        ["splet", info.website?.replace(/^https?:\/\/(www\.)?/, "")],
    ];
    // beside the pointer, kept inside the window
    const left = Math.min(x + 18, window.innerWidth - 340);
    const top = Math.min(y + 18, window.innerHeight - 220);
    return (
        <div className="card" style={{ left, top }}>
            <h2>{place.name}</h2>
            <p className="kind">
                {place.landmark ? `znamenitost · ${kind}` : kind}
            </p>
            <dl>
                {rows
                    .filter((row): row is [string, string] => !!row[1])
                    .map(([label, value]) => (
                        <React.Fragment key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                        </React.Fragment>
                    ))}
            </dl>
            {place.ban && (
                <p className={`ban${banned(place.ban) ? " active" : ""}`}>
                    ☠ Prepoved zaposlovanja tujcev do {date(place.ban)}
                </p>
            )}
        </div>
    );
}

function App() {
    const view = useMemo(createView, []);
    const labels = useRef(new Map<string, HTMLDivElement>());
    const [map, setMap] = useState<MapData | null>(null);
    const [terrain, setTerrain] = useState<Terrain | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [pointed, setPointed] =
        useState<{
            place: number;
            x: number;
            y: number;
        } | null>(null);
    const point = useCallback(
        (place: number | null, x: number, y: number) =>
            setPointed(place === null ? null : { place, x, y }),
        [],
    );
    // the places with icons, in the order of the map's scene
    const placeList = useMemo(
        () =>
            map
                ? [
                      ...map.landmarks.map(({ name, icon }) => ({
                          name,
                          icon,
                          landmark: true,
                      })),
                      ...(map.pois ?? []).map(({ name, icon, info, ban }) => ({
                          name,
                          icon,
                          landmark: false,
                          ...(info ? { info } : {}),
                          ...(ban ? { ban } : {}),
                      })),
                  ]
                : [],
        [map],
    );
    const card = pointed ? placeList[pointed.place] : undefined;
    useEffect(() => {
        Promise.all([
            loadMap(),
            loadTerrain().catch((reason: Error): TerrainData | null => {
                console.warn(reason.message);
                return null;
            }),
        ]).then(
            ([data, ground]) => {
                setTerrain(new Terrain(ground));
                setMap(data);
            },
            (reason: Error) => setError(reason.message),
        );
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
                {map && terrain && (
                    <Canvas
                        // sharp enough on dense screens without drawing
                        // every pixel
                        dpr={[1, 1.5]}
                        gl={{
                            powerPreference: "high-performance",
                            stencil: true,
                        }}
                        camera={{ fov: 45, near: 1, far: 60000 }}
                        style={{
                            cursor: hovered || pointed ? "pointer" : "grab",
                        }}
                    >
                        <color attach="background" args={[PALETTE.sky]} />
                        <Ptuj
                            map={map}
                            terrain={terrain}
                            view={view}
                            labels={labels}
                            onHover={setHovered}
                            onSelect={setSelected}
                            onPoint={point}
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
                        click a spot to look at it, scroll to zoom to it · drag
                        to look around · right drag to move · W A S D to walk, E
                        Q up and down, Shift faster · double click to fly nearer
                        · point at an icon for what is known of it · Esc for the
                        whole map
                    </p>
                </div>
                {selected && (
                    <button type="button" className="back" onClick={back}>
                        ← vsa občina
                    </button>
                )}
                {card && pointed && (
                    <PlaceCard place={card} x={pointed.x} y={pointed.y} />
                )}
            </div>
            <License listed={map?.bans?.listed} />
        </>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
