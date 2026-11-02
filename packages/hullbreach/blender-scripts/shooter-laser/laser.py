import math

from shooter import (box, clear_scene, cylinder, joint, material, ship_materials,
                     sphere, torus)

EXPORT = "glb"

# The commando's laser gun as seen in first person: a sleek carbine with
# its barrel along -Y, glowing focusing coils and a power cell. The empty
# "Muzzle" marks where the beam leaves it; the origin is at the grip.


def laser():
    clear_scene()
    m = ship_materials()
    body = material("Gun Body", "#2a2f3c", 0.35, 0.8)
    plate = material("Gun Plate", "#c9ced8", 0.3, 0.9)
    box("Receiver", (0.08, 0.36, 0.1), body, location=(0, -0.05, 0.08), bevel=0.012)
    box("Top Rail", (0.04, 0.3, 0.02), plate, location=(0, -0.05, 0.14))
    box("Side Plate", (0.084, 0.2, 0.05), plate, location=(0, -0.08, 0.06), bevel=0.008)
    box("Grip", (0.05, 0.07, 0.14), body, location=(0, 0.06, -0.02), rotation=(-15, 0, 0),
        bevel=0.01)
    box("Trigger Guard", (0.012, 0.09, 0.012), plate, location=(0, 0.0, 0.0))
    box("Stock", (0.06, 0.18, 0.08), body, location=(0, 0.2, 0.07), bevel=0.012)
    box("Cell", (0.05, 0.08, 0.05), m["cyan"], location=(0, 0.1, 0.03))
    barrel = joint("Barrel", location=(0, -0.23, 0.08))
    barrel.rotation_euler = (math.radians(90), 0, 0)  # +Z of the barrel is -Y
    cylinder("Barrel Tube", 0.022, 0.32, body, barrel, sides=12)
    for index in range(4):
        torus(f"Coil {index}", 0.032, 0.008, m["cyan"], barrel, (0, 0, 0.04 + 0.06 * index),
              segments=16, sides=4)
    cylinder("Emitter", 0.03, 0.04, plate, barrel, (0, 0, 0.3), top=0.02, sides=12)
    sphere("Lens", 0.016, m["white"], barrel, (0, 0, 0.345), subdivisions=1)
    box("Sight", (0.03, 0.06, 0.035), body, location=(0, -0.08, 0.17))
    box("Sight Glow", (0.02, 0.005, 0.02), m["magenta"], location=(0, -0.111, 0.17))
    joint("Muzzle", location=(0, -0.58, 0.08))
