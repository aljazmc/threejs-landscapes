import * as THREE from "three";
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { inPolygon } from "./map";
import { ICON_PIXELS, type Icons } from "./icons";
import { ORDER, PALETTE, type Place, type Quarter } from "./layers";
import type { View } from "./view";

// below these distances of the camera the landmarks and the other places
// are named, above this one the quarters and villages
const LANDMARK_NAMES = 2600;
const PLACE_NAMES = 1200;
const QUARTER_NAMES = 2000;
// how tall a name stands over its icon, and how wide a letter is, in
// pixels, to keep the names from covering each other
const NAME_HEIGHT = 14;
const LETTER = 6.6;

/** The key of the label of a place, as its name may not be unique. */
export const placeKey = (index: number) => `place-${index}`;

/** The quarter or village a point of the map lies in. */
export function quarterAt(quarters: Quarter[], x: number, y: number) {
    return quarters.find(
        (quarter) =>
            quarter.box.containsPoint(new THREE.Vector2(x, y)) &&
            quarter.shapes.some((shape) => inPolygon(x, y, shape)),
    );
}

/**
 * The quarters and villages under the pointer: their borders light up when
 * pointed at and stay lit when chosen. A click turns the view round the
 * point clicked, a double click also zooms in on it. Their names float over
 * the map, and so do the icons of the places, the more important ones
 * first, leaving out those that would cover them, and near enough, the
 * places' names.
 */
