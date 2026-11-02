import math

from elven import elven_materials, filigree_arch
from shooter import clear_scene, cylinder, joint, sphere, torus

EXPORT = "glb"

# Moonwell in the far corner of the grove hall: a round well of white stone
# full of glowing silver water under a gold arch, with lights rising from it
# ("Pump" joints bob up and down in the game).


def well():
    clear_scene()
    m = elven_materials()
    cylinder("Wall", 0.9, 0.8, m["marble"], sides=24)
    torus("Rim", 0.9, 0.08, m["stone"], location=(0, 0, 0.8), segments=32)
    cylinder("Moonwater", 0.8, 0.03, m["moon"], location=(0, 0, 0.72), sides=24)
    for index in range(8):
        a = 2 * math.pi * index / 8
        sphere(f"Rune {index}", 0.04, m["rune"], location=(0.92 * math.cos(a), 0.92 * math.sin(a), 0.45),
               subdivisions=1)
    filigree_arch("Arch", None, 1.6, 1.8, m["gold"], (0, 0, 0.8))
    sphere("Lantern", 0.08, m["moon"], location=(0, 0, 2.55))
    for index in range(2):
        pump = joint(f"Pump {index}", location=(0.3 * (1 - 2 * index), 0.1, 1.3))
        sphere(f"Light {index}", 0.06, m["moon"], pump, subdivisions=1)
