import math

from elven import elven_materials, filigree_arch
from shooter import box, clear_scene, cylinder, sphere, tube

EXPORT = "glb"

# Canopy bed of a guest chamber, 2.6 m long along X, its head against the
# wall (+Y), the open side towards -Y.


def bed():
    clear_scene()
    m = elven_materials()
    box("Frame", (2.5, 1.5, 0.35), m["wood"], location=(0, 0.1, 0.3), bevel=0.04)
    box("Mattress", (2.4, 1.4, 0.2), m["linen"], location=(0, 0.1, 0.55), bevel=0.06)
    box("Cover", (1.7, 1.46, 0.08), m["green velvet"], location=(0.35, 0.1, 0.66), bevel=0.03)
    for y in (-0.25, 0.35):
        box("Pillow", (0.4, 0.5, 0.15), m["linen"], location=(-0.95, y, 0.72), bevel=0.06)
    box("Headboard", (0.1, 1.5, 1.0), m["darkwood"], location=(-1.25, 0.1, 0.9), bevel=0.03)
    filigree_arch("Head Arch", None, 1.2, 0.6, m["gold"], (-1.32, 0.1, 0.9), rotation=(0, 0, 90))
    for x in (-1.2, 1.2):
        for y in (-0.6, 0.8):
            cylinder("Post", 0.05, 2.4, m["wood"], location=(x, y, 0), sides=8)
            sphere("Finial", 0.07, m["gold"], location=(x, y, 2.45))
    box("Canopy", (2.5, 1.5, 0.05), m["velvet"], location=(0, 0.1, 2.4))
    for x in (-1.2, 1.2):
        tube("Drape", [(x, -0.6, 2.38), (x + 0.05, -0.55, 1.6), (x, -0.62, 0.9)], 0.06,
             m["velvet"], sides=6)
    box("Rune Strip", (2.3, 0.02, 0.03), m["rune"], location=(0, -0.62, 0.42))
