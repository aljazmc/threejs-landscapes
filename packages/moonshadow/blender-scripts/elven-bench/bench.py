from elven import elven_materials
from shooter import box, clear_scene, cylinder

EXPORT = "glb"

# Carved bench with a high back, facing -Y.


def bench():
    clear_scene()
    m = elven_materials()
    box("Seat", (1.4, 0.45, 0.06), m["wood"], location=(0, 0, 0.45), bevel=0.015)
    box("Cushion", (1.3, 0.4, 0.05), m["green velvet"], location=(0, -0.01, 0.5), bevel=0.02)
    box("Back", (1.4, 0.06, 0.6), m["darkwood"], location=(0, 0.22, 0.85), bevel=0.02)
    box("Back Trim", (1.3, 0.02, 0.03), m["gold"], location=(0, 0.185, 1.1))
    for x in (-0.65, 0.65):
        for y in (-0.18, 0.18):
            cylinder("Leg", 0.03, 0.43, m["darkwood"], location=(x, y, 0), sides=6)
