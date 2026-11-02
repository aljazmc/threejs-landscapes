import random

from elven import elven_materials, filigree_arch
from shooter import box, clear_scene, material

EXPORT = "glb"

# Bookcase against a wall (its back at +Y), 2 m wide and 2.6 m tall, full
# of old tomes and a few glowing scrolls, under a carved arch.


def bookcase():
    clear_scene()
    m = elven_materials()
    covers = [material(f"Cover {i}", c, 0.8) for i, c in
              enumerate(("#6a1e1e", "#1e3a6a", "#2a5a2a", "#6a4a1e", "#4a2a5a", "#8a7a5a"))]
    box("Back", (1.96, 0.05, 2.6), m["darkwood"], location=(0, 0.22, 1.3))
    for x in (-0.96, 0.96):
        box("Side", (0.06, 0.45, 2.6), m["wood"], location=(x, 0.02, 1.3), bevel=0.01)
    rng = random.Random(4)
    for shelf in range(5):
        z = 0.1 + shelf * 0.5
        box(f"Shelf {shelf}", (1.9, 0.42, 0.04), m["wood"], location=(0, 0.02, z))
        x = -0.88
        while x < 0.85:
            w = rng.uniform(0.04, 0.09)
            h = rng.uniform(0.28, 0.42)
            tilt = rng.uniform(-8, 8) if rng.random() < 0.15 else 0
            book = covers[rng.randrange(len(covers))] if rng.random() > 0.06 else m["rune"]
            box(f"Book {shelf} {x:.2f}", (w, 0.3, h), book, location=(x + w / 2, 0.02, z + 0.02 + h / 2),
                rotation=(0, tilt, 0))
            x += w + 0.005
    filigree_arch("Crown", None, 1.9, 0.5, m["gold"], (0, -0.2, 2.6))
