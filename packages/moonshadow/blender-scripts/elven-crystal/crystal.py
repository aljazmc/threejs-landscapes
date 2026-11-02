import math

from elven import elven_materials
from shooter import cylinder, clear_scene, joint, sphere, torus

EXPORT = "glb"

# The seeing crystal of the throne hall: a round stone table over which a
# great violet crystal floats and turns ("Spin" joints turn around their Z
# axis in the game), circled by rings of runes.


def crystal():
    clear_scene()
    m = elven_materials()
    cylinder("Pedestal", 0.4, 0.75, m["marble"], top=0.3, sides=16)
    cylinder("Table", 0.95, 0.12, m["stone"], location=(0, 0, 0.75), sides=24)
    torus("Rim", 0.95, 0.04, m["gold"], location=(0, 0, 0.87), segments=32)
    torus("Rune Ring", 0.8, 0.015, m["rune"], location=(0, 0, 0.88), segments=32, sides=4)
    spin = joint("Spin Crystal", location=(0, 0, 1.6))
    cylinder("Crystal Top", 0.25, 0.5, m["crystal"], spin, top=0.0, sides=6, smooth=False)
    cylinder("Crystal Bottom", 0.25, 0.4, m["crystal"], spin, rotation=(180, 0, 0), top=0.0, sides=6,
             smooth=False)
    ring = joint("Spin- Runes", location=(0, 0, 1.6))
    for index in range(8):
        angle = 2 * math.pi * index / 8
        sphere(f"Glyph {index}", 0.04, m["rune"], ring, (0.6 * math.cos(angle), 0.6 * math.sin(angle), 0),
               subdivisions=1)
    torus("Orbit", 0.6, 0.006, m["moon"], ring, segments=32, sides=4)
