import math

from shooter import (box, clear_scene, cylinder, joint, material, ship_materials,
                     sphere, torus)

EXPORT = "glb"

# The grenade launcher in first person: a heavy revolving drum of six
# grenades, a fat short barrel along -Y with magenta warning glow. The drum
# ("Drum", turning around the barrel axis in the game after each shot) and
# the "Muzzle" empty are named; the origin is at the grip.


def launcher():
    clear_scene()
    m = ship_materials()
    body = material("Launcher Body", "#3a3428", 0.5, 0.6)
    plate = material("Launcher Plate", "#d7a72a", 0.4, 0.7)
    box("Frame", (0.1, 0.4, 0.1), body, location=(0, 0.0, 0.07), bevel=0.015)
    box("Grip", (0.055, 0.075, 0.15), body, location=(0, 0.08, -0.04), rotation=(-15, 0, 0),
        bevel=0.012)
    box("Fore Grip", (0.05, 0.06, 0.12), body, location=(0, -0.2, -0.02), bevel=0.012)
    box("Stock", (0.07, 0.16, 0.1), body, location=(0, 0.25, 0.06), bevel=0.015)
    box("Hazard", (0.104, 0.12, 0.03), plate, location=(0, 0.2, 0.1))
    axis = joint("Drum Axis", location=(0, -0.05, 0.08))
    axis.rotation_euler = (math.radians(90), 0, 0)
    drum = joint("Drum", axis)
    cylinder("Drum Body", 0.095, 0.16, body, drum, (0, 0, -0.08), sides=6, smooth=False)
    for index in range(6):
        angle = 2 * math.pi * index / 6 + math.pi / 6
        x, y = 0.06 * math.cos(angle), 0.06 * math.sin(angle)
        cylinder(f"Chamber {index}", 0.028, 0.165, m["dark"], drum, (x, y, -0.083), sides=8)
        sphere(f"Grenade Tip {index}", 0.022, m["magenta"], drum, (x, y, 0.085),
               subdivisions=1)
    barrel = joint("Barrel", location=(0, -0.13, 0.11))
    barrel.rotation_euler = (math.radians(90), 0, 0)
    cylinder("Barrel Tube", 0.045, 0.3, body, barrel, sides=12)
    torus("Muzzle Ring", 0.048, 0.012, plate, barrel, (0, 0, 0.29), segments=16, sides=4)
    torus("Glow Ring", 0.047, 0.008, m["magenta"], barrel, (0, 0, 0.12), segments=16, sides=4)
    box("Sight", (0.025, 0.05, 0.06), body, location=(0, -0.2, 0.18))
    box("Sight Glow", (0.016, 0.004, 0.016), m["amber"], location=(0, -0.226, 0.195))
    joint("Muzzle", location=(0, -0.45, 0.11))
