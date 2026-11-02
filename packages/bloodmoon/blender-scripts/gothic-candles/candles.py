import random

from gothic import candle, cobweb, gothic_materials, pointed_arch
from shooter import box, clear_scene, cylinder, sphere, tube

EXPORT = "glb"

# A wall of candles against the wall (+Y) of the crypt, 2 m wide and up to
# 6 m high: iron shelves under pointed arches crowded with candles, melted
# wax running down, skulls between them and chains hanging from above
# ("Flame" joints flicker in the game).


def candles():
    clear_scene()
    m = gothic_materials()
    rng = random.Random(3)
    for x in (-0.95, 0, 0.95):
        box("Post", (0.08, 0.08, 6.0), m["iron"], location=(x, 0.4, 3.0))
    flames = 0
    for shelf in range(5):
        z = 0.7 + shelf * 1.1
        box(f"Shelf {shelf}", (1.9, 0.3, 0.04), m["iron"], location=(0, 0.3, z))
        for x in (-0.47, 0.47):
            pointed_arch(f"Arch {shelf} {x}", None, 0.9, 0.9, 0.018, m["iron"], (x, 0.42, z + 0.05))
        x = -0.85
        while x < 0.85:
            if rng.random() < 0.15:
                sphere(f"Skull {shelf} {x:.2f}", 0.08, m["bone"], location=(x + 0.06, 0.3, z + 0.1),
                       scale=(0.8, 1, 0.9))
                x += 0.18
                continue
            h = rng.uniform(0.08, 0.35)
            flicker = f"Flame {flames}" if flames < 12 and rng.random() < 0.5 else None
            flames += flicker is not None
            candle(f"Candle {shelf} {x:.2f}", None, (x, 0.3 + rng.uniform(-0.06, 0.06), z + 0.02), m, h,
                   radius=rng.uniform(0.02, 0.035), flicker=flicker)
            if rng.random() < 0.4:
                tube(f"Drip {shelf} {x:.2f}", [(x, 0.17, z + 0.02), (x + 0.01, 0.16, z - 0.12)], 0.012,
                     m["wax"], sides=4)
            x += rng.uniform(0.09, 0.16)
    for x in (-0.6, 0.55):
        tube(f"Chain {x}", [(x, 0.15, 6.0), (x + 0.1, 0.12, 4.2), (x, 0.15, 3.1)], 0.015, m["iron"], sides=4)
    cobweb("Web", None, m, (-0.95, 0.35, 5.95), 0.6)
    cobweb("Web 2", None, m, (0.95, 0.35, 5.95), 0.5, rotation=(0, 0, 180))