export function Quarters({
    quarters,
    places,
    icons,
    view,
    labels,
    onHover,
    onSelect,
}: {
    quarters: Quarter[];
    places: Place[];
    icons: Icons;
    view: View;
    labels: React.RefObject<Map<string, HTMLDivElement>>;
    onHover: (name: string | null) => void;
    onSelect: (name: string | null) => void;
}) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
    const element = useThree((state) => state.gl.domElement);
    const size = useThree((state) => state.size);
    const hovered = useRef<string | null>(null);

    useEffect(() => {
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const pick = (event: MouseEvent) => {
            const rect = element.getBoundingClientRect();
            pointer.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );
            raycaster.setFromCamera(pointer, camera);
            const point = raycaster.ray.intersectPlane(
                plane,
                new THREE.Vector3(),
            );
            if (!point) {
                return null;
            }
            const quarter = quarterAt(quarters, point.x, -point.z);
            return quarter ? { point, quarter } : null;
        };
        const focus = (event: MouseEvent, closer: number) => {
            const hit = pick(event);
            if (!hit) {
                return;
            }
            view.selected = hit.quarter.name;
            view.goal = {
                target: hit.point,
                distance: Math.max(view.distance * closer, 60),
            };
            onSelect(hit.quarter.name);
        };
        let pending: PointerEvent | null = null;
        const move = (event: PointerEvent) => {
            if (!pending) {
                requestAnimationFrame(() => {
                    const hit = pending ? pick(pending) : null;
                    const name = hit ? hit.quarter.name : null;
                    pending = null;
                    if (name !== hovered.current) {
                        hovered.current = name;
                        onHover(name);
                    }
                });
            }
            pending = event;
        };
        let down: { x: number; y: number } | null = null;
        const press = (event: PointerEvent) => {
            down =
                event.button === 0
                    ? { x: event.clientX, y: event.clientY }
                    : null;
        };
        const release = (event: PointerEvent) => {
            if (
                down &&
                Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 5
            ) {
                focus(event, 1);
            }
        };
        const double = (event: MouseEvent) => focus(event, 1 / 3);
        const leave = () => {
            hovered.current = null;
            onHover(null);
        };
        const menu = (event: MouseEvent) => event.preventDefault();
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerdown", press);
        element.addEventListener("pointerup", release);
        element.addEventListener("pointerleave", leave);
        element.addEventListener("dblclick", double);
        element.addEventListener("contextmenu", menu);
        return () => {
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerdown", press);
            element.removeEventListener("pointerup", release);
            element.removeEventListener("pointerleave", leave);
            element.removeEventListener("dblclick", double);
            element.removeEventListener("contextmenu", menu);
        };
    }, [camera, element, quarters, view, onHover, onSelect]);

    const projected = useMemo(() => new THREE.Vector3(), []);
    const written = useMemo(() => new Map<string, string>(), []);
    const place = (name: string, at: THREE.Vector3, opacity: number) => {
        const label = labels.current?.get(name);
        if (!label) {
            return;
        }
        let style = "0";
        if (opacity > 0.01) {
            projected.copy(at).project(camera);
            if (projected.z < 1 && Math.abs(projected.x) < 1.2) {
                const x = Math.round(((projected.x + 1) / 2) * size.width);
                const y = Math.round(((1 - projected.y) / 2) * size.height);
                style = `${opacity.toFixed(2)}|${x}|${y}`;
            }
        }
        if (written.get(name) !== style) {
            written.set(name, style);
            const [shown = "0", x, y] = style.split("|");
            label.style.opacity = shown;
            if (x !== undefined) {
                label.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
            }
        }
    };
    useFrame((_, delta) => {
        const far = THREE.MathUtils.smoothstep(
            view.distance,
            QUARTER_NAMES * 0.7,
            QUARTER_NAMES * 1.6,
        );
        const near =
            1 -
            THREE.MathUtils.smoothstep(
                view.distance,
                LANDMARK_NAMES * 0.6,
                LANDMARK_NAMES,
            );
        const ease = 1 - Math.exp(-delta * 8);
        for (const quarter of quarters) {
            const selected = quarter.name === view.selected;
            const pointed = quarter.name === hovered.current;
            // the border of the chosen quarter goes bold, the pointed one
            // a little, without lighting up what lies inside
            const lines = quarter.border.material as LineMaterial;
            const base = quarter.border.userData.width as number;
            const bold = selected ? 2 : pointed ? 1.5 : 1;
            lines.linewidth += (base * bold - lines.linewidth) * ease;
            const shown = selected ? 0.55 : pointed ? 0.4 : 0.2;
            lines.opacity += (shown - lines.opacity) * ease;
            quarter.border.renderOrder = selected ? ORDER.chosen : ORDER.lines;
            // with a quarter chosen, the others go dim under a dark veil
            const veil = quarter.fill.material;
            const dim = view.selected && !selected ? 0.6 : 0;
            veil.color.set(PALETTE.sky);
            veil.opacity += (dim - veil.opacity) * ease;
            quarter.fill.renderOrder = ORDER.veil;
            quarter.fill.visible = veil.opacity > 0.005;
            const named = pointed || selected ? Math.max(far, 0.9) : far;
            place(
                quarter.name,
                quarter.label,
                view.selected && !selected && !pointed ? named * 0.4 : named,
            );
        }
        // the icons, most important first, leaving out any that would
        // cover one already shown, and the names of those shown, leaving
        // out any that would cover another name
        const room = ICON_PIXELS * 1.1;
        const taken: number[] = [];
        const names: number[] = [];
        const placeNames =
            1 -
            THREE.MathUtils.smoothstep(
                view.distance,
                PLACE_NAMES * 0.6,
                PLACE_NAMES,
            );
        places.forEach((spot, k) => {
            projected.copy(spot.at).project(camera);
            const x = ((projected.x + 1) / 2) * size.width;
            const y = ((1 - projected.y) / 2) * size.height;
            const onScreen =
                projected.z < 1 &&
                x > -room &&
                x < size.width + room &&
                y > -room &&
                y < size.height + room;
            let free = onScreen;
            for (let i = 0; free && i < taken.length; i += 2) {
                free =
                    Math.abs(taken[i]! - x) > room ||
                    Math.abs(taken[i + 1]! - y) > room;
            }
            icons.show(k, free);
            if (free) {
                taken.push(x, y);
            }
            const wanted = spot.group === "landmark" ? near : placeNames;
            let named = free && wanted > 0.01;
            // the name stands above the icon, centered on it
            const half = (spot.name.length * LETTER) / 2;
            const top = y - ICON_PIXELS / 2 - NAME_HEIGHT;
            for (let i = 0; named && i < names.length; i += 4) {
                named =
                    x + half < names[i]! ||
                    x - half > names[i + 1]! ||
                    top + NAME_HEIGHT < names[i + 2]! ||
                    top > names[i + 3]!;
            }
            if (named) {
                names.push(x - half, x + half, top, top + NAME_HEIGHT);
            }
            place(placeKey(k), spot.at, named ? wanted : 0);
        });
    });
    return null;
}
