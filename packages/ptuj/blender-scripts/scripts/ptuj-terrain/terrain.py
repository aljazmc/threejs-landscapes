import math
import random

import bpy
from mathutils import Vector

from lowpoly import Builder, clear_scene, marker, setup_scene

# The ground of Ptuj as a diorama block, and the plan of the town on it.
#
# The old town lies on the left (north) bank of the Drava, which flows east
# through the town into Ptujsko jezero, the lake to the east. The castle hill
# rises over the west end of the town, the vineyards of Haloze cover the
# hills south of the river and the gentler Slovenske gorice lie to the north.
# The footbridge crosses the river by Ribič, the old bridge where the lake
# begins. Between them on the bank stands Dravski stolp, which houses
# Miheličeva galerija, between riverside parks. Slovenski trg with the
# church and the city tower lies on the slope east of the castle hill, the
# town hall on Mestni trg and the stadium beyond the Minorite friary by the
# lake.
#
# Besides the terrain, road and water meshes, the export holds markers:
# empties whose extras say what the app puts there ("model" and "part" of
# models/<model>.glb) or which path they belong to ("path" and "index").
HALF_X = 300
HALF_Y = 210
CELL = 6
BOTTOM = -14
WATER = -1.0
BED = -4.5

TOWN = (60, 10)
HILL = (-55, 45)
HILL_TOP = 27
HILL_BASE = 78
HILL_HEIGHT = 28

RIVER = [(-340, -18), (-225, -30), (-150, -38), (-90, -44), (-20, -48),
         (60, -52), (140, -48), (220, -58), (330, -75)]
RIVER_WIDTH = 36
LAKE = ((245, -60), (62, 40))
# model and x of the bridges over the river; their LENGTH spans it plus 8 m
# of bank per side, and their decks rise by HUMP (see deck_z) between the
# parapets or railings WALK m apart
BRIDGE_LENGTH = RIVER_WIDTH + 16
BRIDGES = (("bridge", 175), ("footbridge", -10))
HUMP = {"bridge": 3.0, "footbridge": 3.4}
WALK = {"bridge": 6.8, "footbridge": 5.2}
STADIUM = (263, 21)
SQUARE = (3, 28)  # Slovenski trg, on the slope east of the castle hill
# riverside parks on both sides of Dravski stolp, between the bridges
PARKS = (((28, -11), (26, 8)), ((115, -8), (51, 10)))

PLAZAS = (((184, 57), (10, 14)),  # Mestni trg, before the town hall
          (SQUARE, (17, 15)))  # Slovenski trg

# model, location, rotation, half size of the footprint around location
LANDMARKS = (
    ("castle", HILL, 0.0, (26, 26)),
    ("townhall", (200, 58), -math.pi / 2, (8, 14)),  # clock to the west
    ("church", (3, 54), 0.0, (21, 8)),
    ("citytower", (-7, 38), 0.0, (4.5, 4.5)),
    ("orpheus", (1, 30), 0.0, (2, 1.5)),
    ("dravatower", (78, -9), 0.0, (7.5, 7.5)),
    ("minorite", (205, 4), 0.0, (18, 25)),
    ("ribic", (-22, -12), 0.0, (8, 7.5)),
    ("stadium", STADIUM, math.pi, (37, 31)),
)
# ground leveled for landmarks: center, half size, height, slope width
SITES = ((STADIUM, (37, 31), 0.6, 20),
         ((4, 40), (19, 23), 3.0, 14))

