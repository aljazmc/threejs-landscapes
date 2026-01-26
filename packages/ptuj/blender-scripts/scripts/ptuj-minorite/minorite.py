from lowpoly import Builder, clear_scene, setup_scene

# Minoritski samostan, the Minorite friary by the Drava: the church of
# St. Peter and Paul with its bell tower on the north side and the yellow
# baroque friary around a cloister garden on the south side.
CHURCH = (28, 11)
FRIARY = (30, 24)
WING = 8
FLOOR = 3.5


def minorite():
    clear_scene()
    setup_scene()
    b = Builder("Minorite")
    church_y = 9.5
    friary_y = church_y - CHURCH[1] / 2 - FRIARY[1] / 2
    # church
    b.box((0, church_y, -2.5), (CHURCH[0], CHURCH[1], 12.5), "wall")
    b.gable_roof((0, church_y, 10), CHURCH, 7.5, "roof", wall="wall",
                 ridge="x")
    for y in (church_y - CHURCH[1] / 2, church_y + CHURCH[1] / 2):
        for i in range(5):
            x = -CHURCH[0] / 2 + (i + 0.5) * CHURCH[0] / 5
            b.box((x, y, 3), (1.2, 0.26, 4), "window")
            b.pyramid((x, y, 7), (1.2, 0.26), 0.6, "window")
    b.cylinder((CHURCH[0] / 2, church_y, -2.5), CHURCH[1] / 2, 12.5, "wall",
               8)
    b.cone((CHURCH[0] / 2, church_y, 10), CHURCH[1] / 2 + 0.4, 6, "roof", 8)
    # bell tower over the west end
    tower = (-CHURCH[0] / 2 + 3, church_y + CHURCH[1] / 2 + 2.5)
    b.box((tower[0], tower[1], -2.5), (6, 6, 27.5), "wall")
    b.box((tower[0], tower[1], 25 - 0.5), (6.6, 6.6, 0.6), "stone")
    b.windows((tower[0], tower[1], 0), (6, 6), 6, 4, spacing=3.0,
              window=(0.7, 1.4), first=1)
    b.onion((tower[0], tower[1], 25), 2.6, "copper")
    # friary around the cloister
    w, d = FRIARY[0] / 2, FRIARY[1] / 2
    inner = d - WING
    wings = (((0, friary_y - d + WING / 2), (FRIARY[0], WING)),
             ((-w + WING / 2, friary_y), (WING, 2 * inner)),
             ((w - WING / 2, friary_y), (WING, 2 * inner)))
    for (x, y), size in wings:
        b.box((x, y, -2.5), (size[0], size[1], 2 * FLOOR + 2.5),
              "wall_yellow")
        b.windows((x, y, 0), size, 2, FLOOR, spacing=2.6, shutters="wall")
        b.hip_roof((x, y, 2 * FLOOR), size, 3.2, "roof", overhang=0.6)
    b.box((0, friary_y - d - 0.05, 0), (1.6, 0.3, 2.6), "door")
    # cloister garden with a well
    b.box((0, friary_y + WING / 2, -0.3), (FRIARY[0] - 2 * WING, 2 * inner,
                                           0.5), "grass_dark")
    b.cylinder((0, friary_y + WING / 2, 0), 0.9, 0.9, "stone", 8)
    b.finish()
