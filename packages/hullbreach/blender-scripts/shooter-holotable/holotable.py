import math

from shooter import (box, clear_scene, cylinder, joint, material, ship_materials,
                     sphere, torus)

EXPORT = "glb"

# Round star map table in the middle of the control room: a hologram of a
# planet with its rings and moons turns above it ("Spin" joints turn around
# their Z axis in the game).


def holotable():
    clear_scene()
    m = ship_materials()
    cylinder("Pedestal", 0.45, 0.75, m["hull"], top=0.35, sides=16)
    cylinder("Table", 0.95, 0.12, m["dark"], location=(0, 0, 0.75), sides=24)
    torus("Rim", 0.95, 0.04, m["light"], location=(0, 0, 0.87), segments=32)
    torus("Neon Rim", 0.88, 0.015, m["cyan"], location=(0, 0, 0.88), segments=32, sides=4)
    cylinder("Emitter", 0.35, 0.03, m["cyan"], location=(0, 0, 0.87), sides=20)
    for index in range(8):
        angle = 2 * math.pi * index / 8
        box(f"Key {index}", (0.12, 0.06, 0.02), m["magenta"] if index % 2 else m["amber"],
            None, (0.72 * math.cos(angle), 0.72 * math.sin(angle), 0.88),
            rotation=(0, 0, math.degrees(angle) + 90))

    holo = material("Hologram", "#3fd8ff", emission=3.0)
    holo2 = material("Hologram Pink", "#ff5ae0", emission=3.0)
    spin = joint("Spin Globe", location=(0, 0, 1.55))
    sphere("Planet", 0.3, holo, spin, subdivisions=2)
    torus("Planet Ring", 0.5, 0.012, holo2, spin, rotation=(20, 0, 0), sides=4)
    torus("Planet Ring 2", 0.58, 0.008, holo, spin, rotation=(20, 0, 0), sides=4)
    for index in range(3):
        angle = 2 * math.pi * index / 3
        sphere(f"Moon {index}", 0.05, holo2, spin,
               (0.75 * math.cos(angle), 0.75 * math.sin(angle), 0.1 * (index - 1)),
               subdivisions=1)
    for index in range(6):
        angle = 2 * math.pi * index / 6
        cylinder(f"Beam {index}", 0.006, 0.55, holo, None,
                 (0.3 * math.cos(angle), 0.3 * math.sin(angle), 0.9), sides=4)
