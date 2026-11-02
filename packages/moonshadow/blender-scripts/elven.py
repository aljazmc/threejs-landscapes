"""The look of the elven keep: white stone, gold filigree, dark wood, green
leaves, moon-blue runes and warm fire, shared by its props and weapons."""

import math

from shooter import cylinder, joint, material, sphere, torus, tube


def elven_materials():
    return {
        "stone": material("Moonstone", "#d8d4c8", 0.55, 0.0),
        "darkstone": material("Grey Stone", "#7a7a78", 0.7, 0.0),
        "marble": material("Marble", "#f0eee6", 0.25, 0.0),
        "gold": material("Gold", "#e0b040", 0.3, 1.0),
        "silver": material("Silver", "#d0d8e0", 0.25, 1.0),
        "wood": material("Elm", "#6a4024", 0.6, 0.0),
        "darkwood": material("Dark Wood", "#3a2414", 0.6, 0.0),
        "bark": material("Silver Bark", "#b8b4a8", 0.8, 0.0),
        "leaf": material("Leaf", "#3a8a3a", 0.6, 0.0),
        "darkleaf": material("Dark Leaf", "#1e5a2a", 0.6, 0.0),
        "velvet": material("Velvet", "#1e3a7a", 0.9, 0.0),
        "green velvet": material("Green Velvet", "#1e5a3a", 0.9, 0.0),
        "linen": material("Linen", "#e8e2d0", 0.9, 0.0),
        "parchment": material("Parchment", "#d8c8a0", 0.9, 0.0),
        "water": material("Water", "#4ab8e0", 0.05, 0.0, emission=0.6),
        "rune": material("Rune Light", "#7ae0ff", emission=5.0),
        "moon": material("Moonlight", "#c8e8ff", emission=4.0),
        "fire": material("Fire", "#ffa030", emission=8.0),
        "ember": material("Ember", "#ff5a10", emission=5.0),
        "crystal": material("Crystal", "#b07aff", 0.1, 0.0, emission=3.0),
        "blossom": material("Blossom", "#ffd0f0", 0.6, 0.0, emission=0.8),
    }


def leaf_cluster(name, parent, location, radius, mats, count=7, seed=1):
    """A bunch of leaves around location: squashed spheres in two greens."""
    import random
    rng = random.Random(seed)
    for index in range(count):
        offset = (rng.uniform(-1, 1) * radius, rng.uniform(-1, 1) * radius,
                  rng.uniform(-0.5, 0.7) * radius)
        sphere(f"{name} {index}", radius * rng.uniform(0.45, 0.7),
               mats[index % len(mats)], parent,
               tuple(location[i] + offset[i] for i in range(3)),
               scale=(1.0, 1.0, 0.6), subdivisions=1)


def filigree_arch(name, parent, width, height, mat, location=(0, 0, 0), rotation=(0, 0, 0)):
    """A pointed elven arch of gold wire in the XZ plane."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    half = width / 2
    points = [(-half, 0, 0), (-half, 0, height * 0.6)]
    points += [(-half * (1 - t) ** 1.3, 0, height * (0.6 + 0.4 * math.sin(t * math.pi / 2)))
               for t in (i / 6 for i in range(1, 7))]
    tube(name + " Left", points, 0.015, mat, holder)
    tube(name + " Right", [(-x, y, z) for x, y, z in points], 0.015, mat, holder)
    return holder


def column(name, parent, height, radius, stone, gold, location=(0, 0, 0)):
    """A slender column with a gold capital and a leafy top."""
    holder = joint(name, parent, location)
    cylinder(name + " Base", radius * 1.4, 0.15, stone, holder, sides=12)
    cylinder(name + " Shaft", radius, height - 0.3, stone, holder, (0, 0, 0.15), top=radius * 0.85,
             sides=12)
    cylinder(name + " Capital", radius * 0.85, 0.15, gold, holder, (0, 0, height - 0.15),
             top=radius * 1.5, sides=12)
    for index in range(3):
        torus(f"{name} Ring {index}", radius * 1.02, 0.012, gold, holder,
              (0, 0, 0.4 + index * (height - 0.8) / 2), segments=16, sides=4)
    return holder
