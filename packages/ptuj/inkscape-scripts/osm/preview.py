"""Draws src/map/ptuj.json as an SVG in the app's retro cyan wireframe
style, with a moment of its traffic, for Inkscape to export as the
README's picture:

    python3 preview.py ../../src/map/ptuj.json preview.svg
    inkscape preview.svg --export-type=png --export-filename=screenshot.png

Like the app it looks down at the map from the south, tilted, over the
low poly ground of terrain.json beside the map (flat without it), its hills
raised and its triangles drawn as a faint wireframe; it is drawn without
perspective. It shows the old town round FOCUS, close enough to tell the
streets and places apart, or the whole municipality when FOCUS is None.

Map data © OpenStreetMap contributors, ODbL. Elevation: EU-DEM
(Copernicus), SRTM and GMTED2010 (USGS), via Mapzen Terrain Tiles.
"""
import base64
import json
import math
import os
import random
import struct
import sys

WIDTH, HEIGHT = 1280, 900
MARGIN = 0.04
ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                     "src", "icons")
# the app's PALETTE, see src/layers.ts
SKY, WIREFRAME, LAND = "#010508", "#0a6f82", "#03141b"
WOODS, VINEYARDS, PARKS, WATER = "#05303a", "#062731", "#073a44", "#06495e"
SHORE, STREAM, ROAD, MAJOR = "#3ff4ff", "#1aa9c4", "#00c8ec", "#7ff6ff"
RAIL, OUTLINE, CAR, TRAIN = "#8ffaff", "#00e5ff", "#3fd8ee", "#e0ffff"
LANDMARK, VILLAGE = "#e6ffff", "#4fd8e8"
# the app's ground, see src/terrain.ts, and its first view, see src/view.tsx
EXAGGERATION = 2
LOW_POLY = 150
TILT = 0.45  # radians the view leans from straight down, looking north
FOCUS = (-40, 60, 2600)  # the middle (meters from the town hall) and width


def pairs(flat):
    return list(zip(flat[0::2], flat[1::2]))


class Terrain:
    """The app's low poly ground: the heights resampled to every LOW_POLY
    meters (the mean of the data round each point), raised, and flat
    triangles between them, cut from the south west to the north east."""

    def __init__(self, path):
        self.step, self.x0, self.y0 = 1e6, -1e6, -1e6
        self.columns, self.rows, self.heights = 2, 2, [0.0] * 4
        if not os.path.exists(path):
            return
        data = json.load(open(path))
        count = data["columns"] * data["rows"]
        fine = struct.unpack(f"<{count}H", base64.b64decode(data["heights"]))
        every = max(1, round(LOW_POLY / data["step"]))
        reach = every // 2

        def at(c, r):
            c = min(max(c, 0), data["columns"] - 1)
            r = min(max(r, 0), data["rows"] - 1)
            return fine[r * data["columns"] + c] / 10

        self.step = data["step"] * every
        self.x0, self.y0 = data["x0"], data["y0"]
        self.columns = (data["columns"] - 1) // every + 1
        self.rows = (data["rows"] - 1) // every + 1
        window = [(i, j) for j in range(-reach, reach + 1)
                  for i in range(-reach, reach + 1)]
        self.heights = [
            sum(at(c * every + i, r * every + j) for i, j in window)
            / len(window) * EXAGGERATION
            for r in range(self.rows) for c in range(self.columns)]

    def point(self, c, r):
        return (self.x0 + c * self.step, self.y0 + r * self.step,
                self.heights[r * self.columns + c])

    def height(self, x, y):
        fx = min(max((x - self.x0) / self.step, 0), self.columns - 1)
        fy = min(max((y - self.y0) / self.step, 0), self.rows - 1)
        c = min(int(fx), self.columns - 2)
        r = min(int(fy), self.rows - 2)
        tx, ty = fx - c, fy - r
        h, k, n = self.heights, r * self.columns + c, self.columns
        sw, ne = h[k], h[k + n + 1]
        if tx >= ty:
            return sw + tx * (h[k + 1] - sw) + ty * (ne - h[k + 1])
        return sw + ty * (h[k + n] - sw) + tx * (ne - h[k + n])


