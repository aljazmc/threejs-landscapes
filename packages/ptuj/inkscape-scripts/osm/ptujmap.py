"""Turns OpenStreetMap data of the Mestna občina Ptuj into src/map/ptuj.json,
the map the app draws: the outline of the municipality, its quarters and
villages, the Drava with Ptujsko jezero and the ponds, streams, woods,
vineyards and parks, the landmarks of the old town and the schools, health care, public
institutions, restaurants and bars, and the road and rail
networks the traffic runs on. Positions are in meters east (x) and north
(y) of the town hall on Mestni trg.

    python3 fetch.py <directory>      # downloads the data into <directory>
    python3 ptujmap.py <directory>    # writes src/map/ptuj.json

Map data © OpenStreetMap contributors, available under the Open Database
License (ODbL): https://www.openstreetmap.org/copyright
"""
import json
import math
import os
import sys

import numpy as np

from geo import inside, load, project, rings, simplify, way_points

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(HERE, "..", "..", "src", "map", "ptuj.json")

ROAD_KINDS = ("motorway", "trunk", "primary", "secondary", "tertiary",
              "unclassified", "residential", "living_street", "pedestrian")
CORE = 1600  # meters round the town hall drawn in more detail
RASTER = 15  # meters on the side of a cell when the quarters are found

# the quarters are the land nearest to their place, except that all of the
# right bank of the Drava is Breg-Turnišče; Center is its old town
RIGHT_BANK = "Breg-Turnišče"
QUARTERS = ("Center", "Breg-Turnišče", "Jezero", "Ljudski vrt", "Rogoznica",
            "Panorama")
PLACE_NAMES = {"Ljudski Vrt": "Ljudski vrt"}
MOVED = {"Center": (-130, 60)}
DRAVA_WAYS = (28671179, 124495831, 173135099, 745391010)

# the landmarks of the old town, where the map has them, and their icons
LANDMARKS = (
    ("Ptujski grad", "castle", (-322, 160)),
    ("Mestna hiša", "townhall", (12, -2)),
    ("Cerkev sv. Jurija", "church", (-62, 96)),
    ("Mestni stolp", "tower", (-108, 71)),
    ("Orfejev spomenik", "monument", (-125, 60)),
    ("Dravski stolp", "tower", (-182, -209)),
    ("Minoritski samostan", "monastery", (14, -150)),
    ("Dominikanski samostan", "monastery", (-541, 128)),
    ("Gostilna Ribič", "fish", (-296, -130)),
    ("Mestni stadion", "stadium", (222, -300)),
    ("Železniška postaja Ptuj", "station", (526, 311)),
)


# the places of the map shown with an icon besides the landmarks: by the
# kind of place, its icon and its group; the groups are shown in this
# order where icons crowd, and so are the kinds within a group
POIS = (
    ("hospital", "hospital", "health"),
    ("clinic", "clinic", "health"),
    ("pharmacy", "pharmacy", "health"),
    ("doctors", "clinic", "health"),
    ("police", "police", "public"),
    ("fire_station", "fire", "public"),
    ("courthouse", "court", "public"),
    ("post_office", "post", "public"),
    ("library", "library", "public"),
    ("theatre", "theatre", "public"),
    ("cinema", "theatre", "public"),
    ("museum", "museum", "public"),
    ("community_centre", "community", "public"),
    ("arts_centre", "community", "public"),
    ("government", "office", "public"),
    ("school", "school", "education"),
    ("college", "school", "education"),
    ("university", "school", "education"),
    ("kindergarten", "kindergarten", "education"),
    ("restaurant", "restaurant", "food"),
    ("fast_food", "restaurant", "food"),
    ("pub", "bar", "food"),
    ("bar", "bar", "food"),
    ("biergarten", "bar", "food"),
    ("cafe", "cafe", "food"),
)
GROUPS = ("health", "public", "education", "food")
# names for places the map leaves unnamed
UNNAMED = {"post_office": "Pošta", "doctors": "Ambulanta",
           "pharmacy": "Lekarna", "cafe": "Kavarna", "bar": "Bar",
           "restaurant": "Restavracija", "fast_food": "Okrepčevalnica",
           "fire_station": "Gasilski dom", "kindergarten": "Vrtec",
           "school": "Šola"}


