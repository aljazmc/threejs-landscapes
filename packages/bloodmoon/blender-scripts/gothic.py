"""The look of the vampire castle: black stone, wrought iron, dark oak, blood
red velvet, tarnished silver and brass, candle fire and a cold moonlight,
shared by its props and the hunter's weapons."""

import math

from shooter import box, cylinder, joint, material, sphere, tube


def gothic_materials():
    return {
        "stone": material("Castle Stone", "#5a5650", 0.8, 0.0),
        "darkstone": material("Black Stone", "#2a2826", 0.85, 0.0),
        "marble": material("Black Marble", "#1e1c22", 0.2, 0.0),
        "bone": material("Old Bone", "#d8ccb0", 0.6, 0.0),
        "iron": material("Wrought Iron", "#2a2a2e", 0.45, 0.9),
        "silver": material("Tarnished Silver", "#b0b4b8", 0.3, 1.0),
        "brass": material("Brass", "#c8963a", 0.3, 1.0),
        "copper": material("Copper", "#b8643a", 0.35, 1.0),
        "gold": material("Old Gold", "#c8a040", 0.35, 1.0),
        "oak": material("Dark Oak", "#3a2416", 0.6, 0.0),
        "ebony": material("Ebony", "#16100c", 0.4, 0.0),
        "leather": material("Leather", "#3a2214", 0.7, 0.0),
        "velvet": material("Blood Velvet", "#6a0a14", 0.9, 0.0),
        "purple": material("Purple Velvet", "#3a0a3a", 0.9, 0.0),
        "linen": material("Grey Linen", "#bab4a8", 0.9, 0.0),
        "cobweb": material("Cobweb", "#c8c8c0", 0.9, 0.0),
        "ivory": material("Ivory", "#e8e0c8", 0.3, 0.0),
        "wax": material("Wax", "#e8dcc0", 0.5, 0.0),
        "blood": material("Blood", "#7a0008", 0.15, 0.0, emission=0.4),
        "fire": material("Candle Fire", "#ffa040", emission=8.0),
        "ember": material("Ember", "#ff5010", emission=5.0),
        "moon": material("Moonlight", "#b8d0ff", emission=3.0),
        "evil": material("Blood Glow", "#ff1a2a", emission=5.0),
        "glass": material("Glass", "#9ad0c8", 0.05, 0.0, emission=0.3),
    }


def candle(name, parent, location, mats, height=0.2, radius=0.025, flicker=None):
    """A wax candle with its flame; flicker names the flame's joint ("Flame n"),
    which the game scales up and down."""
    x, y, z = location
    cylinder(name + " Wax", radius, height, mats["wax"], parent, (x, y, z), sides=8)
    holder = joint(flicker, parent, (x, y, z + height)) if flicker else parent
    offset = (0, 0, 0) if flicker else (x, y, z + height)
    sphere(name + " Flame", radius * 0.9, mats["fire"], holder,
           (offset[0], offset[1], offset[2] + radius * 1.4), scale=(1, 1, 1.9), subdivisions=1)


def pointed_arch(name, parent, width, height, radius, mat, location=(0, 0, 0), rotation=(0, 0, 0)):
    """A gothic pointed arch of iron or stone in the XZ plane."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    half = width / 2
    points = [(-half, 0, 0), (-half, 0, height * 0.55)]
    points += [(-half * (1 - math.sin(t * math.pi / 2)), 0,
                height * (0.55 + 0.45 * (1 - math.cos(t * math.pi / 2)) ** 0.7))
               for t in (i / 6 for i in range(1, 7))]
    tube(name + " Left", points, radius, mat, holder)
    tube(name + " Right", [(-x, y, z) for x, y, z in points], radius, mat, holder)
    return holder


def spire(name, parent, height, radius, mat, location=(0, 0, 0), top=None):
    """A pointed finial: a thin pinnacle with a ball."""
    x, y, z = location
    cylinder(name, radius, height, mat, parent, (x, y, z), top=0.0, sides=6)
    sphere(name + " Knob", radius * 0.9, top or mat, parent, (x, y, z + height * 0.3))


def cobweb(name, parent, mats, location, size=0.4, rotation=(0, 0, 0)):
    """A corner cobweb: a fan of thin threads with rings across them."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    for k in range(5):
        a = math.radians(k * 22.5)
        tube(f"{name} Thread {k}", [(0, 0, 0), (size * math.cos(a), 0, -size * math.sin(a))],
             0.003, mats["cobweb"], holder, sides=3)
    for r in (0.4, 0.7, 1.0):
        points = [(size * r * math.cos(math.radians(a)), 0, -size * r * math.sin(math.radians(a)))
                  for a in range(0, 91, 15)]
        tube(f"{name} Ring {r}", points, 0.0025, mats["cobweb"], holder, sides=3)
    return holder
