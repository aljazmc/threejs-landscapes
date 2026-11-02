import math

from gothic import candle, cobweb, gothic_materials
from shooter import box, clear_scene, cylinder, sphere

EXPORT = "glb"

# Long banquet table, 3 m along X, laid for a feast long gone: tarnished
# plates, goblets of blood, a roast gone to bone, rotten fruit and an iron
# candelabrum in the middle ("Flame" joints flicker in the game).


def table():
    clear_scene()
    m = gothic_materials()
    box("Top", (3.0, 0.9, 0.07), m["oak"], location=(0, 0, 0.78), bevel=0.02)
    box("Runner", (2.8, 0.35, 0.01), m["velvet"], location=(0, 0, 0.82))
    for x in (-1.3, 1.3):
        box("Trestle", (0.08, 0.7, 0.75), m["ebony"], location=(x, 0, 0.38))
    box("Beam", (2.6, 0.08, 0.08), m["ebony"], location=(0, 0, 0.2))
    for x in (-1.1, -0.4, 0.4, 1.1):
        for y in (-0.3, 0.3):
            cylinder("Plate", 0.11, 0.015, m["silver"], location=(x, y, 0.815), sides=16)
            cylinder("Goblet", 0.03, 0.14, m["silver"], location=(x + 0.15, y * 0.7, 0.815), top=0.04, sides=8)
            cylinder("Wine", 0.037, 0.01, m["blood"], location=(x + 0.15, y * 0.7, 0.94), sides=8)
    sphere("Roast", 0.14, m["leather"], location=(-0.75, 0, 0.88), scale=(1.4, 1, 0.7))
    for k in range(3):
        cylinder(f"Rib {k}", 0.012, 0.18, m["bone"], location=(-0.85 + 0.1 * k, 0, 0.9),
                 rotation=(70, 0, 0), sides=5)
    cylinder("Bowl", 0.14, 0.07, m["silver"], location=(0.75, 0, 0.815), top=0.18, sides=12)
    for k in range(4):
        sphere("Fruit", 0.045, m["purple"] if k % 2 else m["leather"],
               location=(0.75 + 0.05 * (k - 1.5), 0.02 * (k % 2), 0.9), subdivisions=1)
    cylinder("Candelabrum", 0.025, 0.4, m["iron"], location=(0, 0, 0.82), sides=6)
    cylinder("Candelabrum Foot", 0.09, 0.03, m["iron"], location=(0, 0, 0.82), top=0.03, sides=10)
    for k in range(5):
        a = math.radians(k * 45 - 90)
        x, z = 0.25 * math.sin(a), 1.22 + 0.12 * math.cos(a)
        cylinder(f"Arm {k}", 0.012, 0.03, m["iron"], location=(x, 0, z - 0.03), sides=5)
        candle(f"Candle {k}", None, (x, 0, z), m, 0.16 - 0.03 * abs(k - 2), flicker=f"Flame {k}")
    cobweb("Web", None, m, (-1.3, 0.35, 0.74), 0.35, rotation=(0, 0, 180))
