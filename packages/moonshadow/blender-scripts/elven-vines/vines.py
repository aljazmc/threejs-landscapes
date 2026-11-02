import math
import random

from elven import elven_materials, leaf_cluster
from shooter import box, clear_scene, sphere, tube

EXPORT = "glb"

# A trellis against the wall (+Y) overgrown with vines, flowers and little
# glowing moth lights, 2 m wide and up to 6 m high.


def vines():
    clear_scene()
    m = elven_materials()
    rng = random.Random(3)
    for x in (-0.9, 0, 0.9):
        box("Post", (0.06, 0.06, 6.0), m["wood"], location=(x, 0.4, 3.0))
    for z in range(1, 6):
        box("Rail", (1.9, 0.05, 0.04), m["wood"], location=(0, 0.4, z * 1.0))
    for index in range(4):
        x0 = rng.uniform(-0.8, 0.8)
        points = [(x0 + 0.25 * math.sin(t * 9 + index), 0.32, t * 5.8) for t in (i / 14 for i in range(15))]
        tube(f"Vine {index}", points, 0.03, m["darkleaf"], sides=5)
        for k in range(2, 15, 2):
            leaf_cluster(f"Leaves {index} {k}", None, points[k], 0.14, [m["leaf"], m["darkleaf"]], 3, index * 20 + k)
            if k % 4 == 0:
                sphere(f"Flower {index} {k}", 0.05, m["blossom"], location=(points[k][0], 0.25, points[k][2]))
    for k in range(5):
        sphere(f"Moth {k}", 0.035, m["moon"], location=(rng.uniform(-0.8, 0.8), 0.15, rng.uniform(1, 5.5)),
               subdivisions=1)
