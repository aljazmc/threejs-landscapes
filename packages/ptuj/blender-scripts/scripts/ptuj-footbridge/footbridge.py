from lowpoly import Builder, clear_scene, setup_scene

# Brv, the footbridge over the Drava from Dravski stolp and Ribič on the old
# town's bank to the right bank: a slim asphalted deck on two pairs of piers,
# hung from a white steel arch on each side. Like ptuj-bridge it runs along
# Y with its ends on the banks, so LENGTH matches ptuj-terrain, which also
# walks the kurents over it at deck_z. The deck clears the rafts' flags.
LENGTH = 52
WIDTH = 6
RISE = 3.4
DECK = 0.6
ARCH = 10.0
BED = -6.0
PIERS = (-LENGTH / 4, LENGTH / 4)
STEPS = 26
HANGERS = 9


def deck_z(y):
    return 0.4 + RISE * (1 - (2 * y / LENGTH) ** 2)


def arch_z(y):
    """Top of the arches, springing from the deck near the banks."""
    half = LENGTH / 2 - 3
    return deck_z(half) + ARCH * (1 - (y / half) ** 2)


def footbridge():
    clear_scene()
    setup_scene()
    b = Builder("Footbridge")
    half = WIDTH / 2
    ys = [-LENGTH / 2 + LENGTH * i / STEPS for i in range(STEPS + 1)]
    # concrete deck with an asphalt walkway on top
    b.strip([(y, deck_z(y) - DECK, deck_z(y) - 0.08) for y in ys], -half,
            half, "stone")
    b.strip([(y, deck_z(y) - 0.08, deck_z(y)) for y in ys], -half + 0.2,
            half - 0.2, "asphalt")
    # railings: posts, a middle rail and the handrail
    for x in (-half + 0.1, half - 0.1):
        for y in ys:
            b.box((x, y, deck_z(y) - 0.1), (0.12, 0.12, 1.2), "white")
        b.strip([(y, deck_z(y) + 0.5, deck_z(y) + 0.58) for y in ys],
                x - 0.04, x + 0.04, "white")
        b.strip([(y, deck_z(y) + 1.1, deck_z(y) + 1.22) for y in ys],
                x - 0.08, x + 0.08, "wood_dark")
    # the arches outside the railings, their hangers and two cross braces
    span = LENGTH / 2 - 3
    arch = [-span + 2 * span * i / (2 * STEPS) for i in range(2 * STEPS + 1)]
    for x in (-half - 0.45, half + 0.45):
        b.strip([(y, arch_z(y) - 0.7, arch_z(y)) for y in arch], x - 0.3,
                x + 0.3, "white")
        for i in range(1, HANGERS + 1):
            y = -span + 2 * span * i / (HANGERS + 1)
            b.box((x, y, deck_z(y) - DECK), (0.1, 0.1,
                                              arch_z(y) - deck_z(y) + DECK),
                  "stone_dark")
        b.box((x * 1.02, -span, deck_z(span) - DECK), (0.9, 1.2, DECK + 0.8),
              "stone_dark")
        b.box((x * 1.02, span, deck_z(span) - DECK), (0.9, 1.2, DECK + 0.8),
              "stone_dark")
    for y in (-span / 3, span / 3):
        b.box((0, y, arch_z(y) - 0.5), (WIDTH + 1.5, 0.4, 0.4), "white")
    # slender piers, round against the current
    for y in PIERS:
        for x in (-half + 1, half - 1):
            b.cylinder((x, y, BED), 0.5, deck_z(y) - DECK - BED, "stone", 8)
        b.box((0, y, deck_z(y) - DECK - 0.6), (WIDTH, 1.2, 0.6), "stone")
    # abutments reaching into the banks
    for y in (-LENGTH / 2 - 1.5, LENGTH / 2 + 1.5):
        b.box((0, y, BED), (WIDTH + 1, 3, deck_z(LENGTH / 2) - BED - 0.05),
              "stone")
    # lamps at the four ends of the railings
    for y in (-LENGTH / 2 + 0.6, LENGTH / 2 - 0.6):
        for x in (-half + 0.1, half - 0.1):
            z = deck_z(y) + 1.2
            b.cylinder((x, y, z), 0.08, 1.6, "black", 6)
            b.ico((x, y, z + 1.75), 0.25, "yellow", 1)
    b.finish()