def main(source, target, terrain_path=None):
    plan = json.load(open(source))
    terrain = Terrain(terrain_path or os.path.join(os.path.dirname(source),
                                                   "terrain.json"))
    lean, rise = math.cos(TILT), math.sin(TILT)
    outline = pairs(plan["outline"])
    xs = [x for x, _ in outline]
    ys = [y * lean + terrain.height(x, y) * rise for x, y in outline]
    if FOCUS:
        fx, fy, width = FOCUS
        scale = WIDTH / width
        cx, cy = fx, fy * lean + terrain.height(fx, fy) * rise
    else:
        span = max((max(xs) - min(xs)) / WIDTH,
                   (max(ys) - min(ys)) / HEIGHT)
        scale = (1 - 2 * MARGIN) / span
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    bold = 2 if FOCUS else 1  # how much thicker lines and names are near
    most = terrain.step / 2  # the longest straight piece on the ground

    def at(x, y, h=None):
        """A point of the map on the ground, seen from the south above."""
        h = terrain.height(x, y) if h is None else h
        return (WIDTH / 2 + (x - cx) * scale,
                HEIGHT / 2 - (y * lean + h * rise - cy) * scale)

    def follow(points, closed):
        """The points of a line, with more between them over the hills."""
        if closed:
            points = points + points[:1]
        out = points[:1]
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            n = max(1, math.ceil(math.hypot(bx - ax, by - ay) / most))
            out += [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)
                    for k in range(1, n + 1)]
        return out

    def path(flat, closed=False):
        points = [at(x, y) for x, y in follow(pairs(flat), closed)]
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points)
        return d + (" Z" if closed else "")

    def lines(paths, color, width, opacity, glow=True):
        d = " ".join(paths)
        width *= bold
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
        'height="140%"><feGaussianBlur stdDeviation="2" result="b"/>'
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/>'
        '</feMerge></filter>',
        f'<clipPath id="land"><path d="{path(plan["outline"], True)}"/>'
        '</clipPath></defs>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{SKY}"/>',
    ]

    # the land, then the wireframe of the ground's triangles over all of it
    parts.append(fills([{"outer": plan["outline"], "holes": []}], LAND, 1,
                       False))
    wireframe = []
    for r in range(terrain.rows):
        for c in range(terrain.columns):
            here = at(*terrain.point(c, r))
            for dc, dr in ((1, 0), (0, 1), (1, 1)):
                if c + dc < terrain.columns and r + dr < terrain.rows:
                    there = at(*terrain.point(c + dc, r + dr))
                    wireframe.append(f"M{here[0]:.1f},{here[1]:.1f} "
                                     f"L{there[0]:.1f},{there[1]:.1f}")
    parts.append(lines(wireframe, WIREFRAME, 0.6, 0.7, False))

    rings = lambda key: [{"outer": r, "holes": []} for r in plan.get(key, [])]
    parts.append(fills(rings("woods"), WOODS, 0.7))
    parts.append(fills(rings("vineyards"), VINEYARDS, 0.6))
    parts.append(fills(rings("parks"), PARKS, 0.6))
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
    parts.append(lines(layers["minor"], ROAD, 0.6, 0.3))
    parts.append(lines(layers["medium"], ROAD, 1, 0.6))
    parts.append(lines(layers["major"], MAJOR, 1.5, 0.85))
    parts.append(lines([path(e[2]) for e in plan["rails"]["edges"]], RAIL,
                       1.5, 0.9))
    for quarter in plan["quarters"]:
        parts.append(lines([path(s["outer"], True)
                            for s in quarter["shapes"]], OUTLINE, 0.7, 0.25,
                           False))
    parts.append(lines([path(plan["outline"], True)], OUTLINE, 6, 0.12,
                       False))
    parts.append(lines([path(plan["outline"], True)], OUTLINE, 1.6, 0.9))

    # a moment of the traffic, as little wireframe boxes along the roads
    # and the railway
    rng = random.Random(1848)
    weights = {"motorway": 8, "trunk": 6, "primary": 6, "secondary": 4,
               "tertiary": 3, "unclassified": 1, "residential": 1}

    def vehicle(points, k, length, width, color, opacity):
        length, width = length * bold, width * bold
        (ax, ay), (bx, by) = points[max(k - 1, 0)], points[min(
            k + 1, len(points) - 1)]
        x, y = at(*points[k])
        angle = math.degrees(math.atan2(-(by - ay) * lean, bx - ax))
        return (f'<rect x="{-length / 2:.1f}" y="{-width / 2:.1f}" '
                f'width="{length}" height="{width}" fill="none" '
                f'stroke="{color}" stroke-width="{0.6 * bold}" '
                f'stroke-opacity="{opacity}" filter="url(#glow)" '
                f'transform="translate({x:.1f},{y:.1f}) '
                f'rotate({angle:.0f})"/>')

    for edge in plan["roads"]["edges"]:
        points = pairs(edge[3])
        for _ in range(weights.get(kinds[edge[2]], 0)):
            if len(points) > 1 and rng.random() < (0.2 if FOCUS else 0.12):
                k = rng.randrange(len(points))
                parts.append(vehicle(points, k, 3, 1.8, CAR, 0.7))
    rails = [follow(pairs(e[2]), False) for e in plan["rails"]["edges"]]
    if FOCUS:
        # a train standing by the middle of the view
        line = min(rails, key=lambda line: min(
            math.hypot(x - fx, y - fy) for x, y in line))
        k = min(range(len(line)), key=lambda k: math.hypot(
            line[k][0] - fx, line[k][1] - fy))
        for i in range(max(k - 4, 0), min(k + 4, len(line))):
            parts.append(vehicle(line, i, 7, 3, TRAIN, 1))
    else:
        for line in sorted(rails, key=len)[-3:]:
            for k in range(min(5, len(line))):
                parts.append(vehicle(line, k, 7, 3, TRAIN, 1))

    # the icons, standing on the ground: the landmarks, and near the other
    # places too, those that don't cover one already drawn, as in the app
    size = 12 * bold
    shown = []
    places = [(p, LANDMARK) for p in plan["landmarks"]]
    if FOCUS:
        places += [(p, VILLAGE) for p in plan["pois"]]
    for place, color in places:
        x, y = at(*place["at"])
        if not (0 <= x <= WIDTH and 0 <= y <= HEIGHT) or any(
                abs(x - a) < size and abs(y - b) < size for a, b in shown):
            continue
        shown.append((x, y))
        icon = open(os.path.join(ICONS, place["icon"] + ".svg")).read()
        body = icon[icon.index(">", icon.index("<svg")) + 1:icon.rindex(
            "</svg>")]
        parts.append(f'<g transform="translate({x - size / 2:.1f},'
                     f'{y - size:.1f}) scale({0.19 * bold})" fill="none" '
                     f'stroke="{color}" stroke-width="3" '
                     f'stroke-linecap="round" stroke-linejoin="round" '
                     f'filter="url(#glow)">{body}</g>')
    for quarter in plan["quarters"]:
        x, y = at(*quarter["label"])
        size = (13 if quarter["kind"] == "quarter" else 10) * bold
        color = OUTLINE if quarter["kind"] == "quarter" else VILLAGE
        parts.append(f'<text x="{x:.1f}" y="{y:.1f}" fill="{color}" '
                     f'font-family="DejaVu Sans Mono, monospace" '
                     f'font-size="{size}" letter-spacing="1" '
                     f'text-anchor="middle" filter="url(#glow)">'
                     f'{quarter["name"].upper()}</text>')
    parts.append("</svg>")
    with open(target, "w") as file:
        file.write("\n".join(parts))


if __name__ == "__main__":
    main(*sys.argv[1:])
