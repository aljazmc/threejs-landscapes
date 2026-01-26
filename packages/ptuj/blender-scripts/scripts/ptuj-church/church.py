import math

from lowpoly import Builder, clear_scene, setup_scene

# The provost church of St. George (cerkev sv. Jurija) on Slovenski trg: a
# gothic hall church under a steep roof, with a narrower chancel and its
# polygonal apse to the east. It has no tower of its own, the free standing
# city tower next to it is its belfry.
NAVE = (24, 14)
CHANCEL = (12, 10)
WALL = 11


def tall_windows(b, x0, length, y, count):
    for i in range(count):
        x = x0 + (i + 0.5) * length / count
        b.box((x, y, 3.5), (1.1, 0.26, 4.6), "window")
        b.pyramid((x, y, 8.1), (1.1, 0.26), 0.7, "window")


def buttresses(b, x0, length, y, count):
    for i in range(count + 1):
        b.box((x0 + i * length / count, y, -2), (0.9, 1.6, WALL - 1),
              "stone_dark")


def church():
    clear_scene()
    setup_scene()
    b = Builder("Church")
    nave_x = -CHANCEL[0] / 2
    chancel_x = NAVE[0] / 2
    # nave
    b.box((nave_x, 0, -2.5), (NAVE[0], NAVE[1], WALL + 2.5), "wall_ochre")
    b.gable_roof((nave_x, 0, WALL), NAVE, 10, "roof_dark",
                 wall="wall_ochre", ridge="x", overhang=0.6)
    for y in (-NAVE[1] / 2, NAVE[1] / 2):
        tall_windows(b, nave_x - NAVE[0] / 2, NAVE[0], y, 4)
        buttresses(b, nave_x - NAVE[0] / 2, NAVE[0], y, 4)
    # west front with portal and rose window
    west = nave_x - NAVE[0] / 2
    b.box((west - 0.3, 0, 0), (0.6, 3.0, 4.4), "door")
    b.pyramid((west - 0.3, 0, 4.4), (0.6, 3.0), 1.4, "stone_dark")
    b.cylinder((west - 0.15, 0, 8.4), 1.6, 0.3, "window", 10,
               rotation=(0, math.pi / 2, 0))
    b.cylinder((west - 0.3, 0, 8.4), 0.5, 0.3, "gold", 8,
               rotation=(0, math.pi / 2, 0))
    # chancel and apse
    b.box((chancel_x, 0, -2.5), (CHANCEL[0], CHANCEL[1], WALL + 1.5),
          "wall_ochre")
    b.gable_roof((chancel_x, 0, WALL - 1), CHANCEL, 7.5, "roof_dark",
                 wall="wall_ochre", ridge="x", overhang=0.4)
    for y in (-CHANCEL[1] / 2, CHANCEL[1] / 2):
        tall_windows(b, chancel_x - CHANCEL[0] / 2, CHANCEL[0], y, 2)
    apse = chancel_x + CHANCEL[0] / 2
    b.cylinder((apse, 0, -2.5), CHANCEL[1] / 2, WALL + 1.5, "wall_ochre", 8)
    b.cone((apse, 0, WALL - 1), CHANCEL[1] / 2 + 0.4, 7.5, "roof_dark", 8)
    for angle in (-50, 0, 50):
        a = math.radians(angle)
        r = CHANCEL[1] / 2
        b.box((apse + r * math.cos(a), r * math.sin(a), 3.5), (0.26, 1.0, 4.2),
              "window", a)
    # roof turret over the crossing
    b.cylinder((chancel_x - CHANCEL[0] / 2, 0, WALL + 7), 0.9, 2.6, "copper", 6)
    b.cone((chancel_x - CHANCEL[0] / 2, 0, WALL + 9.6), 1.1, 3.4, "copper", 6)
    b.finish()