def pois(directory, outline):
    """The places with icons, most important first, leaving out those the
    landmarks already show and those the map has twice."""
    path = os.path.join(directory, "pois.json")
    if not os.path.exists(path):
        return []
    kinds = [kind for kind, _, _ in POIS]
    found = []
    for element in load(directory, "pois.json")["elements"]:
        tags = element["tags"]
        kind = (tags.get("amenity") or tags.get("healthcare")
                or tags.get("tourism") or tags.get("office"))
        if kind == "centre":
            kind = "clinic"
        if kind not in kinds:
            continue
        name = tags.get("name") or UNNAMED.get(kind)
        if not name:
            continue
        # the health centre is tagged as a hospital, but is its own kind
        if "zdravstveni dom" in name.lower():
            kind = "clinic"
        point = element.get("center") or element
        at = project(point["lon"], point["lat"])
        if not inside(at, outline):
            continue
        if any(math.dist(at, landmark) < 30 for _, _, landmark in LANDMARKS):
            continue
        if any(other["name"] == name and math.dist(at, other["at"]) < 80
               for other in found):
            continue
        _, icon, group = POIS[kinds.index(kind)]
        found.append({"name": name, "icon": icon, "group": group,
                      "at": [r1(at[0]), r1(at[1])], "rank": kinds.index(kind)})
    found.sort(key=lambda p: (GROUPS.index(p["group"]), p["rank"]))
    for place in found:
        del place["rank"]
    return found


def r1(value):
    return round(value, 1)


def flat(points):
    return [r1(c) for p in points for c in p]


def tolerance(points, fine, coarse):
    near = min(math.hypot(x, y) for x, y in points) < CORE
    return fine if near else coarse


# --- clipping to the outline ------------------------------------------------

def crossing(a, b, outline):
    """Where segment a-b first crosses the outline, as its share along it."""
    best = None
    for c, d in zip(outline, outline[1:] + outline[:1]):
        rx, ry = b[0] - a[0], b[1] - a[1]
        sx, sy = d[0] - c[0], d[1] - c[1]
        den = rx * sy - ry * sx
        if den == 0:
            continue
        t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den
        u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
        if 0 <= t <= 1 and 0 <= u <= 1 and (best is None or t < best):
            best = t
    return 0.5 if best is None else best


def clip(points, outline):
    """The pieces of a line inside the outline, each with whether its ends
    are where it was cut."""
    pieces, piece = [], None
    previous = None
    for p in points:
        now = inside(p, outline)
        if previous is not None and now != previous[1]:
            a = previous[0]
            t = crossing(a, p, outline)
            cut = (a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t)
            if now:
                piece = {"points": [cut], "cut_start": True}
            else:
                piece["points"].append(cut)
                piece["cut_end"] = True
                pieces.append(piece)
                piece = None
        if now:
            if piece is None:
                piece = {"points": [], "cut_start": False}
            piece["points"].append(p)
        previous = (p, now)
    if piece is not None:
        piece["cut_end"] = False
        pieces.append(piece)
    return [piece for piece in pieces if len(piece["points"]) > 1]


# --- networks ---------------------------------------------------------------

def network(ways, outline, kinds=None):
    """A graph of the ways inside the outline: nodes where ways meet, end or
    leave the municipality ("exits"), and edges between them along the way,
    each with its kind."""
    uses = {}
    for way in ways:
        for k, node in enumerate(way["nodes"]):
            uses[node] = uses.get(node, 0) + (1 if 0 < k < len(
                way["nodes"]) - 1 else 2)
    nodes, index, exits = [], {}, []
    edges = []

    def node_at(key, point, exit=False):
        if key not in index:
            index[key] = len(nodes)
            nodes.append(point)
            if exit:
                exits.append(index[key])
        return index[key]

    for way in ways:
        ids = way["nodes"]
        points = way["points"]
        # split at the junctions
        start = 0
        for k in range(1, len(ids)):
            if k == len(ids) - 1 or uses.get(ids[k], 0) > 1:
                part_ids = ids[start:k + 1]
                part = points[start:k + 1]
                start = k
                for piece in clip(part, outline):
                    pts = piece["points"]
                    if piece["cut_start"]:
                        a = node_at(("cut", way["id"], r1(pts[0][0]),
                                     r1(pts[0][1])), pts[0], True)
                    else:
                        a = node_at(part_ids[0], pts[0])
                    if piece["cut_end"]:
                        b = node_at(("cut", way["id"], r1(pts[-1][0]),
                                     r1(pts[-1][1])), pts[-1], True)
                    else:
                        b = node_at(part_ids[-1], pts[-1])
                    tol = tolerance(pts, 1.0, 3.0)
                    pts = simplify(pts, tol)
                    edge = [a, b, flat(pts)]
                    if kinds:
                        edge.insert(2, kinds.index(way["kind"]))
                    edges.append(edge)
    return {"nodes": flat(nodes), "exits": exits, "edges": edges}


