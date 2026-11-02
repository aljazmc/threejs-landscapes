import math

from gothic import candle, cobweb, gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, cylinder, sphere

EXPORT = "glb"

# A noble's tomb in the crypt, 3 m across: a stone sarcophagus on a dais
# with the effigy of a knight on its lid, which has slid aside, a pointed
# canopy above, candles and an iron fence around it.


def tomb():
    clear_scene()
    m = gothic_materials()
    box("Dais", (2.8, 2.6, 0.25), m["darkstone"], location=(0, 0, 0.125), bevel=0.04)
    box("Sarcophagus", (2.2, 1.0, 0.8), m["stone"], location=(0, 0, 0.65), bevel=0.04)
    for x in (-0.7, 0.0, 0.7):
        pointed_arch(f"Panel {x}", None, 0.5, 0.5, 0.02, m["darkstone"], (x, -0.51, 0.35))
    box("Hollow", (2.0, 0.8, 0.02), m["marble"], location=(0, 0, 1.04))
    lid = box("Lid", (2.3, 1.05, 0.15), m["stone"], location=(0.15, -0.25, 1.13), rotation=(0, 0, 8),
              bevel=0.03)
    # the knight's effigy on the lid, lying with his sword
    effigy = [("Effigy Body", (0.9, 0.35, 0.18), (0.05, -0.25, 1.29)),
              ("Effigy Legs", (0.7, 0.3, 0.14), (0.85, -0.18, 1.27))]
    for name, size, location in effigy:
        box(name, size, m["stone"], lid.parent, location, rotation=(0, 0, 8), bevel=0.05)
    sphere("Effigy Head", 0.13, m["stone"], location=(-0.6, -0.33, 1.32))
    box("Effigy Sword", (1.3, 0.06, 0.03), m["stone"], location=(0.4, -0.25, 1.4), rotation=(0, 0, 8))
    sphere("Bone Hand", 0.05, m["bone"], location=(-0.85, 0.4, 1.06))
    for index in range(4):
        x, y = (-1.25 if index % 2 else 1.25), (-1.1 if index < 2 else 1.1)
        cylinder(f"Post {index}", 0.08, 2.6, m["darkstone"], location=(x, y, 0.25), sides=8)
        spire(f"Pinnacle {index}", None, 0.5, 0.07, m["stone"], (x, y, 2.85))
    box("Canopy", (2.7, 2.4, 0.15), m["stone"], location=(0, 0, 2.9), bevel=0.03)
    for y in (-1.1, 1.1):
        pointed_arch(f"Arch {y}", None, 2.5, 0.8, 0.05, m["stone"], (0, y, 2.05))
    # the iron fence along the front
    for k in range(13):
        x = -1.3 + k * 2.6 / 12
        cylinder(f"Bar {k}", 0.012, 0.7, m["iron"], location=(x, -1.3, 0.25), sides=5)
        spire(f"Bar Tip {k}", None, 0.08, 0.02, m["iron"], (x, -1.3, 0.95))
    box("Rail", (2.6, 0.02, 0.03), m["iron"], location=(0, -1.3, 0.85))
    for index, (x, y) in enumerate(((-1.25, -0.6), (1.25, 0.6))):
        candle(f"Candle {index}", None, (x, y, 0.25), m, 0.35, flicker=f"Flame {index}")
    cobweb("Web", None, m, (1.25, -1.1, 2.82), 0.55, rotation=(0, 0, 180))
