import math

from shooter import box, clear_scene, cylinder, joint, ship_materials, torus, tube

EXPORT = "glb"

# Pair of hydraulic pistons pumping up and down ("Pump" joints move along
# Z in the game, the two half a beat apart), driven by a crank housing with
# a turning flywheel ("Spin", laid along Y).


def piston():
    clear_scene()
    m = ship_materials()
    box("Bed", (1.8, 1.4, 0.5), m["dark"], location=(0, 0, 0.25), bevel=0.04)
    box("Bed Neon", (1.7, 0.02, 0.04), m["amber"], location=(0, -0.71, 0.4))
    for index, x in enumerate((-0.45, 0.45)):
        cylinder(f"Cylinder {index}", 0.3, 1.6, m["hull"], location=(x, 0.1, 0.5), sides=16)
        torus(f"Collar {index}", 0.31, 0.04, m["light"], location=(x, 0.1, 2.1))
        pump = joint(f"Pump {index}", location=(x, 0.1, 2.1))
        cylinder(f"Rod {index}", 0.11, 0.9, m["light"], pump, (0, 0, -0.2), sides=12)
        cylinder(f"Head {index}", 0.2, 0.25, m["brass"], pump, (0, 0, 0.7), sides=12)
        box(f"Glow {index}", (0.03, 0.02, 1.2), m["cyan"], None, (x, -0.21, 1.2))
    box("Beam", (1.6, 0.3, 0.2), m["dark"], location=(0, 0.1, 3.2))
    for x in (-0.75, 0.75):
        box("Upright", (0.15, 0.3, 2.8), m["hull"], location=(x, 0.1, 1.9))
    wheel = joint("Wheel Axis", location=(0, 0.5, 1.2))
    wheel.rotation_euler = (math.radians(90), 0, 0)
    spin = joint("Spin- Flywheel", wheel)
    cylinder("Wheel", 0.55, 0.12, m["rust"], spin, sides=20)
    for index in range(3):
        box(f"Spoke {index}", (1.0, 0.08, 0.14), m["hull"], spin, (0, 0, 0.06),
            rotation=(0, 0, 60 * index))
    tube("Hose", [(-0.9, 0.6, 0.5), (-1.0, 0.6, 1.5), (-0.6, 0.4, 2.4), (-0.45, 0.1, 2.3)],
         0.05, m["black"], sides=6)
