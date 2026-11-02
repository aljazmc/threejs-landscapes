import math

from gothic import gothic_materials
from shooter import box, clear_scene, cylinder, sphere, tube

EXPORT = "glb"

# A suit of black plate armor on a stand in a corner of the ballroom, a
# halberd in its hand and a torn banner behind it, facing -Y.


def armor():
    clear_scene()
    m = gothic_materials()
    plate = m["iron"]
    box("Plinth", (1.0, 1.0, 0.25), m["darkstone"], location=(0, 0, 0.125), bevel=0.03)
    for x in (-0.12, 0.12):
        cylinder("Greave", 0.075, 0.55, plate, location=(x, 0, 0.25), top=0.065, sides=10)
        sphere("Knee", 0.075, plate, location=(x, -0.02, 0.82))
        cylinder("Cuisse", 0.08, 0.4, plate, location=(x, 0, 0.82), top=0.095, sides=10)
        box("Sabaton", (0.11, 0.24, 0.08), plate, location=(x, -0.05, 0.29), bevel=0.03)
    cylinder("Fauld", 0.2, 0.2, plate, location=(0, 0, 1.18), top=0.22, sides=12)
    cylinder("Breastplate", 0.22, 0.45, plate, location=(0, 0, 1.38), top=0.27, sides=12, scale=(1, 0.75, 1))
    box("Ridge", (0.02, 0.03, 0.4), m["silver"], location=(0, -0.2, 1.6))
    for side in (1, -1):
        sphere("Pauldron", 0.13, plate, location=(side * 0.3, 0, 1.8), scale=(1, 1, 0.75))
        tube("Arm", [(side * 0.32, 0, 1.75), (side * 0.36, -0.05, 1.45), (side * 0.3, -0.18, 1.25)],
             0.06, plate, sides=8)
        sphere("Gauntlet", 0.065, plate, location=(side * 0.3, -0.2, 1.24))
    cylinder("Gorget", 0.1, 0.1, plate, location=(0, 0, 1.83), sides=10)
    sphere("Helm", 0.15, plate, location=(0, 0, 2.03), scale=(0.9, 1, 1.1))
    box("Visor", (0.18, 0.05, 0.03), m["marble"], location=(0, -0.14, 2.05))
    for k in range(3):
        box(f"Crest {k}", (0.02, 0.1, 0.06), m["velvet"], location=(0, 0.03 * k - 0.03, 2.2 + 0.03 * (1 - abs(k - 1))))
    sphere("Eye Glow", 0.015, m["evil"], location=(0.04, -0.16, 2.05))
    sphere("Eye Glow 2", 0.015, m["evil"], location=(-0.04, -0.16, 2.05))
    cylinder("Halberd", 0.02, 2.6, m["oak"], location=(0.3, -0.2, 0.25), sides=6)
    box("Halberd Blade", (0.02, 0.25, 0.3), m["silver"], location=(0.3, -0.3, 2.6), bevel=0.01)
    cylinder("Halberd Spike", 0.03, 0.3, m["silver"], location=(0.3, -0.2, 2.85), top=0.0, sides=4)
    box("Banner Pole", (0.9, 0.04, 0.04), m["iron"], location=(0, 0.4, 2.6))
    for k in range(5):
        x = -0.36 + 0.18 * k
        box(f"Banner {k}", (0.17, 0.02, 1.0 - 0.15 * (k % 2) - 0.1 * (k == 3)), m["velvet"],
            location=(x, 0.4, 2.1 + 0.075 * (k % 2) + 0.05 * (k == 3)), rotation=(0, math.sin(k) * 3, 0))
