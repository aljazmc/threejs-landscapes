import math

from gothic import candle, gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, cylinder, joint, sphere, torus, tube

EXPORT = "glb"

# The blood altar in the middle of the crypt, under a canopy of four black
# pillars and pointed arches, about 6 m tall: a stone table over a pool of
# blood, chains, a ring of candles and drops of blood circling over it
# ("Spin" joints turn around their Z axis in the game).


def altar():
    clear_scene()
    m = gothic_materials()
    cylinder("Floor Ring", 2.1, 0.25, m["darkstone"], sides=32)
    torus("Ring Rim", 2.05, 0.05, m["iron"], location=(0, 0, 0.25), segments=40)
    cylinder("Pool", 1.95, 0.03, m["blood"], location=(0, 0, 0.23), sides=32)
    for index, (w, z) in enumerate(((1.6, 0.25), (1.3, 0.45))):
        box(f"Step {index}", (w, w * 0.6, 0.2), m["stone"], location=(0, 0, z + 0.1), bevel=0.03)
    box("Table", (1.9, 0.9, 0.12), m["marble"], location=(0, 0, 1.2), bevel=0.03)
    box("Pedestal", (1.1, 0.5, 0.55), m["stone"], location=(0, 0, 0.9), bevel=0.02)
    box("Blood Runner", (1.6, 0.4, 0.01), m["blood"], location=(0, 0, 1.265))
    box("Shroud", (1.3, 0.5, 0.1), m["linen"], location=(0.1, 0, 1.31), bevel=0.04)
    sphere("Skull", 0.1, m["bone"], location=(-0.65, 0, 1.36), scale=(0.8, 1, 0.9))
    cylinder("Chalice", 0.06, 0.2, m["gold"], location=(0.75, 0.25, 1.26), top=0.08, sides=10)
    cylinder("Chalice Blood", 0.075, 0.01, m["blood"], location=(0.75, 0.25, 1.46), sides=10)
    # canopy: four pillars, arches and a spire
    for index, (x, y) in enumerate(((-1.3, -1.3), (1.3, -1.3), (-1.3, 1.3), (1.3, 1.3))):
        cylinder(f"Pillar {index}", 0.13, 4.2, m["darkstone"], location=(x, y, 0.25), top=0.11, sides=8)
        box(f"Pillar Base {index}", (0.36, 0.36, 0.25), m["stone"], location=(x, y, 0.37), bevel=0.03)
        box(f"Capital {index}", (0.32, 0.32, 0.2), m["stone"], location=(x, y, 4.45), bevel=0.03)
        spire(f"Pinnacle {index}", None, 0.8, 0.09, m["stone"], (x, y, 4.55))
        # chains hanging from the corners to the table
        tube(f"Chain {index}", [(x * 0.95, y * 0.95, 4.3), (x * 0.6, y * 0.6, 2.6), (x * 0.5, y * 0.25, 1.3)],
             0.018, m["iron"], sides=5)
    for side, rotation in ((-1.3, (0, 0, 0)), (1.3, (0, 0, 0)), (-1.3, (0, 0, 90)), (1.3, (0, 0, 90))):
        location = (0, side, 3.6) if rotation[2] == 0 else (side, 0, 3.6)
        pointed_arch(f"Arch {side} {rotation[2]}", None, 2.6, 1.6, 0.07, m["stone"], location, rotation)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        tube(f"Rib {k}", [(1.3 * math.sqrt(2) * math.cos(a) * 0.98, 1.3 * math.sqrt(2) * math.sin(a) * 0.98, 4.5),
                          (0.6 * math.cos(a), 0.6 * math.sin(a), 5.4), (0, 0, 5.7)], 0.06, m["stone"])
    spire("Spire", None, 1.2, 0.18, m["stone"], (0, 0, 5.6), top=m["evil"])
    sphere("Blood Moon", 0.25, m["evil"], location=(0, 0, 3.4))
    for index in range(8):
        a = 2 * math.pi * index / 8
        candle(f"Candle {index}", None, (1.75 * math.cos(a), 1.75 * math.sin(a), 0.25), m,
               0.2 + 0.1 * (index % 3), flicker=f"Flame {index}")
    for k, (z, r, sign) in enumerate(((2.2, 1.0, "+"), (2.9, 0.7, "-"))):
        spin = joint(f"Spin{sign} Blood {k}", location=(0, 0, z))
        for index in range(6):
            a = 2 * math.pi * index / 6
            sphere(f"Drop {k} {index}", 0.05, m["evil"], spin, (r * math.cos(a), r * math.sin(a),
                                                                 0.15 * math.sin(index * 2)),
                   scale=(1, 1, 1.5), subdivisions=1)
