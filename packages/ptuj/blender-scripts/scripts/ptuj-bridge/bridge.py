import math

from lowpoly import Builder, clear_scene, setup_scene

# A humpbacked stone bridge of three arches over the Drava. It runs along Y
# and its ends sit on the banks, which ptuj-terrain keeps RIVER_WIDTH + 16 m
# apart, so LENGTH must match that.
LENGTH = 52
WIDTH = 9
HUMP = 3.0
DECK = 1.0
WATER = -1.0
BED = -6.0
PIERS = (-LENGTH / 6, LENGTH / 6)
STEPS = 24


def deck_z(y):
    return 0.4 + HUMP * (1 - (2 * y / LENGTH) ** 2)


def arch_z(y):
    """Underside of the bridge: a semi-ellipse in each span, None over a
    pier or abutment."""
    supports = [-LENGTH / 2 - 1.3] + list(PIERS) + [LENGTH / 2 + 1.3]
    for left, right in zip(supports, supports[1:]):
        left, right = left + 1.3, right - 1.3
        if left <= y <= right:
            half = (right - left) / 2
            t = (y - (left + right) / 2) / half
            spring = WATER + 0.4
            rise = deck_z((left + right) / 2) - DECK - 0.6 - spring
            return spring + rise * math.sqrt(max(0.0, 1 - t * t))
    return None


def bridge():
    clear_scene()
    setup_scene()
    b = Builder("Bridge")
    half = WIDTH / 2
    ys = [-LENGTH / 2 + LENGTH * i / STEPS for i in range(STEPS + 1)]
    # deck and the spandrel walls down to the arches
    deck = [(y, deck_z(y) - DECK, deck_z(y)) for y in ys]
    b.strip(deck, -half, half, "road")
    body = []
    for y in ys:
        low = arch_z(y)
        body.append((y, BED if low is None else low, deck_z(y) - DECK))
    b.strip(body, -half + 0.3, half - 0.3, "stone")
    # parapets with caps
    for x in (-half, half - 0.6):
        b.strip([(y, z, z + 1.1) for y, _, z in deck], x, x + 0.6, "stone")
        b.strip([(y, z + 1.1, z + 1.3) for y, _, z in deck], x - 0.1,
                x + 0.7, "white")
    # piers with cutwaters against the current
    for y in PIERS:
        b.box((0, y, BED), (WIDTH - 0.4, 2.6, deck_z(y) - DECK - BED),
              "stone")
        for side in (-1, 1):
            b.prism((side * (half - 0.2), y, BED),
                    [(0, -1.3), (side * 2.2, 0), (0, 1.3)], WATER + 1.0 - BED,
                    "stone_dark")
    # abutments reaching into the banks
    for y in (-LENGTH / 2 - 2, LENGTH / 2 + 2):
        b.box((0, y, BED), (WIDTH + 1, 4, deck_z(y) - BED - 0.05), "stone")
    # lamps
    for y in (-LENGTH / 4, LENGTH / 4):
        for x in (-half + 0.3, half - 0.3):
            z = deck_z(y) + 1.3
            b.cylinder((x, y, z), 0.12, 2.6, "black", 6)
            b.ico((x, y, z + 2.8), 0.35, "yellow", 1)
    b.finish()
