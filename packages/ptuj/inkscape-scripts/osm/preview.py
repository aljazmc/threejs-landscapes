"""Draws src/map/ptuj.json as a neon SVG like the app shows it, with a
moment of its traffic, for Inkscape to export as the README's picture:

    python3 preview.py ../../src/map/ptuj.json preview.svg
    inkscape preview.svg --export-type=png --export-filename=screenshot.png

Map data © OpenStreetMap contributors, ODbL
"""
import json
import os
import random
import sys

WIDTH, HEIGHT = 1280, 900
MARGIN = 0.04
ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                     "src", "icons")
# the app's PALETTE, see src/layers.ts
SKY, GRID, LAND = "#02050b", "#0b3442", "#061520"
WOODS, VINEYARDS, WATER = "#0a3a2a", "#2a1640", "#062a56"
SHORE, STREAM, ROAD, MAJOR = "#2f9bff", "#1e7bff", "#ffb000", "#ffcf40"
RAIL, OUTLINE, ICON, CAR, TRAIN = ("#ff3df0", "#00e5ff", "#7df9ff",
                                   "#fff2b0", "#ff5cf4")


def pairs(flat):
    return list(zip(flat[0::2], flat[1::2]))


def main(source, target):
    plan = json.load(open(source))
    outline = pairs(plan["outline"])
    xs, ys = [p[0] for p in outline], [p[1] for p in outline]
    span = max((max(xs) - min(xs)) / WIDTH, (max(ys) - min(ys)) / HEIGHT)
    scale = (1 - 2 * MARGIN) / span
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    def at(x, y):
        return (WIDTH / 2 + (x - cx) * scale, HEIGHT / 2 - (y - cy) * scale)

    def path(flat, closed=False):
        points = [at(x, y) for x, y in pairs(flat)]
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points)
        return d + (" Z" if closed else "")

    def lines(paths, color, width, opacity, glow=True):
        d = " ".join(paths)
        style = (f'fill="none" stroke="{color}" stroke-width="{width}" '
                 f'stroke-opacity="{opacity}" stroke-linejoin="round" '
                 f'stroke-linecap="round"')
        return f'<path d="{d}" {style}' + (
            ' filter="url(#glow)"/>' if glow else "/>")

    def fills(polygons, color, opacity, clip=True):
        d = " ".join(path(p["outer"], True) + "".join(
            " " + path(h, True) for h in p["holes"]) for p in polygons)
        return (f'<path d="{d}" fill="{color}" fill-opacity="{opacity}" '
                f'fill-rule="evenodd"'
                + (' clip-path="url(#land)"/>' if clip else "/>"))

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" '
        f'height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        '<defs><filter id="glow" x="-20%" y="-20%" width="140%" '
        'height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/>'
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/>'
        '</feMerge></filter>',
        f'<clipPath id="land"><path d="{path(plan["outline"], True)}"/>'
        '</clipPath></defs>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{SKY}"/>',
    ]
    grid = []
    for k in range(-10, 11):
        x, _ = at(cx + k * 1000, cy)
        _, y = at(cx, cy + k * 1000)
        grid.append(f"M{x:.1f},0 L{x:.1f},{HEIGHT}")
        grid.append(f"M0,{y:.1f} L{WIDTH},{y:.1f}")
    parts.append(lines(grid, GRID, 1, 0.8, False))
    parts.append(fills([{"outer": plan["outline"], "holes": []}], LAND, 1,
                       False))
    parts.append(fills([{"outer": r, "holes": []} for r in plan["woods"]],
                       WOODS, 0.7))
    parts.append(fills([{"outer": r, "holes": []}
                        for r in plan["vineyards"]], VINEYARDS, 0.6))
    parts.append(fills(plan["water"], WATER, 1))
    shore = [path(p["outer"], True) for p in plan["water"]]
    parts.append(lines(shore, SHORE, 1.2, 0.9).replace(
        "/>", ' clip-path="url(#land)"/>', 1))
    parts.append(lines([path(s) for s in plan["streams"]], STREAM, 0.8, 0.6))
    kinds = plan["roads"]["kinds"]
    layers = {"major": [], "medium": [], "minor": []}
    for edge in plan["roads"]["edges"]:
        kind = kinds[edge[2]]
        layer = ("major" if kind in ("motorway", "trunk", "primary") else
                 "medium" if kind in ("secondary", "tertiary") else "minor")
        layers[layer].append(path(edge[3]))
    parts.append(lines(layers["minor"], ROAD, 0.6, 0.35))
    parts.append(lines(layers["medium"], ROAD, 1.1, 0.75))
    parts.append(lines(layers["major"], MAJOR, 1.8, 1))
    parts.append(lines([path(e[2]) for e in plan["rails"]["edges"]], RAIL,
                       1.6, 1))
    for quarter in plan["quarters"]:
        parts.append(lines([path(s["outer"], True)
                            for s in quarter["shapes"]], OUTLINE, 0.7, 0.3,
                           False))
    parts.append(lines([path(plan["outline"], True)], OUTLINE, 6, 0.15,
                       False))
    parts.append(lines([path(plan["outline"], True)], OUTLINE, 2, 1))

    # a moment of the traffic: cars on the busier roads, trains on the line
    rng = random.Random(1848)
    weights = {"motorway": 8, "trunk": 6, "primary": 6, "secondary": 4,
               "tertiary": 3, "unclassified": 1, "residential": 1}
    for edge in plan["roads"]["edges"]:
        kind = kinds[edge[2]]
        points = pairs(edge[3])
        for _ in range(weights.get(kind, 0)):
            if rng.random() < 0.12:
                x, y = at(*rng.choice(points))
                parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" '
                             f'fill="{CAR}" filter="url(#glow)"/>')
    rails = [pairs(e[2]) for e in plan["rails"]["edges"]]
    longest = sorted(rails, key=len)[-3:]
    for line in longest:
        for k in range(min(5, len(line))):
            x, y = at(*line[k])
            parts.append(f'<rect x="{x - 2.5:.1f}" y="{y - 2.5:.1f}" '
                         f'width="5" height="5" fill="{TRAIN}" '
                         f'filter="url(#glow)"/>')

    # the landmarks' icons, and the names of the quarters
    for landmark in plan["landmarks"]:
        x, y = at(*landmark["at"])
        icon = open(os.path.join(ICONS, landmark["icon"] + ".svg")).read()
        body = icon[icon.index(">", icon.index("<svg")) + 1:icon.rindex(
            "</svg>")]
        parts.append(f'<g transform="translate({x - 6:.1f},{y - 6:.1f}) '
                     f'scale(0.19)" fill="none" stroke="{ICON}" '
                     f'stroke-width="3" stroke-linecap="round" '
                     f'stroke-linejoin="round" opacity="0.8">{body}</g>')
    for quarter in plan["quarters"]:
        x, y = at(*quarter["label"])
        size = 13 if quarter["kind"] == "quarter" else 10
        color = OUTLINE if quarter["kind"] == "quarter" else "#7fe9c0"
        parts.append(f'<text x="{x:.1f}" y="{y:.1f}" fill="{color}" '
                     f'font-family="DejaVu Sans Mono, monospace" '
                     f'font-size="{size}" letter-spacing="1" '
                     f'text-anchor="middle" filter="url(#glow)">'
                     f'{quarter["name"].upper()}</text>')
    parts.append("</svg>")
    with open(target, "w") as file:
        file.write("\n".join(parts))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
