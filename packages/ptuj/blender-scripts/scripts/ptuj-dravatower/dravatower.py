import math

from lowpoly import Builder, clear_scene, setup_scene

# Dravski stolp, the round renaissance defence tower on the bank of the
# Drava, built against the Ottomans: a squat stone drum with gun ports and a
# tall conical roof.
RADIUS = 6.5
HEIGHT = 11
SIDES = 12


def dravatower():
    clear_scene()
    setup_scene()
    b = Builder("DravaTower")
    b.cylinder((0, 0, -3.5), RADIUS + 0.8, 4.0, "stone_dark", SIDES,
               RADIUS + 0.3)
    b.cylinder((0, 0, 0), RADIUS, HEIGHT, "stone", SIDES)
    b.cylinder((0, 0, HEIGHT - 0.6), RADIUS + 0.5, 0.7, "stone_dark", SIDES)
    b.cone((0, 0, HEIGHT + 0.1), RADIUS + 1.4, 9, "roof", SIDES)
    b.cylinder((0, 0, HEIGHT + 8.5), 0.1, 1.8, "gold", 6)
    for i in range(SIDES):
        a = 2 * math.pi * (i + 0.5) / SIDES
        x, y = RADIUS * math.cos(a), RADIUS * math.sin(a)
        rotation = a + math.pi / 2
        if i % 2:
            b.box((x, y, 2.5), (0.9, 0.3, 0.6), "black", rotation)
        b.box((x, y, 6.8), (0.8, 0.3, 1.3), "window", rotation)
    b.box((0, -RADIUS + 0.1, 0), (1.8, 0.5, 2.8), "door")
    b.pyramid((0, -RADIUS + 0.1, 2.8), (1.8, 0.5), 0.7, "door")
    b.finish()
