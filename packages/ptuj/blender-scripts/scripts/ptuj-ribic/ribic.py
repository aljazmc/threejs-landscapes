import math

from lowpoly import Builder, clear_scene, setup_scene

# Gostilna Ribič, the fish restaurant on the bank of the Drava by the
# footbridge: a two floor house under a hip roof with a wooden terrace in
# front, towards the river, its tables under red and white umbrellas and a
# fish over the door.
SIZE = (14, 9)
FLOOR = 3.2
TERRACE = 5.5
HOUSE_Y = 2.5  # the house stands back, so the terrace fits the footprint


def table(b, x, y, z, umbrella):
    b.cylinder((x, y, z), 0.08, 0.75, "wood_dark", 6)
    b.cylinder((x, y, z + 0.75), 0.6, 0.06, "wood", 8)
    for a in range(4):
        angle = a * math.pi / 2
        b.box((x + 0.95 * math.cos(angle), y + 0.95 * math.sin(angle), z),
              (0.45, 0.45, 0.45), "wood_dark", angle)
    b.cylinder((x, y, z + 0.8), 0.05, 1.7, "white", 6)
    b.cone((x, y, z + 2.2), 1.5, 0.6, umbrella, 8)


def ribic():
    clear_scene()
    setup_scene()
    b = Builder("Ribic")
    w, d = SIZE[0] / 2, SIZE[1] / 2
    top = 2 * FLOOR
    b.box((0, HOUSE_Y, -2.5), (SIZE[0] + 0.3, SIZE[1] + 0.3, 2.9),
          "stone_dark")
    b.box((0, HOUSE_Y, 0), SIZE + (top,), "wall_cream")
    b.windows((0, HOUSE_Y, 0), SIZE, 2, FLOOR, door="door", shutters="blue")
    b.hip_roof((0, HOUSE_Y, top), SIZE, 3.6, "roof_dark", overhang=0.6)
    for x in (-3.5, 3.5):
        b.box((x, HOUSE_Y + 1.5, top + 1.2), (0.7, 0.7, 2.6), "roof_dark")
    # the sign: a blue fish on a board over the door
    front = HOUSE_Y - d
    b.box((0, front - 0.2, FLOOR - 0.35), (3.4, 0.2, 0.9), "wood_dark")
    b.ico((-0.2, front - 0.4, FLOOR + 0.1), 0.45, "blue", 1,
          scale=(1.6, 0.4, 0.8))
    b.prism((0.75, front - 0.4, FLOOR - 0.2),
            [(0, 0), (0.5, -0.35), (0.5, 0.35)], 0.6, "blue",
            (math.pi / 2, 0, 0))
    b.ico((-0.75, front - 0.6, FLOOR + 0.15), 0.07, "white", 1)
    # terrace towards the river with a railing and a pergola of vines
    y = front - TERRACE / 2
    b.box((0, y, -1.5), (SIZE[0], TERRACE, 1.9), "wood_dark")
    b.box((0, y, 0.4), (SIZE[0] - 0.2, TERRACE - 0.2, 0.05), "wood")
    for x in (-w + 0.15, w - 0.15):
        b.box((x, y, 0.4), (0.15, TERRACE, 0.9), "wood")
    for x in (-w + 0.15, -w / 2, w / 2, w - 0.15):
        b.box((x, front - TERRACE + 0.15, 0.4), (0.2, 0.2, 3.0), "wood")
    b.box((-w / 2 - 2.4, front - TERRACE + 0.15, 0.4), (5.0, 0.15, 0.9),
          "wood")
    b.box((w / 2 + 2.4, front - TERRACE + 0.15, 0.4), (5.0, 0.15, 0.9),
          "wood")
    for x in (-w + 1, 0, w - 1):
        b.box((x, y - 0.1, 3.4), (0.2, TERRACE, 0.2), "wood")
    b.box((0, front - TERRACE + 0.15, 3.4), (SIZE[0], 0.2, 0.2), "wood")
    for x in (-w + 0.5, w - 0.5):
        b.ico((x, front - TERRACE + 0.4, 3.5), 0.7, "vine", 1, jitter=0.2)
    for x, umbrella in ((-4.4, "red"), (0.0, "white"), (4.4, "red")):
        table(b, x, y - 0.4, 0.45, umbrella)
    b.finish()
