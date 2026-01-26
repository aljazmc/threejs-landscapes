import math

from lowpoly import Builder, clear_scene, setup_scene

# A timber raft of the Drava rafters (splavarji) with its steering oars, a
# bench, a barrel and two rafters in hats. It floats with Z = 0 at the water
# line and the bow towards -Y, the way the app moves it downstream.
LOGS = 7
LENGTH = 11


def rafter(b, x, y):
    b.cylinder((x, y, 0.5), 0.35, 1.1, "blue", 8, 0.3)
    b.ico((x, y, 1.9), 0.33, "skin", 1)
    b.cylinder((x, y, 2.1), 0.55, 0.08, "wood_dark", 8)
    b.cylinder((x, y, 2.18), 0.28, 0.35, "wood_dark", 8)
    b.cylinder((x, y, 1.6), 0.2, 0.15, "skin", 6)


def raft():
    clear_scene()
    setup_scene()
    b = Builder("Raft")
    width = LOGS * 0.7
    for i in range(LOGS):
        x = -width / 2 + 0.35 + i * 0.7
        length = LENGTH - (0.6 if i % 2 else 0)
        b.cylinder((x, length / 2, 0), 0.35, length, "wood", 7,
                   rotation=(math.pi / 2, 0, 0))
    for y in (-LENGTH / 2 + 1, 0, LENGTH / 2 - 1):
        b.box((0, y, 0.25), (width + 0.4, 0.4, 0.25), "wood_dark")
    # steering oars on trestles at bow and stern
    for y, sign in ((-LENGTH / 2 + 0.6, -1), (LENGTH / 2 - 0.6, 1)):
        b.box((0, y, 0.4), (0.3, 0.3, 1.1), "wood_dark")
        b.box((0, y + sign * 2.2, 1.0), (0.2, 6.0, 0.2), "wood",
              rotation=(sign * 0.18, 0, 0))
        b.box((0, y + sign * 4.8, 0.5), (0.8, 1.4, 0.1), "wood",
              rotation=(sign * 0.18, 0, 0))
    b.box((-1.2, 1.5, 0.4), (1.6, 0.6, 0.5), "wood_dark")
    b.cylinder((1.3, 2.0, 0.35), 0.45, 1.0, "wood_dark", 8, 0.5)
    b.cylinder((1.3, 2.0, 0.6), 0.55, 0.12, "black", 8)
    rafter(b, 0.6, -LENGTH / 2 + 1.6)
    rafter(b, -0.6, LENGTH / 2 - 1.6)
    # flag in the colors of the town, low enough to pass under the middle
    # arch of ptuj-bridge
    b.cylinder((-1.8, -1.0, 0.35), 0.06, 2.2, "wood_dark", 6)
    b.box((-1.8, -1.6, 2.0), (0.05, 1.1, 0.4), "red")
    b.box((-1.8, -1.6, 1.6), (0.05, 1.1, 0.4), "white")
    b.finish()
