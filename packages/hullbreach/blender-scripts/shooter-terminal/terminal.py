import math

from shooter import box, button_grid, clear_scene, joint, material, ship_materials

EXPORT = "glb"

# Cabin desk with a wall terminal, facing -Y.


def terminal():
    clear_scene()
    m = ship_materials()
    box("Desk", (0.9, 0.55, 0.06), m["light"], location=(0, 0.1, 0.75), bevel=0.01)
    box("Drawer", (0.5, 0.5, 0.45), m["hull"], location=(0.18, 0.12, 0.48), bevel=0.01)
    box("Leg", (0.05, 0.5, 0.72), m["dark"], location=(-0.4, 0.12, 0.36))
    box("Back", (0.9, 0.04, 0.8), m["dark"], location=(0, 0.38, 1.2))
    screen = joint("Screen", location=(0, 0.3, 1.25))
    screen.rotation_euler = (math.radians(-10), 0, 0)
    box("Frame", (0.62, 0.04, 0.42), m["black"], screen, bevel=0.01)
    box("Picture", (0.56, 0.01, 0.36), m["screen3"], screen, (0, -0.022, 0))
    for line in range(5):
        box(f"Text {line}", (0.15 + 0.06 * ((line * 3) % 5), 0.004, 0.02),
            m["magenta"] if line == 0 else m["white"], screen,
            (-0.18 + 0.03 * ((line * 3) % 5), -0.03, 0.13 - line * 0.06))
    button_grid("Keys", 10, 3, 0.045, 0.035, [m["dark"], m["dark"], m["cyan"]], None,
                (0, -0.02, 0.79))
    box("Mug", (0.07, 0.07, 0.1), material("Mug", "#d04848", 0.6), location=(-0.3, -0.05, 0.83))
