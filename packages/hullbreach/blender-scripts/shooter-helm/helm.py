import math

from shooter import (box, button_grid, clear_scene, cylinder, gauge, joint,
                     ship_materials, sphere, torus)

EXPORT = "glb"

# The helm in front of the bow window: a horseshoe of consoles around the
# flight yoke, with a tall navigation screen and throttle levers. The pilot
# stands at -Y and looks towards +Y (the game turns it to face the bow).


def helm():
    clear_scene()
    m = ship_materials()
    for index, angle in enumerate((-55, 0, 55)):
        wing = joint(f"Wing {index}", location=(0, 0.3, 0))
        wing.rotation_euler = (0, 0, math.radians(angle))
        box("Body", (1.0, 0.7, 0.85), m["hull"], wing, (0, 0.55, 0.42), bevel=0.03)
        top = joint("Top", wing, (0, 0.45, 0.9))
        top.rotation_euler = (0.4, 0, 0)
        box("Plate", (1.0, 0.6, 0.05), m["dark"], top)
        button_grid(f"Buttons {index}", 8, 4, 0.08, 0.05,
                    [m["cyan"], m["dark"], m["amber"], m["magenta"], m["green"]], top,
                    (0, 0, 0.035))
        box("Strip", (0.96, 0.02, 0.025), m["cyan"], wing, (0, 0.19, 0.8))

    # yoke on a column in the middle
    cylinder("Column", 0.06, 0.95, m["dark"], location=(0, 0.2, 0))
    yoke = joint("Yoke", location=(0, 0.12, 1.0))
    yoke.rotation_euler = (math.radians(70), 0, 0)
    torus("Wheel", 0.17, 0.022, m["black"], yoke, segments=20)
    box("Wheel Bar", (0.34, 0.03, 0.03), m["light"], yoke)
    for x in (-0.17, 0.17):
        sphere("Trigger", 0.025, m["red"], yoke, (x, 0, 0.03))

    # navigation screen over the middle console
    nav = joint("Nav", location=(0, 1.05, 1.15))
    nav.rotation_euler = (math.radians(-15), 0, 0)
    box("Nav Frame", (1.2, 0.06, 0.7), m["dark"], nav, (0, 0, 0.35), bevel=0.02)
    box("Nav Picture", (1.1, 0.01, 0.6), m["screen"], nav, (0, -0.032, 0.35))
    torus("Nav Ring", 0.2, 0.008, m["cyan"], nav, (0, -0.04, 0.35),
          rotation=(90, 0, 0), segments=24, sides=4)
    box("Nav Cross H", (0.5, 0.004, 0.006), m["cyan"], nav, (0, -0.04, 0.35))
    box("Nav Cross V", (0.006, 0.004, 0.5), m["cyan"], nav, (0, -0.04, 0.35))
    sphere("Blip", 0.025, m["red"], nav, (0.12, -0.04, 0.42))
    sphere("Blip 2", 0.02, m["amber"], nav, (-0.08, -0.04, 0.27))

    for index, x in enumerate((-0.32, -0.26, 0.26, 0.32)):
        lever = joint(f"Throttle {index}", location=(x, 0.2, 0.85))
        lever.rotation_euler = (math.radians(-20 + 12 * index), 0, 0)
        cylinder("Rod", 0.012, 0.2, m["light"], lever)
        sphere("Knob", 0.03, m["magenta"] if index % 2 else m["amber"], lever, (0, 0, 0.2))
    gauge("Speed", 0.08, m["black"], m["cyan"], None, (-0.18, 0.28, 0.98),
          rotation=(50, 0, 0))
    gauge("Fuel", 0.08, m["black"], m["amber"], None, (0.18, 0.28, 0.98),
          rotation=(50, 0, 0), angle=-50)
