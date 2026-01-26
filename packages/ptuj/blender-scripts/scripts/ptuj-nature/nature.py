from lowpoly import Builder, clear_scene, setup_scene

# Trees, bushes, a park bench and clouds. Like the houses, every variant is
# a root object of its own that the terrain's markers (or the app, for the
# drifting clouds) name as their "part".
SPACING = 12


def round_tree(b):
    b.cylinder((0, 0, -0.5), 0.35, 3.3, "trunk", 6, 0.25)
    b.ico((0, 0, 4.4), 2.4, "leaf", 1, jitter=0.15)
    b.ico((0.9, -0.6, 3.6), 1.4, "leaf", 1, jitter=0.15)


def double_tree(b):
    b.cylinder((0, 0, -0.5), 0.4, 3.0, "trunk", 6, 0.3)
    b.ico((-0.6, 0.2, 3.9), 2.1, "leaf_light", 1, jitter=0.15)
    b.ico((0.9, -0.3, 5.0), 1.8, "leaf_light", 1, jitter=0.15)


def pine(b):
    b.cylinder((0, 0, -0.5), 0.35, 2.5, "trunk", 6)
    for i, (radius, z) in enumerate(((2.6, 1.6), (2.0, 3.6), (1.4, 5.5))):
        b.cone((0, 0, z), radius, 2.8, "leaf_dark", 7, rotation=i * 0.4)


def poplar(b):
    b.cylinder((0, 0, -0.5), 0.35, 2.5, "trunk", 6)
    b.ico((0, 0, 6.0), 1.5, "leaf", 1, scale=(1, 1, 3.0), jitter=0.1)


def bush(b):
    b.ico((0, 0, 0.6), 1.1, "leaf_dark", 1, scale=(1.2, 1, 0.8), jitter=0.2)
    b.ico((0.8, 0.3, 0.5), 0.8, "leaf", 1, jitter=0.2)


def bench(b):
    """Park bench facing -Y, its back to +Y."""
    for x in (-0.7, 0.7):
        b.box((x, 0, -0.3), (0.12, 0.5, 0.75), "black")
        b.box((x, 0.25, 0.45), (0.1, 0.1, 0.5), "black")
    for y in (-0.15, 0.05):
        b.box((0, y, 0.45), (1.8, 0.16, 0.06), "wood")
    for z in (0.65, 0.8):
        b.box((0, 0.28, z), (1.8, 0.05, 0.1), "wood")


def cloud(puffs):
    def build(b):
        for x, y, z, radius in puffs:
            b.ico((x, y, z), radius, "cloud", 1, scale=(1, 1, 0.7),
                  jitter=0.08)
    return build


VARIANTS = (
    ("TreeRound", round_tree), ("TreeDouble", double_tree),
    ("TreePine", pine), ("TreePoplar", poplar), ("Bush", bush),
    ("Bench", bench),
    ("Cloud1", cloud(((0, 0, 0, 6), (6, 1, -1, 4.5), (-6, -1, -1.5, 4),
                      (2, -2, 2, 4)))),
    ("Cloud2", cloud(((0, 0, 0, 5), (5, 0, -0.5, 4), (-4.5, 1, -1, 3.5)))),
    ("Cloud3", cloud(((0, 0, 0, 7), (8, 2, -1.5, 5), (-7, 0, -1, 5.5),
                      (-2, 3, 2.5, 4.5), (4, -2, 1.5, 4)))),
)


def nature():
    clear_scene()
    setup_scene()
    for index, (name, build) in enumerate(VARIANTS):
        b = Builder(name, seed=index)
        build(b)
        b.finish(location=(index * SPACING, 0, 0))
