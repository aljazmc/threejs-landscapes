import math

from shooter import (box, clear_scene, cylinder, joint, material, ship_materials,
                     sphere, torus)

EXPORT = "glb"

# Rescue pod in its launch cradle: an egg-shaped capsule standing upright
# with its round hatch and window towards -Y, warning lights and a launch
# rail, about 2.6 m tall.


def pod():
    clear_scene()
    m = ship_materials()
    glass = material("Pod Window", "#2a7aa8", emission=1.2)
    shell = material("Pod Shell", "#d8dce4", 0.35, 0.3)
    stripe = material("Pod Stripe", "#ff7a1a", 0.6)
    cylinder("Cradle", 1.0, 0.25, m["dark"], sides=16)
    torus("Cradle Neon", 0.95, 0.03, m["amber"], location=(0, 0, 0.25), segments=24, sides=4)
    sphere("Capsule", 0.75, shell, location=(0, 0, 1.4), scale=(1, 1, 1.45),
           subdivisions=3)
    torus("Belt", 0.76, 0.05, stripe, location=(0, 0, 1.05), segments=32)
    torus("Belt 2", 0.7, 0.04, stripe, location=(0, 0, 2.0), segments=32)
    hatch = joint("Hatch", location=(0, -0.7, 1.4))
    hatch.rotation_euler = (math.radians(90), 0, 0)
    cylinder("Hatch Door", 0.42, 0.08, m["light"], hatch, (0, 0, -0.02), sides=20)
    cylinder("Window", 0.22, 0.04, glass, hatch, (0, 0.12, 0.06), sides=16)
    torus("Window Rim", 0.23, 0.025, m["dark"], hatch, (0, 0.12, 0.08), segments=16, sides=4)
    box("Handle", (0.2, 0.04, 0.04), m["dark"], hatch, (0, -0.22, 0.08))
    cylinder("Thruster", 0.3, 0.3, m["dark"], location=(0, 0, 0.25), top=0.4, sides=12)
    for index in range(4):
        angle = math.pi / 2 * index + math.pi / 4
        box(f"Clamp {index}", (0.15, 0.15, 0.7), m["hull"], None,
            (0.85 * math.cos(angle), 0.85 * math.sin(angle), 0.6))
        sphere(f"Beacon {index}", 0.06, m["red"], None,
               (0.85 * math.cos(angle), 0.85 * math.sin(angle), 0.98), subdivisions=1)
    box("Rail", (0.12, 0.12, 3.0), m["hull"], location=(0, 0.9, 1.5))
    box("Sign", (0.5, 0.02, 0.14), m["green"], location=(0, -0.05 + 0.0, 2.65))
