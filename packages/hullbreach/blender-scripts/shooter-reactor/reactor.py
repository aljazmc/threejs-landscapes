import math

from shooter import (box, clear_scene, cylinder, joint, material, ship_materials,
                     torus, tube)

EXPORT = "glb"

# The fusion reactor in the middle of the engine room: a glowing core in a
# cage of struts, with coolant rings turning around it ("Spin" joints turn
# around their Z axis in the game, the sign of the number after "Spin" giving
# the direction) and pipes running down into the floor. About 6 m tall.


def reactor():
    clear_scene()
    m = ship_materials()
    core = material("Core", "#7af6ff", emission=8.0)
    cylinder("Plinth", 2.1, 0.4, m["dark"], sides=24)
    cylinder("Plinth Step", 1.8, 0.3, m["hull"], location=(0, 0, 0.4), sides=24)
    torus("Plinth Neon", 1.85, 0.03, m["cyan"], location=(0, 0, 0.4), segments=40, sides=4)
    cylinder("Bottom Cap", 1.2, 0.6, m["light"], location=(0, 0, 0.7), top=0.8, sides=20)
    cylinder("Core", 0.55, 3.0, core, location=(0, 0, 1.2), sides=20)
    cylinder("Top Cap", 0.8, 0.6, m["light"], location=(0, 0, 4.2), top=1.2, sides=20)
    cylinder("Crown", 1.2, 0.3, m["hull"], location=(0, 0, 4.8), sides=20)
    cylinder("Crown Pipe", 0.35, 1.3, m["dark"], location=(0, 0, 5.1), sides=12)
    for index in range(8):
        angle = 2 * math.pi * index / 8
        x, y = math.cos(angle), math.sin(angle)
        box(f"Strut {index}", (0.12, 0.12, 3.1), m["hull"], None,
            (0.9 * x, 0.9 * y, 2.65), rotation=(0, 0, math.degrees(angle)))
        if index % 2 == 0:
            tube(f"Coolant {index}", [(1.0 * x, 1.0 * y, 4.6), (1.6 * x, 1.6 * y, 4.4),
                                      (2.0 * x, 2.0 * y, 2.5), (1.9 * x, 1.9 * y, 0.7)],
                 0.09, m["brass"], sides=8)
    for index, (z, sign, mat) in enumerate(((1.7, 1, "magenta"), (2.7, -1, "cyan"),
                                            (3.7, 1, "magenta"))):
        spin = joint(f"Spin{'+' if sign > 0 else '-'} Ring {index}", location=(0, 0, z))
        torus(f"Ring {index}", 1.15, 0.08, m["light"], spin, segments=32, sides=8)
        torus(f"Ring Glow {index}", 1.15, 0.03, m[mat], spin, (0, 0, 0.08),
              segments=32, sides=4)
        for k in range(4):
            angle = math.pi / 2 * k
            box(f"Ring Clamp {index} {k}", (0.22, 0.22, 0.22), m["dark"], spin,
                (1.15 * math.cos(angle), 1.15 * math.sin(angle), 0))
    for index, z in enumerate((0.25, 0.55)):
        box(f"Warning {index}", (0.6, 0.02, 0.12), m["amber"], None, (0, -2.11 + 0.3 * index, z))