# --- quarters ---------------------------------------------------------------

def quarters(outline, places, river):
    """The quarters and villages as polygons: the cells of a raster are
    given to their quarter, and the outlines of each quarter's cells traced
    and simplified."""
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]
    x0, y0 = min(xs) - RASTER, min(ys) - RASTER
    nx = int((max(xs) - x0) / RASTER) + 2
    ny = int((max(ys) - y0) / RASTER) + 2
    X, Y = np.meshgrid(x0 + (np.arange(nx) + 0.5) * RASTER,
                       y0 + (np.arange(ny) + 0.5) * RASTER, indexing="ij")
    within = np.zeros(X.shape, bool)
    for (ax, ay), (bx, by) in zip(outline, outline[1:] + outline[:1]):
        if ay != by:
            crosses = (ay > Y) != (by > Y)
            within ^= crosses & (X < ax + (Y - ay) * (bx - ax) / (by - ay))
    # which side of the Drava: negative on its right bank
    best = np.full(X.shape, np.inf)
    side = np.ones(X.shape)
    for (ax, ay), (bx, by) in zip(river, river[1:]):
        dx, dy = bx - ax, by - ay
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy
                                                        or 1e-9), 0, 1)
        d = np.hypot(X - ax - t * dx, Y - ay - t * dy)
        closer = d < best
        best = np.where(closer, d, best)
        side = np.where(closer, dx * (Y - ay) - dy * (X - ax), side)
    names = [p["name"] for p in places]
    left = [k for k, name in enumerate(names) if name != RIGHT_BANK]
    gaps = np.array([np.hypot(X - places[k]["at"][0],
                              Y - places[k]["at"][1]) for k in left])
    label = np.array(left)[np.argmin(gaps, axis=0)]
    label = np.where(side < 0, names.index(RIGHT_BANK), label)
    label = np.where(within, label, -1)

    result = []
    for k, place in enumerate(places):
        mask = label == k
        if not mask.any():
            continue
        found = trace(mask)
        polygons = []
        for ring in found:
            points = [(x0 + i * RASTER, y0 + j * RASTER) for i, j in ring]
            points = simplify(points + points[:1], 18)[:-1]
            if len(points) >= 3:
                polygons.append(points)
        outers = [p for p in polygons if area(p) > 0]
        holes = [p for p in polygons if area(p) < 0]
        shapes = [{"outer": flat(o), "holes": [
            flat(h) for h in holes if inside(h[0], o)]} for o in outers
            if abs(area(o)) > RASTER * RASTER * 4]
        result.append({"name": place["name"], "kind": place["kind"],
                       "label": [r1(c) for c in place["at"]],
                       "shapes": shapes})
    return result


def area(ring):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(ring, ring[1:] + ring[:1])) / 2


def trace(mask):
    """Rings of corners round the true cells of a mask, counter-clockwise
    round the cells, clockwise round holes."""
    nx, ny = mask.shape
    padded = np.zeros((nx + 2, ny + 2), bool)
    padded[1:-1, 1:-1] = mask
    out = {}
    edges = []
    cells = np.argwhere(mask)
    for i, j in cells:
        pi, pj = i + 1, j + 1
        if not padded[pi, pj - 1]:
            edges.append(((i, j), (i + 1, j)))
        if not padded[pi + 1, pj]:
            edges.append(((i + 1, j), (i + 1, j + 1)))
        if not padded[pi, pj + 1]:
            edges.append(((i + 1, j + 1), (i, j + 1)))
        if not padded[pi - 1, pj]:
            edges.append(((i, j + 1), (i, j)))
    for a, b in edges:
        out.setdefault(a, []).append(b)
    rings = []
    while out:
        start = next(iter(out))
        ring = [start]
        here = start
        while True:
            targets = out[here]
            step = targets.pop()
            if not targets:
                del out[here]
            if step == start:
                break
            ring.append(step)
            here = step
            if here not in out:
                break
        # leave out the corners along straight runs
        kept = [p for k, p in enumerate(ring)
                if (ring[k - 1][0] - p[0]) * (ring[(k + 1) % len(ring)][1]
                                              - p[1])
                != (ring[k - 1][1] - p[1]) * (ring[(k + 1) % len(ring)][0]
                                              - p[0])]
        if len(kept) >= 3:
            rings.append(kept)
    return rings


# --- the map ----------------------------------------------------------------

