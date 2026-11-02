import math

from elven import elven_materials
from shooter import box, clear_scene, cylinder, joint, sphere, tube

EXPORT = "glb"

# Marble statue of an elven guardian holding a spear, on a plinth, facing -Y.


def statue():
    clear_scene()
    m = elven_materials()
    s = m["marble"]
    box("Plinth", (0.9, 0.9, 0.6), m["stone"], location=(0, 0, 0.3), bevel=0.04)
    box("Plinth Band", (0.92, 0.92, 0.05), m["gold"], location=(0, 0, 0.5))
    body = joint("Figure", location=(0, 0, 0.6))
    for x in (-0.1, 0.1):
        cylinder("Leg", 0.07, 0.9, s, body, (x, 0, 0), top=0.08, sides=10)
    cylinder("Robe", 0.3, 1.0, s, body, (0, 0, 0.1), top=0.18, sides=14)
    cylinder("Chest", 0.18, 0.45, s, body, (0, 0, 1.0), top=0.2, sides=12, scale=(1, 0.7, 1))
    sphere("Head", 0.12, s, body, (0, 0, 1.62))
    for side in (1, -1):
        cylinder("Ear", 0.025, 0.14, s, body, (side * 0.11, 0.02, 1.64), rotation=(0, side * -70, 0), top=0.0,
                 sides=5)
    tube("Hair", [(0, 0.08, 1.7), (0, 0.15, 1.5), (0, 0.17, 1.25)], 0.08, s)
    tube("Spear Arm", [(0.2, 0, 1.38), (0.28, -0.12, 1.15), (0.25, -0.2, 1.2)], 0.045, s, body)
    cylinder("Spear", 0.02, 2.4, s, body, (0.25, -0.2, 0.0), sides=6)
    cylinder("Spear Head", 0.05, 0.25, m["gold"], body, (0.25, -0.2, 2.4), top=0.0, sides=6)
    tube("Shield Arm", [(-0.2, 0, 1.38), (-0.3, -0.1, 1.15)], 0.045, s, body)
    cylinder("Shield", 0.3, 0.04, s, body, (-0.32, -0.16, 1.1), rotation=(80, 0, 20), sides=16)
    sphere("Shield Gem", 0.05, m["rune"], body, (-0.33, -0.2, 1.1))
