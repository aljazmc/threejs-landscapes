from lowpoly import Builder, clear_scene, setup_scene

# The old town houses. Each variant is a root object of its own, laid out
# in a row here; the terrain's markers name a variant as their "part" and
# the app instances it there. Footprints stay within 9 x 9 m, so houses on
# the terrain's 10 m street grid don't overlap.
FLOOR = 3.1
PLINTH = 2.5
SPACING = 16


def body(b, size, floors, wall, floor=FLOOR):
    """Walls on a stone plinth that reaches into sloping ground."""
    b.box((0, 0, -PLINTH), (size[0] + 0.3, size[1] + 0.3, PLINTH + 0.45),
          "stone_dark")
    b.box((0, 0, 0), (size[0], size[1], floors * floor), wall)
    return floors * floor


def chimney(b, x, y, z, height=2.2):
    b.box((x, y, z), (0.7, 0.7, height), "roof_dark")
    b.box((x, y, z + height), (0.9, 0.9, 0.25), "stone_dark")


def house_a(b):
    """Two floors, cream walls, green shutters, ridge along the street."""
    size = (8, 8.5)
    top = body(b, size, 2, "wall_cream")
    b.windows((0, 0, 0), size, 2, FLOOR, door="door", shutters="shutter")
    b.gable_roof((0, 0, top), size, 3.6, "roof", wall="wall_cream")
    chimney(b, 2.2, 1.5, top + 1.2)


def house_b(b):
    """Narrow burgher house of three floors with its gable to the street."""
    size = (7, 9)
    top = body(b, size, 3, "wall_yellow")
    b.windows((0, 0, 0), size, 3, FLOOR, door="door")
    b.gable_roof((0, 0, top), size, 4.6, "roof_dark", wall="wall_yellow",
                 ridge="y")
    b.box((0, -4.55, top + 1.0), (1.0, 0.24, 1.4), "window")
    chimney(b, -1.6, 2.0, top + 2.0)


def house_c(b):
    """Pink shop house with large ground floor windows and a hip roof."""
    size = (9, 8.5)
    top = body(b, size, 2, "wall_pink")
    b.windows((0, 0, 0), size, 1, FLOOR, sides="SN", spacing=3.0,
              door="door", window=(1.8, 1.7))
    b.windows((0, 0, 0), size, 2, FLOOR, first=1)
    b.windows((0, 0, 0), size, 1, FLOOR, sides="EW")
    b.box((0, -4.25, FLOOR - 0.35), (9.2, 1.3, 0.25), "red")
    b.hip_roof((0, 0, top), size, 3.2, "roof")
    chimney(b, -2.5, 1.0, top + 1.0)


def house_d(b):
    """Light blue house of three floors with a dormer in its hip roof."""
    size = (8, 9)
    top = body(b, size, 3, "wall_blue")
    b.windows((0, 0, 0), size, 3, FLOOR, door="door", shutters="wall")
    b.hip_roof((0, 0, top), size, 3.5, "roof_dark")
    b.box((0, -2.6, top + 0.3), (2.2, 2.4, 1.6), "wall_blue")
    b.box((0, -3.85, top + 0.5), (1.0, 0.24, 1.0), "window")
    b.gable_roof((0, -2.6, top + 1.9), (2.2, 2.4), 1.0, "roof_dark",
                 wall="wall_blue", overhang=0.25, thickness=0.2, ridge="y")


def house_e(b):
    """Green house with window flower boxes and a brown roof."""
    size = (8.5, 8.5)
    top = body(b, size, 2, "wall_green")
    b.windows((0, 0, 0), size, 2, FLOOR, door="door")
    for x in (-2.83, 2.83):
        b.box((x, -4.35, FLOOR + 0.8), (1.2, 0.5, 0.35), "red")
        for flower in (-0.35, 0.0, 0.35):
            b.ico((x + flower, -4.4, FLOOR + 1.25), 0.2, "pink")
    b.gable_roof((0, 0, top), size, 3.8, "roof_brown", wall="wall_green")
    chimney(b, -2.0, -1.2, top + 1.4)


def farmhouse(b):
    """Long single floor house of the outskirts."""
    size = (12, 7)
    top = body(b, size, 1, "wall_ochre", 3.4)
    b.windows((0, 0, 0), size, 1, 3.4, sides="SN", spacing=2.6,
              door="door", shutters="wood")
    b.windows((0, 0, 0), size, 1, 3.4, sides="EW")
    b.gable_roof((0, 0, top), size, 3.4, "roof", wall="wood")
    chimney(b, 3.5, 1.0, top + 1.0)


def zidanica(b):
    """White vineyard cottage of Haloze with a steep roof."""
    size = (5.5, 4.5)
    top = body(b, size, 1, "wall", 2.7)
    b.box((0, -2.37, 0), (1.1, 0.24, 2.0), "wood_dark")
    b.box((1.7, -2.37, 1.0), (0.7, 0.24, 0.8), "window")
    b.gable_roof((0, 0, top), size, 3.6, "roof_brown", wall="wood",
                 overhang=0.7, ridge="y")


VARIANTS = (("HouseA", house_a), ("HouseB", house_b), ("HouseC", house_c),
            ("HouseD", house_d), ("HouseE", house_e),
            ("Farmhouse", farmhouse), ("Zidanica", zidanica))


def houses():
    clear_scene()
    setup_scene()
    for index, (name, build) in enumerate(VARIANTS):
        b = Builder(name, seed=index)
        build(b)
        b.finish(location=(index * SPACING, 0, 0))
