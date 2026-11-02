import math
import random

from elven import elven_materials, leaf_cluster
from shooter import clear_scene, cylinder, joint, sphere, torus, tube

EXPORT = "glb"

# The great silver tree in the middle of the grove hall, about 6.5 m tall,
# in a ring of white stone; glowing blossoms and lights circle its crown
# ("Spin" joints turn around their Z axis in the game).


def tree():
    clear_scene()
    m = elven_materials()
    rng = random.Random(9)
    cylinder("Ring", 2.1, 0.45, m["marble"], sides=32)
    torus("Ring Rim", 2.05, 0.06, m["gold"], location=(0, 0, 0.45), segments=40)
    torus("Ring Runes", 1.9, 0.02, m["rune"], location=(0, 0, 0.47), segments=40, sides=4)
    cylinder("Soil", 1.95, 0.05, m["darkleaf"], location=(0, 0, 0.42), sides=32)
    # the trunk: a twist of tubes
    for index in range(5):
        a = 2 * math.pi * index / 5
        points = [(0.45 * math.cos(a + t * 2.5) * (1 - t * 0.6), 0.45 * math.sin(a + t * 2.5) * (1 - t * 0.6),
                   0.3 + 3.6 * t) for t in (i / 8 for i in range(9))]
        tube(f"Trunk {index}", points, lambda t: 0.28 * (1 - t * 0.6), m["bark"], sides=8)
    for index in range(4):
        a = 2 * math.pi * index / 4 + 0.4
        tube(f"Root {index}", [(0.2 * math.cos(a), 0.2 * math.sin(a), 0.9), (1.0 * math.cos(a), 1.0 * math.sin(a), 0.6),
                               (1.6 * math.cos(a), 1.6 * math.sin(a), 0.48)], lambda t: 0.2 * (1 - t) + 0.04,
             m["bark"], sides=6)
    for index in range(7):
        a = 2 * math.pi * index / 7
        reach = rng.uniform(1.6, 2.4)
        end = (reach * math.cos(a), reach * math.sin(a), rng.uniform(4.6, 5.6))
        tube(f"Bough {index}", [(0, 0, 3.6), (end[0] * 0.5, end[1] * 0.5, end[2] - 0.3), end],
             lambda t: 0.16 * (1 - t) + 0.03, m["bark"], sides=6)
        leaf_cluster(f"Crown {index}", None, end, 0.7, [m["silver"], m["leaf"], m["blossom"]], 6, index)
    leaf_cluster("Top", None, (0, 0, 5.9), 0.9, [m["silver"], m["leaf"], m["blossom"]], 8, 99)
    for k, (z, r, sign) in enumerate(((3.0, 2.3, "+"), (4.6, 2.9, "-"))):
        spin = joint(f"Spin{sign} Wisps {k}", location=(0, 0, z))
        for index in range(6):
            a = 2 * math.pi * index / 6
            sphere(f"Wisp {k} {index}", 0.08, m["moon"], spin, (r * math.cos(a), r * math.sin(a),
                                                                  0.3 * math.sin(index * 2)), subdivisions=1)
