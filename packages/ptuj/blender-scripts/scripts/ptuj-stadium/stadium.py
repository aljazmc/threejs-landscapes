import math

from lowpoly import Builder, clear_scene, setup_scene

# Mestni stadion, the town stadium on the right bank of the Drava: a
# football pitch inside a running track, the main stand under its roof on
# the south (front) side with the entrance behind it, a lower stand across
# and floodlights in the corners.
PITCH = (60, 36)
TRACK = 3.5
ROW = (1.1, 0.6)  # depth and rise of a row of seats
MAIN = 7
OPPOSITE = 4
STRIPES = 10


def stand(b, y0, sign, rows, length, mat):
    """Rows of seats stepping up and away from the track, a wall behind."""
    depth, rise = ROW
    for row in range(rows):
        y = y0 + sign * (row + 0.5) * depth
        b.box((0, y, -1.5), (length, depth, 1.5 + (row + 1) * rise),
              "stone")
        b.box((0, y + sign * 0.25, (row + 1) * rise), (length - 0.6, 0.4,
                                                       0.35), mat)
    y = y0 + sign * rows * depth
    b.box((0, y + sign * 0.3, -1.5), (length, 0.6, 1.5 + rows * rise + 1.2),
          "wall")
    for x in (-length / 2, length / 2):
        b.prism((x, y0, -1.5), [(0, 0), (0, sign * rows * depth),
                                (0.4, sign * rows * depth), (0.4, 0)],
                1.5 + rows * rise + 1.2, "wall")
    return y


def lines(b, z):
    w, d = PITCH[0] / 2 - 1, PITCH[1] / 2 - 1
    t = 0.15
    for y in (-d, d):
        b.box((0, y, z), (2 * w, t, 0.03), "white")
    for x in (-w, 0, w):
        b.box((x, 0, z), (t, 2 * d, 0.03), "white")
    for i in range(16):
        a = 2 * math.pi * i / 16
        b.box((5 * math.cos(a), 5 * math.sin(a), z), (t, 2.0, 0.03),
              "white", a)
    for sign in (-1, 1):
        x = sign * (w - 8)
        b.box((x, 0, z), (t, 20, 0.03), "white")
        for y in (-10, 10):
            b.box((sign * (w - 4), y, z), (8, t, 0.03), "white")
        # goal
        for y in (-3.6, 3.6):
            b.box((sign * w, y, z), (0.15, 0.15, 2.4), "white")
        b.box((sign * w, 0, z + 2.4), (0.15, 7.35, 0.15), "white")
        b.box((sign * (w + 1), 0, z), (0.1, 7.2, 2.4), "stone")


def floodlight(b, x, y):
    b.cylinder((x, y, -1), 0.45, 21, "stone_dark", 6, 0.3)
    toward = math.atan2(-y, -x)
    b.box((x, y, 20), (2.6, 0.5, 2.0), "white", (0.4, 0, toward - math.pi / 2))
    b.box((x + 0.3 * math.cos(toward), y + 0.3 * math.sin(toward), 20.3),
          (2.2, 0.2, 1.4), "yellow", (0.4, 0, toward - math.pi / 2))


def stadium():
    clear_scene()
    setup_scene()
    b = Builder("Stadium")
    w, d = PITCH[0] / 2 + TRACK, PITCH[1] / 2 + TRACK
    b.box((0, 0, -1.5), (2 * w + 2, 2 * d + 2, 1.6), "stone")
    b.box((0, 0, 0.1), (2 * w, 2 * d, 0.08), "track")
    for i in range(STRIPES):
        x = -PITCH[0] / 2 + (i + 0.5) * PITCH[0] / STRIPES
        b.box((x, 0, 0.12), (PITCH[0] / STRIPES, PITCH[1], 0.08),
              "grass" if i % 2 else "meadow")
    lines(b, 0.2)
    # main stand, its roof on columns and the entrance in its back wall
    back = stand(b, -d - 1, -1, MAIN, 2 * w - 6, "red")
    roof = MAIN * ROW[1] + 4.5
    for x in (-w + 4, -w / 3, w / 3, w - 4):
        b.box((x, back + 0.3, 0), (0.4, 0.4, roof), "white")
    slab = ((back - 0.5, roof + 0.4), (-d - 1.5, roof - 0.6),
            (-d - 1.5, roof - 0.3), (back - 0.5, roof + 0.7))
    b.polygons([(x, y, z) for x in (-w + 2, w - 2) for y, z in slab],
               [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5),
                (2, 3, 7, 6), (3, 0, 4, 7)], "roof")
    for x in (-8, 0, 8):
        b.box((x, back - 0.15, 0), (2.4, 0.3, 2.8), "door")
    b.box((0, back - 0.15, 3.3), (10, 0.3, 1.2), "blue")
    b.box((0, back - 0.3, 3.55), (8, 0.1, 0.7), "white")
    # the lower stand across
    stand(b, d + 1, 1, OPPOSITE, 2 * w - 16, "blue")
    # scoreboard behind the west goal and the floodlights
    b.box((-w - 1.5, 0, -1), (0.6, 0.6, 6), "stone_dark")
    b.box((-w - 1.5, 0, 5), (0.6, 8, 3), "black")
    b.box((-w - 1.15, 0, 5.6), (0.1, 6.5, 1.6), "yellow")
    for x in (-w - 1, w + 1):
        for y in (-d - 3, d + 3):
            floodlight(b, x, y)
    b.finish()