# name, points, width. Every street ends on another street, a square, a
# bridge or the edge of the diorama, which check_streets() makes sure of.
STREETS = (
    ("Promenade", [(-10, -21), (20, -23), (55, -25.5), (62, -26), (100, -24),
                   (140, -25), (178.2, -26.6)], 6),
    ("Presernova", [(-28, 10), (22, 8), (61.85, 8)], 7),
    ("Dravska", [(-5, 9.1), (-8, -8), (-10, -21)], 6),
    ("Murkova", [(10, 13.5), (10, 8.4)], 7),
    ("Volkmerjeva", [(61.85, 8), (100, 6), (140, 8), (179.4, 12)], 6),
    ("Ormoska", [(178.2, -26.6), (179, 0), (180, 30), (185, 72), (215, 110),
                 (240, 210)], 7),
    ("East", [(181.2, 40), (220, 41), (222, 74), (300, 74)], 7),
    ("Rotovska", [(188.9, 77), (222, 74)], 6),
    ("Ring", [(-36, 74), (0, 74), (40, 66), (70, 56), (100, 60), (140, 60),
              (183.6, 60)], 6),
    ("CrossEast", [(61, -25.8), (62, 14), (70, 56)], 6),
    ("West", [(-300, 8), (-200, 4), (-140, -5), (-100, -14), (-50, -16),
              (-28, 10)], 6),
    ("Castle", [(-28, 10), (-22, 30), (-24, 58), (-36, 74), (-55, 77),
                (-78, 72), (-91, 55), (-97, 30), (-106, 2), (-112, -11.3)],
     5),
    ("South", [(61, -79), (66, -95), (80, -140), (95, -205), (97, -210)], 7),
    ("Breg", [(-300, -58), (-200, -66), (-100, -74), (-10, -79), (62, -80),
              (130, -79), (172, -82), (195, -108), (240, -118),
              (300, -118)], 6),
)
# gravel paths through the riverside parks
PATHS = (
    ("ParkWest", [(-7.3, -4), (15, -8), (35, -6), (61.5, -6)], 2.5),
    ("ParkWestRiver", [(20, -23), (25, -7)], 2.5),
    ("ParkNorth", [(61.6, -4), (70, 1), (88, 1), (93, -24.4)], 2.5),
    ("ParkRiver", [(68, -25.7), (78, -19.8), (90.75, -13)], 2.5),
    ("ParkEast", [(110, -24.25), (120, -12), (140, -6), (150, 9)], 2.5),
    ("ParkEastRiver", [(130, -24.75), (140, -6)], 2.5),
)
# The kurents' round along the river: over the footbridge, along the right
# bank, back over the old bridge and along the promenade past Dravski
# stolp; a bridge's name crosses it.
PARADE = [(20, -23), (-2, -22), "footbridge", (-11, -79), (62, -80),
          (130, -79), (172, -82), "bridge", (140, -25), (100, -24),
          (62, -26)]
STREET_HALF = 3.4  # room the kurents take on the streets around the path

CORE = ("HouseA", "HouseB", "HouseC", "HouseD", "HouseE")
OUTSKIRTS = ("HouseA", "HouseE", "Farmhouse", "Farmhouse")
TREES = ("TreeRound", "TreeDouble", "TreePine")


