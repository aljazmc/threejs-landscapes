"""Reading and projecting the OpenStreetMap data of Ptuj: positions in meters
east (x) and north (y) of the town hall on Mestni trg."""
import json
import math
import os

LAT0, LON0 = 46.41952, 15.87201  # Mestna hiša, the town hall
KX = 111320 * math.cos(math.radians(LAT0))
KY = 111150


def project(lon, lat):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


def load(directory, name):
    with open(os.path.join(directory, name)) as file:
        return json.load(file)


def way_points(element):
    return [project(g["lon"], g["lat"]) for g in element["geometry"]]


def rings(relation):
    """Joins the member ways of a multipolygon into closed outer and inner
    rings of points."""
    result = []
    for role in ("outer", "inner"):
        parts = [[(g["lon"], g["lat"]) for g in member["geometry"]]
                 for member in relation["members"]
                 if member["role"] == role and member.get("geometry")]
        while parts:
            ring = parts.pop()
            while ring[0] != ring[-1]:
                for k, part in enumerate(parts):
                    if part[0] == ring[-1]:
                        ring += part[1:]
                    elif part[-1] == ring[-1]:
                        ring += part[::-1][1:]
                    elif part[-1] == ring[0]:
                        ring = part + ring[1:]
                    elif part[0] == ring[0]:
                        ring = part[::-1] + ring[1:]
                    else:
                        continue
                    parts.pop(k)
                    break
                else:
                    break  # left open where the data is cut off
            result.append((role, [project(*p) for p in ring]))
    return result


def simplify(points, tolerance):
    """Douglas-Peucker."""
    if len(points) < 3:
        return list(points)
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy) or 1e-9
    worst, index = 0.0, 0
    for k in range(1, len(points) - 1):
        px, py = points[k]
        if length > 1e-6:
            d = abs(dy * (px - ax) - dx * (py - ay)) / length
        else:
            d = math.hypot(px - ax, py - ay)
        if d > worst:
            worst, index = d, k
    if worst <= tolerance:
        return [points[0], points[-1]]
    return (simplify(points[:index + 1], tolerance)[:-1]
            + simplify(points[index:], tolerance))


def inside(p, ring):
    x, y = p
    result = False
    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            result = not result
    return result
