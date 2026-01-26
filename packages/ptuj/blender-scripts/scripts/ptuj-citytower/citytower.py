import math

from lowpoly import Builder, clear_scene, setup_scene

# Mestni stolp, the free standing city tower on Slovenski trg, belfry of
# St. George's: a square shaft with corner pilasters, clocks above the bell
# openings and a green baroque bulb cap.
SIDE = 7.5
SHAFT = 28
CLOCK = 22


def citytower():
    clear_scene()
    setup_scene()
    b = Builder("CityTower")
    half = SIDE / 2
    b.box((0, 0, -3), (SIDE + 1.0, SIDE + 1.0, 4), "stone_dark")
    b.box((0, 0, 0), (SIDE, SIDE, SHAFT), "stone")
    for x in (-half, half):
        for y in (-half, half):
            b.box((x, y, 0), (1.1, 1.1, SHAFT), "wall")
    for z in (9, 18.5, SHAFT - 0.6):
        b.box((0, 0, z), (SIDE + 0.7, SIDE + 0.7, 0.6), "wall")
    # door, slit windows, bell openings and clocks on all four sides
    b.box((0, -half - 0.02, 0), (1.8, 0.3, 3.2), "door")
    for angle in range(4):
        a = angle * math.pi / 2
        nx, ny = math.sin(a), -math.cos(a)
        for z in (11.5, 14.5):
            b.box((nx * half, ny * half, z), (0.6, 0.3, 1.8), "window", a)
        b.box((nx * half, ny * half, CLOCK - 2.8), (2.4, 0.3, 2.2), "black",
              a)
        b.pyramid((nx * half, ny * half, CLOCK - 0.6), (2.4, 0.3), 0.8,
                  "black", a)
        face = (nx * (half + 0.1), ny * (half + 0.1), CLOCK + 2.6)
        b.cylinder(face, 1.6, 0.3, "white", 12,
                   rotation=(math.pi / 2, 0, a))
        b.box((face[0] + nx * 0.15, face[1] + ny * 0.15, face[2] - 0.1),
              (0.2, 0.15, 1.2), "black", a)
        b.box((face[0] + nx * 0.15, face[1] + ny * 0.15, face[2] - 0.1),
              (0.9, 0.15, 0.2), "black", a)
    b.onion((0, 0, SHAFT), 3.2, "copper")
    b.finish()
