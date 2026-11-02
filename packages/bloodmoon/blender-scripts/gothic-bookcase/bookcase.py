import random

from gothic import cobweb, gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, material, sphere

EXPORT = "glb"

# Bookcase against a wall (its back at +Y), 2 m wide and 2.6 m tall, of
# black oak under pointed arches, full of old tomes, with a skull, a few
# bottles and cobwebs.


def bookcase():
    clear_scene()
    m = gothic_materials()
    covers = [material(f"Cover {i}", c, 0.8) for i, c in
              enumerate(("#4a0a0e", "#1a1a2a", "#2a3a1e", "#4a3018", "#2a0a2a", "#5a4a3a"))]
    box("Back", (1.96, 0.05, 2.6), m["ebony"], location=(0, 0.22, 1.3))
    for x in (-0.96, 0.96):
        box("Side", (0.06, 0.45, 2.6), m["oak"], location=(x, 0.02, 1.3), bevel=0.01)
        spire("Pinnacle", None, 0.5, 0.05, m["oak"], (x, 0.02, 2.6))
    rng = random.Random(4)
    for shelf in range(5):
        z = 0.1 + shelf * 0.5
        box(f"Shelf {shelf}", (1.9, 0.42, 0.04), m["oak"], location=(0, 0.02, z))
        x = -0.88
        while x < 0.85:
            if rng.random() < 0.05 and x < 0.7:
                sphere(f"Skull {shelf}", 0.08, m["bone"], location=(x + 0.08, 0.0, z + 0.1), scale=(0.8, 1, 0.9))
                x += 0.18
                continue
            if rng.random() < 0.05 and x < 0.7:
                sphere(f"Bottle {shelf}", 0.05, m["glass"], location=(x + 0.05, 0.0, z + 0.07))
                x += 0.12
                continue
            w = rng.uniform(0.04, 0.09)
            h = rng.uniform(0.28, 0.42)
            tilt = rng.uniform(-8, 8) if rng.random() < 0.15 else 0
            box(f"Book {shelf} {x:.2f}", (w, 0.3, h), covers[rng.randrange(len(covers))],
                location=(x + w / 2, 0.02, z + 0.02 + h / 2), rotation=(0, tilt, 0))
            x += w + 0.005
    for x in (-0.47, 0.47):
        pointed_arch(f"Crown {x}", None, 0.9, 0.5, 0.025, m["oak"], (x, -0.2, 2.6))
    cobweb("Web", None, m, (-0.93, -0.18, 2.55), 0.45)
