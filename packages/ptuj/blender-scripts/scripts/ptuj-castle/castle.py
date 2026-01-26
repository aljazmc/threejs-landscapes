import math

from lowpoly import Builder, clear_scene, setup_scene

# Ptujski grad, the castle on the hill above the old town: a palace of four
# wings around an arcaded courtyard with the old keep on its north side and
# the gate tower on its south side, inside a ring wall with round bastions
# along the edge of the hilltop (the terrain's plateau is 27 m in radius).
PALACE = (36, 28)
WING = 9
FLOOR = 3.6
FLOORS = 3
RING = 25
RING_SIDES = 12


def wing(b, center, size, ridge):
    top = FLOORS * FLOOR
    b.box((center[0], center[1], -3), (size[0], size[1], top + 3), "wall")
    b.box((center[0], center[1], top - 0.6), (size[0] + 0.3, size[1] + 0.3,
                                              0.5), "stone")
    b.windows((center[0], center[1], 0), size, FLOORS, FLOOR, spacing=3.2)
    b.hip_roof((center[0], center[1], top), size, 4.5, "roof", overhang=0.7)


def palace(b):
    w, d = PALACE[0] / 2, PALACE[1] / 2
    inner = d - WING
    wing(b, (0, -d + WING / 2), (PALACE[0], WING), "x")
    wing(b, (0, d - WING / 2), (PALACE[0], WING), "x")
    wing(b, (-w + WING / 2, 0), (WING, 2 * inner), "y")
    wing(b, (w - WING / 2, 0), (WING, 2 * inner), "y")
    # courtyard with arcades on the ground floor
    b.box((0, 0, -0.2), (PALACE[0] - 2 * WING, 2 * inner, 0.3), "plaza")
    for x in range(-6, 7, 3):
        for y in (-inner + 0.1, inner - 0.1):
            b.box((x, y, 0), (1.6, 0.3, 2.6), "stone_dark")


def keep(b):
    """The old square keep rising over the north wing, with a flag."""
    x, y = -7, PALACE[1] / 2 - WING / 2
    top = 24
    b.box((x, y, -3), (8, 8, top + 3), "stone")
    b.windows((x, y, 0), (8, 8), 6, 4, spacing=3.5, window=(0.8, 1.4))
    for corner_x in (-1, 1):
        for corner_y in (-1, 1):
            b.box((x + corner_x * 3.6, y + corner_y * 3.6, top), (1.4, 1.4,
                                                                  1.4),
                  "stone")
    b.box((x, y, top), (8.6, 8.6, 0.4), "stone_dark")
    b.pyramid((x, y, top + 0.4), (7.0, 7.0), 7.5, "roof_dark")
    b.cylinder((x, y, top + 7.5), 0.1, 5, "wood_dark", 6)
    b.box((x + 1.2, y, top + 10.4), (2.2, 0.1, 1.4), "red")


def gate(b):
    """Gate tower in the south wing facing the town, with the gate arch."""
    y = -PALACE[1] / 2
    top = FLOORS * FLOOR + 5
    b.box((0, y, -3), (7, 6, top + 3), "wall_cream")
    b.box((0, y - 3.05, 0), (3.2, 0.3, 4.2), "wood_dark")
    b.box((0, y - 3.1, 4.2), (3.8, 0.3, 0.5), "stone_dark")
    b.windows((0, y, 0), (7, 6), 4, 4, sides="S", window=(1.0, 1.4),
              first=1)
    b.hip_roof((0, y, top), (7, 6), 4.0, "roof_dark", overhang=0.5)
    b.box((0, y - 3.05, top - 3.4), (2.0, 0.25, 2.0), "white")
    b.cylinder((0, y - 3.2, top - 2.4), 0.12, 0.1, "black", 6,
               rotation=(math.pi / 2, 0, 0))


def ring_wall(b):
    """Curtain wall with merlons and a bastion on every other corner, with a
    break in front of the gate."""
    corners = [(RING * math.cos(2 * math.pi * (i + 0.5) / RING_SIDES),
                RING * math.sin(2 * math.pi * (i + 0.5) / RING_SIDES))
               for i in range(RING_SIDES)]
    for i, (x0, y0) in enumerate(corners):
        x1, y1 = corners[(i + 1) % RING_SIDES]
        length = math.hypot(x1 - x0, y1 - y0)
        angle = math.atan2(y1 - y0, x1 - x0)
        mid = ((x0 + x1) / 2, (y0 + y1) / 2)
        if mid[1] < -RING * 0.9:
            # the gate opening, flanked by two short walls
            for s in (-1, 1):
                b.box((mid[0] + s * length * 0.35, mid[1], -4),
                      (length * 0.3, 1.2, 7.5), "stone", angle)
            continue
        b.box((mid[0], mid[1], -4), (length + 0.6, 1.2, 7.5), "stone", angle)
        for k in range(int(length / 1.6)):
            t = (k + 0.5) / int(length / 1.6) - 0.5
            b.box((mid[0] + t * length * math.cos(angle),
                   mid[1] + t * length * math.sin(angle), 3.5),
                  (0.8, 1.3, 0.8), "stone", angle)
        if i % 2 == 0:
            b.cylinder((x1, y1, -4), 2.6, 10.5, "stone", 8)
            b.cone((x1, y1, 6.5), 3.2, 4.0, "roof", 8)


def castle():
    clear_scene()
    setup_scene()
    b = Builder("Castle")
    palace(b)
    keep(b)
    gate(b)
    ring_wall(b)
    b.finish()
