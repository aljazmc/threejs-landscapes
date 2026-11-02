import math

from shooter import box, clear_scene, cylinder, joint, ship_materials, sphere, torus

EXPORT = "glb"

# Sensor station in a corner of the control room: a radar screen desk under
# a turning scanner dish ("Spin" turns around Z in the game).


def scanner():
    clear_scene()
    m = ship_materials()
    cylinder("Base", 0.7, 0.9, m["hull"], top=0.6, sides=8)
    cylinder("Screen", 0.55, 0.03, m["screen2"], location=(0, 0, 0.9), sides=24)
    for radius in (0.18, 0.36, 0.52):
        torus(f"Range {radius}", radius, 0.006, m["green"], location=(0, 0, 0.935),
              segments=24, sides=4)
    box("Sweep", (0.5, 0.01, 0.01), m["green"], location=(0.25, 0, 0.94),
        rotation=(0, 0, 30))
    for index, (x, y) in enumerate(((0.2, 0.1), (-0.3, 0.25), (0.1, -0.4))):
        sphere(f"Contact {index}", 0.025, m["red"], location=(x, y, 0.94), subdivisions=1)
    cylinder("Mast", 0.06, 1.3, m["dark"], location=(0, 0, 0.9))
    spin = joint("Spin Dish", location=(0, 0, 2.2))
    dish = joint("Dish", spin)
    dish.rotation_euler = (math.radians(60), 0, 0)
    cylinder("Dish Shell", 0.45, 0.12, m["light"], dish, top=0.1, sides=16)
    cylinder("Horn", 0.02, 0.35, m["hull"], dish, (0, 0, 0.1))
    sphere("Horn Tip", 0.04, m["red"], dish, (0, 0, 0.45))
    torus("Dish Neon", 0.42, 0.015, m["cyan"], dish, (0, 0, 0.11), sides=4)
