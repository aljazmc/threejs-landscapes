import math

from lowpoly import Builder, clear_scene, setup_scene

# Mestna hiša, the town hall on Mestni trg built in 1907: a neo-gothic front
# with two stepped gables, an arcade on the ground floor and the slender
# clock tower in its middle.
SIZE = (26, 12)
FLOOR = 4
FLOORS = 3


def stepped_gable(b, x, y, z, width, steps, wall):
    step_height = 1.3
    for step in range(steps):
        w = width * (1 - step / steps)
        top = z + (step + 1) * step_height
        b.box((x, y, z + step * step_height), (w, 0.8, step_height), wall)
        for corner in (-1, 1):
            b.ico((x + corner * (w / 2 - 0.2), y, top + 0.15), 0.3, "stone")
    b.box((x, y - 0.42, z + 0.9), (1.2, 0.2, 1.6), "window")


def townhall():
    clear_scene()
    setup_scene()
    b = Builder("TownHall")
    w, d = SIZE[0] / 2, SIZE[1] / 2
    top = FLOOR * FLOORS
    b.box((0, 0, -2.5), (SIZE[0], SIZE[1], top + 2.5), "wall_ochre")
    b.box((0, 0, FLOOR - 0.3), (SIZE[0] + 0.3, SIZE[1] + 0.3, 0.3), "stone")
    b.box((0, 0, top - 0.4), (SIZE[0] + 0.4, SIZE[1] + 0.4, 0.4), "stone")
    b.windows((0, 0, 0), SIZE, FLOORS, FLOOR, sides="NEW", first=1,
              window=(1.1, 1.8))
    b.windows((0, 0, 0), SIZE, FLOORS, FLOOR, sides="S", first=1,
              window=(1.1, 2.0), spacing=2.4)
    # arcade along the square
    for i in range(7):
        x = -w + 2 + i * (SIZE[0] - 4) / 6
        b.box((x, -d - 0.05, 0), (2.4, 0.3, 2.6), "window")
        b.pyramid((x, -d - 0.05, 2.6), (2.4, 0.3), 0.8, "window")
    b.hip_roof((0, 0, top), SIZE, 5, "roof_dark", overhang=0.5)
    for x in (-8, 8):
        stepped_gable(b, x, -d + 0.3, top, 7, 4, "wall_ochre")
    # clock tower in the middle of the front
    tower = (0, -d + 1.5)
    t_top = top + 11
    b.box((tower[0], tower[1], 0), (5, 5, t_top), "wall_ochre")
    b.box((tower[0], tower[1] - 2.55, 0), (2.4, 0.2, 3.4), "door")
    b.windows((tower[0], tower[1], 0), (5, 5), 4, 4, sides="S", first=1,
              window=(1.0, 1.8))
    b.cylinder((tower[0], tower[1] - 2.6, t_top - 2.6), 1.5, 0.25, "white",
               12, rotation=(math.pi / 2, 0, 0))
    b.box((tower[0], tower[1] - 2.8, t_top - 2.7), (0.2, 0.15, 1.1), "black")
    b.box((tower[0] + 0.3, tower[1] - 2.8, t_top - 2.7), (0.8, 0.15, 0.2),
          "black")
    b.box((tower[0], tower[1], t_top), (5.6, 5.6, 0.5), "stone")
    b.pyramid((tower[0], tower[1], t_top + 0.5), (5.2, 5.2), 8, "copper")
    b.cone((tower[0], tower[1], t_top + 8.4), 0.12, 2.5, "gold", 6)
    for x in (-2.5, 2.5):
        for y in (-2.5, 2.5):
            b.cylinder((tower[0] + x, tower[1] + y, t_top + 0.5), 0.45, 1.4,
                       "stone", 6)
            b.cone((tower[0] + x, tower[1] + y, t_top + 1.9), 0.55, 2.2,
                   "copper", 6)
    b.finish()
