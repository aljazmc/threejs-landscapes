import math

from shooter import box, clear_scene, cylinder, joint, ship_materials, torus

EXPORT = "glb"

# Swivel chair of the pilots, facing -Y.


def chair():
    clear_scene()
    m = ship_materials()
    for index in range(5):
        angle = 2 * math.pi * index / 5
        foot = joint(f"Foot {index}", location=(0, 0, 0.06))
        foot.rotation_euler = (0, 0, angle)
        box("Leg", (0.05, 0.32, 0.04), m["dark"], foot, (0, 0.16, 0))
    cylinder("Post", 0.04, 0.42, m["light"], location=(0, 0, 0.06))
    box("Seat", (0.56, 0.54, 0.1), m["fabric"], location=(0, 0, 0.5), bevel=0.04)
    back = joint("Back", location=(0, 0.25, 0.52))
    back.rotation_euler = (math.radians(-12), 0, 0)
    box("Back Rest", (0.52, 0.1, 0.7), m["fabric"], back, (0, 0.04, 0.38), bevel=0.04)
    box("Head Rest", (0.32, 0.1, 0.18), m["fabric"], back, (0, 0.04, 0.84), bevel=0.04)
    box("Back Neon", (0.03, 0.02, 0.6), m["cyan"], back, (0, 0.1, 0.38))
    for x in (-0.3, 0.3):
        box("Arm Rest", (0.07, 0.42, 0.05), m["dark"], None, (x, -0.02, 0.72), bevel=0.02)
        box("Arm Post", (0.04, 0.04, 0.18), m["hull"], None, (x, 0.08, 0.62))
