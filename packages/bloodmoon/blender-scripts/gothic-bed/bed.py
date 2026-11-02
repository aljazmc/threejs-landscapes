import math

from gothic import cobweb, gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, cylinder, sphere, tube

EXPORT = "glb"

# Four-poster bed of a bedchamber, 2.6 m long along X, its head against the
# wall (+Y), the open side towards -Y: black oak, blood red hangings, torn
# grey sheets and cobwebs between the posts.


def bed():
    clear_scene()
    m = gothic_materials()
    box("Frame", (2.5, 1.5, 0.35), m["ebony"], location=(0, 0.1, 0.3), bevel=0.04)
    box("Mattress", (2.4, 1.4, 0.2), m["linen"], location=(0, 0.1, 0.55), bevel=0.06)
    box("Cover", (1.7, 1.46, 0.08), m["velvet"], location=(0.35, 0.1, 0.66), bevel=0.03)
    for y in (-0.25, 0.35):
        box("Pillow", (0.4, 0.5, 0.15), m["linen"], location=(-0.95, y, 0.72), bevel=0.06)
    box("Headboard", (0.1, 1.5, 1.2), m["oak"], location=(-1.25, 0.1, 1.0), bevel=0.03)
    pointed_arch("Head Arch", None, 1.1, 0.9, 0.02, m["iron"], (-1.32, 0.1, 0.6), rotation=(0, 0, 90))
    for x in (-1.2, 1.2):
        for y in (-0.6, 0.8):
            cylinder("Post", 0.06, 2.4, m["oak"], location=(x, y, 0), sides=6)
            spire("Finial", None, 0.35, 0.05, m["iron"], (x, y, 2.4))
    box("Canopy", (2.5, 1.5, 0.05), m["velvet"], location=(0, 0.1, 2.4))
    for x in (-1.2, 1.2):
        tube("Drape", [(x, -0.6, 2.38), (x + 0.08 * math.copysign(1, x), -0.55, 1.6), (x, -0.62, 0.9)],
             0.07, m["velvet"], sides=6)
    cobweb("Web", None, m, (1.2, -0.6, 2.35), 0.5, rotation=(0, 0, 0))
    box("Blood Stain", (0.35, 0.25, 0.005), m["blood"], location=(0.1, -0.1, 0.705), rotation=(0, 0, 20))
