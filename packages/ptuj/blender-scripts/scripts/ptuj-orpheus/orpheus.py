import math

from lowpoly import Builder, clear_scene, setup_scene

# Orfejev spomenik, the Roman tombstone of Marcus Valerius Verus in front of
# the city tower, almost five meters of marble with Orpheus playing his lyre
# to the animals in its relief, standing on a stepped base.


def orpheus():
    clear_scene()
    setup_scene()
    b = Builder("Orpheus")
    b.box((0, 0, -1.5), (3.6, 2.4, 1.8), "stone_dark")
    b.box((0, 0, 0.3), (3.0, 1.8, 0.4), "stone")
    b.box((0, 0, 0.7), (2.4, 1.0, 4.2), "white")
    b.box((0, 0, 4.9), (2.6, 1.15, 0.3), "stone")
    b.prism((0, 0.55, 5.2), [(-1.3, 0), (1.3, 0), (0, 0.9)], 1.1, "white",
            (math.pi / 2, 0, 0))
    # the relief: Orpheus between two animals, inset into the slab
    b.box((0, -0.45, 1.3), (1.9, 0.2, 2.6), "stone")
    b.ico((0, -0.55, 3.25), 0.28, "stone_dark")
    b.box((0, -0.55, 2.05), (0.5, 0.2, 1.0), "stone_dark")
    b.box((0, -0.55, 1.4), (0.75, 0.2, 0.7), "stone_dark")
    b.box((0.45, -0.6, 2.3), (0.3, 0.15, 0.7), "gold")
    for x in (-0.65, 0.65):
        b.ico((x, -0.55, 1.6), 0.24, "stone_dark", scale=(1.3, 1, 0.8))
    b.finish()
