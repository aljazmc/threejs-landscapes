import math

from shooter import (box, clear_scene, cylinder, joint, ship_materials, torus,
                     tube)

EXPORT = "glb"

# Ion turbine lying along X: a housing open at the front (-Y) so the fan
# turning inside is seen ("Spin" turns around its Z axis, which the joint
# lays along the turbine's axis), on a cradle. About 4 m long.


def turbine():
    clear_scene()
    m = ship_materials()
    for x in (-1.3, 1.3):
        box("Cradle", (0.4, 2.2, 0.9), m["dark"], location=(x, 0, 0.45), bevel=0.04)
    axis = joint("Axis", location=(0, 0, 1.6))
    axis.rotation_euler = (0, math.radians(90), 0)
    cylinder("Housing Back", 1.2, 3.6, m["hull"], axis, (0, 0, -1.8), sides=24)
    for z in (-1.7, -0.6, 0.6, 1.7):
        torus(f"Hoop {z}", 1.22, 0.06, m["light"], axis, (0, 0, z), segments=32)
    torus("Hoop Neon", 1.24, 0.025, m["cyan"], axis, (0, 0, 0), segments=32, sides=4)
    cylinder("Nozzle", 1.2, 0.8, m["dark"], axis, (0, 0, 1.8), top=0.7, sides=24)
    cylinder("Exhaust", 0.68, 0.05, m["violet"], axis, (0, 0, 2.6), sides=24)
    cylinder("Intake", 1.1, 0.05, m["black"], axis, (0, 0, -1.85), sides=24)
    spin = joint("Spin+ Fan", axis, (0, 0, -1.9))
    cylinder("Hub", 0.25, 0.3, m["brass"], spin, (0, 0, -0.15), top=0.1, sides=12)
    for index in range(10):
        angle = 360 * index / 10
        blade = joint(f"Blade {index}", spin)
        blade.rotation_euler = (0, 0, math.radians(angle))
        box(f"Blade Plate {index}", (0.18, 0.9, 0.03), m["light"], blade, (0, 0.6, 0),
            rotation=(0, 30, 0))
    tube("Feed", [(-1.8, 0.4, 2.6), (-1.0, 0.4, 3.1), (0.5, 0.4, 3.0), (1.6, 0.4, 2.7)],
         0.1, m["brass"], sides=8)
    for x in (-1.5, -0.5, 0.5, 1.5):
        box(f"Vent {x}", (0.3, 0.05, 0.08), m["amber"], None, (x, -1.0, 0.75))