def main(directory):
    muni = load(directory, "muni.geojson")["features"][0]["geometry"]
    outline = [project(lon, lat) for lon, lat in muni["coordinates"][0]]
    outline = simplify(outline, 6)[:-1]
    if area(outline) < 0:
        outline.reverse()

    elements = []
    seen = set()
    for name in ("lines.json", "town.json", "minor.json"):
        for element in load(directory, name)["elements"]:
            key = (element["type"], element["id"])
            if key not in seen:
                seen.add(key)
                elements.append(element)

    def within(points):
        return any(inside(p, outline) for p in points)

    plan = {"outline": flat(outline), "water": [], "streams": [],
            "woods": [], "vineyards": [], "parks": [], "landmarks": [],
            "quarters": []}
    roads, rails, river = [], [], {}
    for element in elements:
        tags = element.get("tags", {})
        if element["type"] == "relation" and tags.get("natural") == "water":
            found = rings(element)
            outers = [r for role, r in found if role == "outer"]
            inners = [r for role, r in found if role == "inner"]
            for outer in outers:
                if len(outer) > 3 and outer[0] == outer[-1] and within(outer):
                    holes = [h for h in inners if inside(h[0], outer)]
                    plan["water"].append({
                        "outer": flat(simplify(outer, 2)[:-1]),
                        "holes": [flat(simplify(h, 2)[:-1]) for h in holes]})
            continue
        if element["type"] != "way" or "geometry" not in element:
            continue
        points = way_points(element)
        closed = len(points) > 3 and points[0] == points[-1]
        highway = tags.get("highway", "").replace("_link", "")
        if element["id"] in DRAVA_WAYS:
            river[element["id"]] = points
        elif tags.get("natural") == "water" and closed and within(points):
            plan["water"].append({"outer": flat(simplify(points, 1.5)[:-1]),
                                  "holes": []})
        elif tags.get("waterway") in ("stream", "canal", "river"):
            for piece in clip(points, outline):
                plan["streams"].append(flat(simplify(piece["points"], 4)))
        elif tags.get("railway") == "rail" and within(points):
            rails.append({"id": element["id"], "nodes": element["nodes"],
                          "points": points})
        elif highway in ROAD_KINDS and within(points):
            roads.append({"id": element["id"], "nodes": element["nodes"],
                          "points": points, "kind": highway})
        elif closed and within(points):
            ring = flat(simplify(points, tolerance(points, 2, 5))[:-1])
            if len(ring) < 6:
                continue
            if tags.get("landuse") == "forest" or tags.get("natural") == "wood":
                plan["woods"].append(ring)
            elif tags.get("landuse") == "vineyard":
                plan["vineyards"].append(ring)
            elif tags.get("leisure") == "park":
                plan["parks"].append(ring)

    plan["roads"] = network(roads, outline, list(ROAD_KINDS))
    plan["roads"]["kinds"] = list(ROAD_KINDS)
    plan["rails"] = network(rails, outline)

    # the Drava's ways, joined downstream into one line
    parts = [river[k] for k in DRAVA_WAYS if k in river]
    line = parts.pop(0)
    while parts:
        for k, part in enumerate(parts):
            if part[0] == line[-1]:
                line += part[1:]
            elif part[-1] == line[0]:
                line = part + line[1:]
            else:
                continue
            parts.pop(k)
            break
        else:
            break
    if line[0][0] > line[-1][0]:
        line.reverse()

    places = []
    for element in load(directory, "sub.json")["elements"]:
        tags = element["tags"]
        if element["type"] == "node" and tags.get("place") in ("quarter",
                                                               "village"):
            name = PLACE_NAMES.get(tags["name"], tags["name"])
            at = MOVED.get(name, project(element["lon"], element["lat"]))
            if inside(at, outline):
                places.append({"name": name, "at": at,
                               "kind": "quarter" if name in QUARTERS
                               else "village"})
    plan["quarters"] = quarters(outline, places, line)
    plan["landmarks"] = [{"name": name, "icon": icon, "at": list(at)}
                         for name, icon, at in LANDMARKS]
    plan["pois"] = pois(directory, outline)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as file:
        json.dump(plan, file, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {OUTPUT}: {os.path.getsize(OUTPUT) // 1024} KB")
    for key in ("water", "streams", "woods", "vineyards", "parks",
                "quarters", "pois"):
        print(f"  {key}: {len(plan[key])}")
    for key in ("roads", "rails"):
        print(f"  {key}: {len(plan[key]['nodes']) // 2} nodes, "
              f"{len(plan[key]['edges'])} edges, "
              f"{len(plan[key]['exits'])} exits")


if __name__ == "__main__":
    main(sys.argv[1])
