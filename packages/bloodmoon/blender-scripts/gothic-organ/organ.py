import math

from gothic import candle, gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, cylinder, joint, sphere

EXPORT = "glb"

# The great pipe organ of the ballroom on a dais under the windows, facing
# -Y: a gothic case of black oak with spires, two towers of brass pipes, the
# keyboard and a bench, candelabra on its sides. Its bellows ("Pump" joints,
# bobbing in the game) heave behind the keys.


def organ():
    clear_scene()
    m = gothic_materials()
    for index, (w, z) in enumerate(((2.8, 0.1), (2.3, 0.3))):
        box(f"Step {index}", (w, w * 0.9, 0.2), m["marble"], location=(0, 0.2, z), bevel=0.03)
    box("Case", (2.2, 0.8, 1.0), m["ebony"], location=(0, 0.5, 0.9), bevel=0.03)
    box("Keyboard", (1.3, 0.35, 0.08), m["ebony"], location=(0, 0.02, 1.0), bevel=0.01)
    for k in range(26):
        box(f"Key {k}", (0.044, 0.25, 0.02), m["ivory"], location=(-0.6 + 0.048 * k, -0.02, 1.05))
    for k in range(18):
        if k % 7 in (2, 6):
            continue
        box(f"Black Key {k}", (0.025, 0.14, 0.03), m["ebony"],
            location=(-0.575 + 0.048 * k * 26 / 18, 0.03, 1.07))
    box("Bench", (1.1, 0.35, 0.06), m["oak"], location=(0, -0.55, 0.75))
    for x in (-0.45, 0.45):
        box("Bench Leg", (0.06, 0.3, 0.35), m["oak"], location=(x, -0.55, 0.55))
    box("Music Desk", (0.7, 0.04, 0.35), m["oak"], location=(0, 0.2, 1.3), rotation=(-15, 0, 0))
    box("Score", (0.5, 0.01, 0.3), m["linen"], location=(0, 0.17, 1.31), rotation=(-15, 0, 0))
    # the pipe towers, the tallest in the middle
    for side in (-1, 1):
        for k in range(7):
            x = side * (0.25 + k * 0.13)
            h = 2.6 - k * 0.22 + (0.35 if k == 3 else 0)
            cylinder(f"Pipe {side} {k}", 0.055, h, m["brass"], location=(x, 0.7, 1.4), sides=10)
            cylinder(f"Pipe Foot {side} {k}", 0.02, 0.15, m["brass"], location=(x, 0.7, 1.25), top=0.055,
                     sides=8)
            box(f"Mouth {side} {k}", (0.05, 0.01, 0.06), m["marble"], location=(x, 0.645, 1.55))
    cylinder("Center Pipe", 0.08, 3.3, m["brass"], location=(0, 0.75, 1.4), sides=12)
    pointed_arch("Crown Arch", None, 2.2, 1.2, 0.04, m["oak"], (0, 0.6, 4.0))
    for x in (-1.1, -0.55, 0.55, 1.1):
        spire("Spire", None, 0.9, 0.06, m["oak"], (x, 0.6, 3.7 + (0.3 if abs(x) < 1 else 0)),
              top=m["iron"])
    spire("Top Spire", None, 1.4, 0.08, m["oak"], (0, 0.6, 4.9), top=m["evil"])
    for side in (-1, 1):
        box(f"Tower {side}", (0.15, 0.8, 3.4), m["oak"], location=(side * 1.15, 0.6, 2.4), bevel=0.02)
    # bellows behind the case
    for index in range(2):
        pump = joint(f"Pump {index}", location=(0.5 * (1 - 2 * index), 0.95, 1.2))
        box(f"Bellows {index}", (0.5, 0.25, 0.12), m["leather"], pump, bevel=0.04)
    for side in (-1, 1):
        x = side * 1.45
        cylinder(f"Candelabrum {side}", 0.03, 1.4, m["iron"], location=(x, -0.2, 0.4), sides=6)
        for k in range(3):
            a = math.radians(90 * (k - 1))
            cx, cz = x + 0.18 * math.sin(a), 1.8 + (0.1 if k == 1 else 0)
            cylinder(f"Arm {side} {k}", 0.012, 0.2, m["iron"], location=(cx, -0.2, cz - 0.15), sides=5)
            candle(f"Candle {side} {k}", None, (cx, -0.2, cz), m, 0.18, flicker=f"Flame {side + 1 + k}")