def smoothstep(edge0, edge1, x):
    t = min(max((x - edge0) / (edge1 - edge0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def segment_distance(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / (ax * ax + ay * ay)
    t = min(max(t, 0.0), 1.0)
    return distance(p, (a[0] + t * ax, a[1] + t * ay))


def polyline_distance(p, points):
    return min(segment_distance(p, a, b) for a, b in zip(points, points[1:]))


def river_at(x):
    """Point on the river's center line and the direction of the current."""
    for a, b in zip(RIVER, RIVER[1:]):
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            direction = Vector((b[0] - a[0], b[1] - a[1])).normalized()
            return Vector((x, a[1] + t * (b[1] - a[1]))), direction
    raise ValueError(x)


def lake_distance(p):
    (cx, cy), (rx, ry) = LAKE
    return math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry)


def bridge_ends(x):
    center, direction = river_at(x)
    across = Vector((-direction.y, direction.x))
    half = RIVER_WIDTH / 2 + 8
    return center, direction, center + across * half, center - across * half


def deck_z(model, along):
    """Height of a bridge's deck at a distance along it from the middle."""
    return 0.4 + HUMP[model] * (1 - (2 * along / BRIDGE_LENGTH) ** 2)


def rect_distance(p, center, half):
    return math.hypot(max(abs(p[0] - center[0]) - half[0], 0),
                      max(abs(p[1] - center[1]) - half[1], 0))


def flatness(p):
    """0 where the ground is kept level for the town and the bridges."""
    flat = smoothstep(120, 200, distance(p, TOWN))
    for _, x in BRIDGES:
        flat = min(flat, smoothstep(30, 60, distance(p, river_at(x)[0])))
    return flat


def haloze(p):
    return smoothstep(-95, -185, p[1])


def height(x, y):
    p = (x, y)
    rolling = (1.2 * math.sin(x / 23 + 0.5) * math.cos(y / 31)
               + 0.8 * math.sin((x + y) / 17) + 0.6 * math.cos((x - 2 * y) / 41))
    flat = flatness(p)
    h = 0.3 + 0.8 * flat + rolling * (0.15 + 0.85 * flat)
    hill = smoothstep(HILL_BASE, HILL_TOP, distance(p, HILL))
    h = h * (1 - hill) + HILL_HEIGHT * hill + 6 * rolling * hill * (1 - hill)
    h += haloze(p) * (22 + 7 * math.sin(x / 37 + 1) + 3 * math.cos(x / 15)
                      + 2 * rolling)
    h += smoothstep(120, 200, y) * (10 + 5 * math.sin(x / 45) + rolling)
    for center, half, level, reach in SITES:
        site = 1 - smoothstep(0, reach, rect_distance(p, center, half))
        h = h * (1 - site) + level * site
    carve = max(1 - smoothstep(RIVER_WIDTH / 2 - 3, RIVER_WIDTH / 2 + 6,
                               polyline_distance(p, RIVER)),
                1 - smoothstep(0.85, 1.15, lake_distance(p)))
    return h * (1 - carve) + BED * carve


def ground(x, y, reach=3.0):
    """Highest terrain around a point, so draped meshes stay above the
    terrain's triangles."""
    return max(height(x + dx, y + dy) for dx, dy in
               ((0, 0), (reach, 0), (-reach, 0), (0, reach), (0, -reach)))


def slope(x, y):
    return math.hypot(height(x + 1, y) - height(x - 1, y),
                      height(x, y + 1) - height(x, y - 1)) / 2


def is_vineyard(p):
    a, b = math.floor((p[0] + 1000) / 50), math.floor((p[1] + 1000) / 40)
    return haloze(p) > 0.3 and (a * 73856093 ^ b * 19349663) % 10 < 6


def field(p):
    a, b = math.floor((p[0] + 1000) / 40), math.floor((p[1] + 1000) / 30)
    kinds = ("field_wheat", "field_green", "field_soil", "meadow", "grass")
    return kinds[(a * 83492791 ^ b * 2654435761) % len(kinds)]


# --- meshes ----------------------------------------------------------------

def up_face(b, points, mat):
    face = b.bm.faces.new([b.bm.verts.new(point) for point in points])
    face.normal_update()
    if face.normal.z < 0:
        face.normal_flip()
    face.material_index = b.slot(mat)


def out_face(b, points, mat, outward):
    face = b.bm.faces.new([b.bm.verts.new(point) for point in points])
    face.normal_update()
    if face.normal.dot(outward) < 0:
        face.normal_flip()
    face.material_index = b.slot(mat)


def ground_material(i, j, center, z):
    if z < WATER - 1:
        return "riverbed"
    if z < WATER + 0.5:
        return "sand"
    if is_vineyard(center) and z > 6:
        return "vine" if j % 2 else "soil"
    d = distance(center, HILL)
    if HILL_TOP + 1 < d < HILL_BASE - 6 or any(
            rect_distance(center, *park) == 0 for park in PARKS):
        return "grass_dark"
    if (distance(center, TOWN) > 170 and z < 6 and haloze(center) < 0.2
            and polyline_distance(center, RIVER) > RIVER_WIDTH / 2 + 10
            and lake_distance(center) > 1.3):
        return field(center)
    return "meadow" if (i * 7 + j * 13) % 5 == 0 else "grass"


def grid():
    rng = random.Random(7)
    columns, rows = 2 * HALF_X // CELL, 2 * HALF_Y // CELL
    points = {}
    for i in range(columns + 1):
        for j in range(rows + 1):
            x, y = -HALF_X + i * CELL, -HALF_Y + j * CELL
            if 0 < i < columns and 0 < j < rows:
                x += rng.uniform(-0.3, 0.3) * CELL
                y += rng.uniform(-0.3, 0.3) * CELL
            points[i, j] = Vector((x, y, height(x, y)))
    return points, columns, rows


def boundary(columns, rows):
    """Edges around the grid as pairs of corners and their outward side."""
    for i in range(columns):
        yield (i, 0), (i + 1, 0), Vector((0, -1, 0))
        yield (i, rows), (i + 1, rows), Vector((0, 1, 0))
    for j in range(rows):
        yield (0, j), (0, j + 1), Vector((-1, 0, 0))
        yield (columns, j), (columns, j + 1), Vector((1, 0, 0))


def terrain_mesh(points, columns, rows):
    b = Builder("Terrain")
    for i in range(columns):
        for j in range(rows):
            a, c = points[i, j], points[i + 1, j + 1]
            right, top = points[i + 1, j], points[i, j + 1]
            triangles = ((a, right, c), (a, c, top)) if (i + j) % 2 else (
                (a, right, top), (right, c, top))
            for triangle in triangles:
                center = sum(triangle, Vector()) / 3
                up_face(b, triangle, ground_material(i, j, center, center.z))
    for start, end, outward in boundary(columns, rows):
        top0, top1 = points[start], points[end]
        out_face(b, [top0, top1, Vector((top1.x, top1.y, BOTTOM)),
                     Vector((top0.x, top0.y, BOTTOM))], "earth", outward)
    corners = [(-HALF_X, -HALF_Y), (HALF_X, -HALF_Y), (HALF_X, HALF_Y),
               (-HALF_X, HALF_Y)]
    out_face(b, [Vector((x, y, BOTTOM)) for x, y in corners], "earth",
             Vector((0, 0, -1)))
    return b.finish()


def water_mesh(points, columns, rows):
    """Water over every cell that dips below the water line, as one welded
    mesh so the app can roll waves through it."""
    b = Builder("Water")
    verts = {}

    def vert(key):
        if key not in verts:
            p = points[key]
            verts[key] = b.bm.verts.new((p.x, p.y, WATER))
        return verts[key]

    wet = {(i, j) for i in range(columns) for j in range(rows)
           if min(points[i + di, j + dj].z for di in (0, 1)
                  for dj in (0, 1)) < WATER + 0.2}
    index = b.slot("water")
    for i, j in wet:
        face = b.bm.faces.new([vert((i, j)), vert((i + 1, j)),
                               vert((i + 1, j + 1)), vert((i, j + 1))])
        face.material_index = index
    # the cut through the water where the river leaves the diorama
    for start, end, outward in boundary(columns, rows):
        cell = (min(start[0], columns - 1), min(start[1], rows - 1))
        if cell in wet:
            p0, p1 = points[start], points[end]
            out_face(b, [Vector((p0.x, p0.y, WATER)),
                         Vector((p1.x, p1.y, WATER)),
                         Vector((p1.x, p1.y, min(p1.z, WATER))),
                         Vector((p0.x, p0.y, min(p0.z, WATER)))],
                     "water", outward)
    return b.finish()


def resample(points, step):
    result = []
    for a, b in zip(points, points[1:]):
        a, b = Vector(a), Vector(b)
        count = max(1, math.ceil((b - a).length / step))
        result += [a.lerp(b, k / count) for k in range(count)]
    return result + [Vector(points[-1])]


def ribbon(b, points, width, mat, lift):
    samples = resample(points, 3)
    edges = []
    for k, p in enumerate(samples):
        before = samples[max(k - 1, 0)]
        after = samples[min(k + 1, len(samples) - 1)]
        tangent = (after - before).normalized()
        side = Vector((-tangent.y, tangent.x)) * width / 2
        edges.append([Vector((q.x, q.y, ground(q.x, q.y) + lift))
                      for q in (p - side, p + side)])
    for (a0, a1), (b0, b1) in zip(edges, edges[1:]):
        up_face(b, [a0, a1, b1, b0], mat)


def plaza(b, center, half, lift):
    step = 3
    nx, ny = math.ceil(2 * half[0] / step), math.ceil(2 * half[1] / step)

    def point(i, j):
        x = center[0] - half[0] + 2 * half[0] * i / nx
        y = center[1] - half[1] + 2 * half[1] * j / ny
        return Vector((x, y, ground(x, y) + lift))

    for i in range(nx):
        for j in range(ny):
            up_face(b, [point(i, j), point(i + 1, j), point(i + 1, j + 1),
                        point(i, j + 1)], "plaza")


def streets():
    b = Builder("Roads")
    for name, points, width in STREETS:
        ribbon(b, points, width, "road", 0.12)
    for name, points, width in PATHS:
        ribbon(b, points, width, "gravel", 0.1)
    for _, x in BRIDGES:
        center, _, north, south = bridge_ends(x)
        for end, sign in ((north, 1), (south, -1)):
            ribbon(b, [end - (north - south).normalized() * 2 * sign,
                       end + (north - south).normalized() * 6 * sign],
                   8, "road", 0.12)
    for center, half in PLAZAS:
        plaza(b, center, half, 0.18)
    return b.finish()


def check_streets():
    """Fails the build on a street or path that ends nowhere: each end has to
    meet another street, a square or a bridge, or leave the diorama."""
    ways = STREETS + PATHS
    ends = [point for _, x in BRIDGES for point in bridge_ends(x)[2:]]
    dead = []
    for name, points, _ in ways:
        for end in (points[0], points[-1]):
            if abs(end[0]) >= HALF_X or abs(end[1]) >= HALF_Y:
                continue
            if any(rect_distance(end, center, half) < 1
                   for center, half in PLAZAS):
                continue
            if any(distance(end, point) < 6 for point in ends):
                continue
            if any(other != name and polyline_distance(end, others) <
                   width / 2 + 1 for other, others, width in ways):
                continue
            dead.append(f"{name} at {end}")
    for point in ends:
        if not any(polyline_distance(point, points) < width / 2 + 6
                   for _, points, width in ways):
            dead.append(f"bridge end at {tuple(point)}")
    if dead:
        raise ValueError("dead ends: " + ", ".join(dead))


# --- plan ------------------------------------------------------------------

class Plan:
    """Keeps the footprints taken so far, so markers don't overlap."""

    def __init__(self):
        self.rects = [(center, (hx + 2, hy + 2)) for _, center, _, (hx, hy)
                      in LANDMARKS]
        self.rects += [(center, (hx + 1, hy + 1)) for center, (hx, hy)
                       in PLAZAS]
        self.park = list(PARKS)
        self.taken = []
        self.roads = [points for _, points, _ in STREETS + PATHS]
        for _, x in BRIDGES:
            center, _, north, south = bridge_ends(x)
            self.roads.append([tuple(north + (north - south) * 0.3),
                               tuple(south - (north - south) * 0.3)])

    def free(self, p, radius, road_gap, park=False):
        """Whether a footprint fits; only park trees and benches may stand
        in the park."""
        if not (-HALF_X + 6 < p[0] < HALF_X - 6
                and -HALF_Y + 6 < p[1] < HALF_Y - 6):
            return False
        rects = self.rects if park else self.rects + self.park
        for (cx, cy), (hx, hy) in rects:
            if abs(p[0] - cx) < hx + radius and abs(p[1] - cy) < hy + radius:
                return False
        if any(distance(p, q) < r + radius for q, r in self.taken):
            return False
        if any(polyline_distance(p, road) < road_gap for road in self.roads):
            return False
        return (polyline_distance(p, RIVER) > RIVER_WIDTH / 2 + radius + 2
                and lake_distance(p) > 1.25)

    def take(self, p, radius):
        self.taken.append((p, radius))


def facing(house, target):
    """Rotation turning a model's front (-Y) towards target."""
    return math.atan2(target[0] - house[0], -(target[1] - house[1]))


def place_houses(plan, rng):
    count = 0

    def house(p, look_at, variants):
        nonlocal count
        if not plan.free(p, 4.6, 7.5) or slope(*p) > 0.3:
            return
        plan.take(p, 4.6)
        marker(f"House {count:03d}", (p[0], p[1], height(*p)),
               facing(p, look_at), model="houses", part=rng.choice(variants))
        count += 1

    # around the squares, facing in
    for (cx, cy), (hx, hy) in PLAZAS:
        for k in range(int(2 * hx / 10)):
            x = cx - hx + 5 + k * 10
            house((x, cy - hy - 5.5), (x, cy), CORE)
            house((x, cy + hy + 5.5), (x, cy), CORE)
        for k in range(int(2 * hy / 10)):
            y = cy - hy + 5 + k * 10
            house((cx - hx - 5.5, y), (cx, y), CORE)
            house((cx + hx + 5.5, y), (cx, y), CORE)
    # along both sides of the streets, facing them
    for name, points, width in STREETS:
        offset = width / 2 + 5.5
        for p in resample(points, 10)[1:-1]:
            k = min(range(len(points) - 1), key=lambda k: segment_distance(
                p, points[k], points[k + 1]))
            tangent = (Vector(points[k + 1]) - Vector(points[k])).normalized()
            normal = Vector((-tangent.y, tangent.x))
            core = distance(p, TOWN) < 110
            for side in (-1, 1):
                q = p + normal * side * offset
                house(tuple(q), tuple(p), CORE if core else OUTSKIRTS)
    # farms between the fields
    for _ in range(300):
        p = (rng.uniform(-HALF_X, HALF_X), rng.uniform(-HALF_Y, HALF_Y))
        if 150 < distance(p, TOWN) and haloze(p) < 0.2 and height(*p) < 8:
            house(p, (p[0] + rng.uniform(-1, 1), p[1] - 1), ("Farmhouse",))
    # vineyard cottages, looking down the slope
    placed = 0
    for _ in range(400):
        p = (rng.uniform(-HALF_X, HALF_X), rng.uniform(-HALF_Y, -110))
        if placed < 18 and is_vineyard(p) and plan.free(p, 4, 6):
            plan.take(p, 4)
            downhill = (p[0] - (height(p[0] + 1, p[1]) - height(p[0] - 1,
                                                                 p[1])),
                        p[1] - (height(p[0], p[1] + 1) - height(p[0],
                                                                  p[1] - 1)))
            marker(f"Zidanica {placed:02d}", (p[0], p[1], height(*p)),
                   facing(p, downhill), model="houses", part="Zidanica")
            placed += 1


def place_trees(plan, rng):
    count = 0

    def tree(p, variants, radius=2.5, park=False):
        nonlocal count
        if not plan.free(p, radius, 5 if not park else 3.5, park):
            return
        plan.take(p, radius)
        marker(f"Tree {count:03d}", (p[0], p[1], height(*p)),
               rng.uniform(0, 2 * math.pi), rng.uniform(0.8, 1.3),
               model="nature", part=rng.choice(variants))
        count += 1

    # forest on the castle hill
    for _ in range(900):
        a, d = rng.uniform(0, 2 * math.pi), rng.uniform(HILL_TOP + 4,
                                                        HILL_BASE - 4)
        tree((HILL[0] + d * math.cos(a), HILL[1] + d * math.sin(a)), TREES)
    # the riverside parks, with benches along their paths
    for (cx, cy), (hx, hy) in PARKS:
        for _ in range(int(hx * hy / 1.5)):
            tree((rng.uniform(cx - hx, cx + hx),
                  rng.uniform(cy - hy, cy + hy)),
                 ("TreeRound", "TreeDouble", "Bush", "Bush"), 2.2, True)
    benches = 0
    for _, points, width in PATHS:
        for p in resample(points, 7)[1:-1]:
            k = min(range(len(points) - 1), key=lambda k: segment_distance(
                p, points[k], points[k + 1]))
            tangent = (Vector(points[k + 1]) - Vector(points[k])).normalized()
            q = p + Vector((-tangent.y, tangent.x)) * (width / 2 + 0.8)
            if plan.free(tuple(q), 0.9, 1.5, True):
                plan.take(tuple(q), 1.2)
                marker(f"Bench {benches:02d}", (q.x, q.y, ground(q.x, q.y)),
                       facing(tuple(q), tuple(p)), model="nature",
                       part="Bench")
                benches += 1
    # poplars along the river and around the lake
    for side in (-1, 1):
        for p in resample(RIVER, 14):
            center, direction = river_at(min(max(p.x, -339), 329))
            q = center + Vector((-direction.y, direction.x)) * side * (
                RIVER_WIDTH / 2 + 7)
            if not (side > 0 and -30 < q.x < 200):
                tree(tuple(q), ("TreePoplar", "TreeRound"), 2)
    (cx, cy), (rx, ry) = LAKE
    for k in range(40):
        a = 2 * math.pi * k / 40
        tree((cx + 1.32 * rx * math.cos(a), cy + 1.32 * ry * math.sin(a)),
             ("TreePoplar", "TreeRound", "Bush"), 2)
    # woods on the hilltops of Haloze and Slovenske gorice, hedges between
    for _ in range(2500):
        p = (rng.uniform(-HALF_X, HALF_X), rng.uniform(-HALF_Y, HALF_Y))
        h = height(*p)
        if haloze(p) > 0.5 and h > 20 and not is_vineyard(p):
            tree(p, ("TreePine", "TreePine", "TreeRound"))
        elif p[1] > 130 and rng.random() < 0.3:
            tree(p, TREES)
        elif distance(p, TOWN) > 150 and rng.random() < 0.06:
            tree(p, ("TreeRound", "TreeDouble", "Bush"))


def place_landmarks():
    for model, (x, y), rotation, _ in LANDMARKS:
        marker(model.capitalize(), (x, y, height(x, y)), rotation, model=model)
    for k, (model, x) in enumerate(BRIDGES):
        center, direction, _, _ = bridge_ends(x)
        marker(f"Bridge {k}", (center.x, center.y, 0),
               math.atan2(direction.y, direction.x), model=model)


def parade():
    """The kurents' round as points every 2 m, each with its height (on the
    deck over a bridge) and half the width of the way there."""
    corners = []
    for point in PARADE:
        if isinstance(point, str):
            x = dict(BRIDGES)[point]
            _, _, north, south = bridge_ends(x)
            last = Vector(corners[-1])
            corners += sorted((north, south), key=lambda end: (end - last)
                              .length)
        else:
            corners.append(Vector(point))
    points = resample(corners + corners[:1], 2)[:-1]
    result = []
    for p in points:
        z, half = ground(p.x, p.y) + 0.15, STREET_HALF
        for model, x in BRIDGES:
            center, direction, _, _ = bridge_ends(x)
            across = Vector((-direction.y, direction.x))
            along = (p - center).dot(across)
            if (abs(along) <= BRIDGE_LENGTH / 2
                    and abs((p - center).dot(direction)) < WALK[model] / 2):
                z, half = deck_z(model, along), WALK[model] / 2
        result.append((p, z, half))
    # ease the width into and out of the narrow footbridge
    count = len(result)
    return [(p, z, sum(result[(k + d) % count][2] for d in range(-3, 4)) / 7)
            for k, (p, z, _) in enumerate(result)]


def place_paths():
    for k, (p, z, half) in enumerate(parade()):
        marker(f"Parade {k:03d}", (p.x, p.y, z), path="parade", index=k,
               width=round(half, 2))
    for k, p in enumerate(resample([(-HALF_X + 2, river_at(-HALF_X + 2)[0].y)]
                                   + [q for q in RIVER
                                      if abs(q[0]) < HALF_X - 2]
                                   + [(HALF_X - 2,
                                       river_at(HALF_X - 2)[0].y)], 20)):
        marker(f"River {k:02d}", (p.x, p.y, WATER), path="river", index=k)


def terrain():
    clear_scene()
    setup_scene()
    points, columns, rows = grid()
    terrain_mesh(points, columns, rows)
    water_mesh(points, columns, rows)
    check_streets()
    plan = Plan()
    streets()
    place_landmarks()
    rng = random.Random(1848)
    place_houses(plan, rng)
    place_trees(plan, rng)
    place_paths()
    bpy.context.view_layer.update()
