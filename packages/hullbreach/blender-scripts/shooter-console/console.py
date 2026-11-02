import math

from shooter import (box, button_grid, clear_scene, cylinder, gauge, joint,
                     ship_materials)

EXPORT = "glb"

# Control room console, 2 m wide: a desk sloping towards the operator (at
# -Y) with three angled screens, button fields, dials and a keyboard strip.


def console():
    clear_scene()
    m = ship_materials()
    box("Base", (2.0, 0.7, 0.8), m["hull"], location=(0, 0.05, 0.4), bevel=0.03)
    box("Kick", (1.9, 0.08, 0.12), m["black"], location=(0, -0.31, 0.06))
    box("Neon Strip", (1.9, 0.02, 0.025), m["cyan"], location=(0, -0.31, 0.74))

    desk = joint("Desk", location=(0, -0.05, 0.86))
    desk.rotation_euler = (0.35, 0, 0)
    box("Desk Plate", (2.0, 0.6, 0.06), m["dark"], desk, bevel=0.015)
    box("Keyboard", (0.9, 0.16, 0.02), m["black"], desk, (0, -0.16, 0.04))
    button_grid("Keys", 16, 3, 0.05, 0.035, [m["light"], m["light"], m["cyan"]],
                desk, (0, -0.16, 0.055))
    button_grid("Left Buttons", 5, 4, 0.06, 0.04,
                [m["amber"], m["green"], m["red"], m["dark"]], desk, (-0.72, -0.05, 0.04))
    button_grid("Right Buttons", 5, 4, 0.06, 0.04,
                [m["magenta"], m["cyan"], m["dark"], m["green"]], desk, (0.72, -0.05, 0.04))
    for index, x in enumerate((-0.35, 0.35)):
        gauge(f"Dial {index}", 0.07, m["black"], m["amber"], desk, (x, 0.12, 0.035))

    # three screens on a rail, tilted back
    for index, (x, turn, glow) in enumerate(((-0.66, 18, "screen2"), (0, 0, "screen"),
                                             (0.66, -18, "screen3"))):
        screen = joint(f"Screen {index}", location=(x, 0.22, 1.05))
        screen.rotation_euler = (-0.25, 0, math.radians(turn))
        box("Bezel", (0.6, 0.05, 0.4), m["dark"], screen, (0, 0, 0.2), bevel=0.012)
        box("Picture", (0.54, 0.01, 0.34), m[glow], screen, (0, -0.026, 0.2))
        for line in range(4):
            box(f"Graph {line}", (0.08 + 0.09 * ((line * 5) % 4), 0.004, 0.018),
                m["white"] if line % 2 else m["green"], screen,
                (-0.2 + 0.05 * line, -0.033, 0.3 - line * 0.06))
        cylinder("Stand", 0.025, 0.2, m["hull"], screen, (0, 0.03, -0.17))
