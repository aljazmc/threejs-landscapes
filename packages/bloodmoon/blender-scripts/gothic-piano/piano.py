import math

from gothic import candle, gothic_materials
from shooter import box, clear_scene, cylinder, joint, mesh_from, new_object

EXPORT = "glb"

# Black grand piano in the middle of the ballroom, its lid open, with a
# candelabrum on it and its bench, 2.4 m long along Y, the keys at -Y.


def wing_shape(width, length, depth, mat, name, z):
    """The piano's curved outline extruded: straight on the bass side (-X),
    the treble side curving in towards the tail (+Y)."""
    def build(bm):
        half = width / 2
        outline = [(-half, -length / 2), (half, -length / 2)]
        for k in range(1, 13):
            t = k / 12
            y = -length / 2 + length * t
            x = half - (half * 1.4) * (1 - math.cos(t * math.pi / 2)) ** 1.5 * t
            outline.append((max(x, -half + 0.25), y))
        outline.append((-half, length / 2))
        bottom = [bm.verts.new((x, y, z)) for x, y in outline]
        top = [bm.verts.new((x, y, z + depth)) for x, y in outline]
        bm.faces.new(list(reversed(bottom)))
        bm.faces.new(top)
        for i in range(len(outline)):
            j = (i + 1) % len(outline)
            bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    return new_object(name, mesh_from(name, build), mat=mat)


def piano():
    clear_scene()
    m = gothic_materials()
    wing_shape(1.4, 2.0, 0.32, m["ebony"], "Case", 0.62)
    wing_shape(1.3, 1.9, 0.02, m["brass"], "Harp", 0.86)
    for k in range(14):
        box(f"String {k}", (0.006, 1.6, 0.006), m["copper"], location=(-0.55 + 0.07 * k, 0.1, 0.89))
    lid = joint("Lid", location=(-0.7, 0, 0.94))
    lid.rotation_euler = (0, math.radians(-40), 0)
    hinge = wing_shape(1.4, 2.0, 0.025, m["ebony"], "Lid Board", 0)
    hinge.parent = lid
    hinge.location = (0.7, 0, 0)
    cylinder("Prop Stick", 0.012, 0.75, m["ebony"], location=(0.45, -0.2, 0.92), rotation=(0, -32, 0), sides=5)
    box("Keybed", (1.4, 0.3, 0.12), m["ebony"], location=(0, -1.12, 0.74))
    for k in range(28):
        box(f"Key {k}", (0.045, 0.2, 0.02), m["ivory"], location=(-0.63 + 0.0465 * k, -1.13, 0.81))
        if k % 7 not in (2, 6):
            box(f"Black Key {k}", (0.025, 0.12, 0.025), m["ebony"], location=(-0.61 + 0.0465 * k, -1.09, 0.83))
    box("Music Desk", (0.6, 0.03, 0.25), m["ebony"], location=(0, -0.92, 1.0), rotation=(-15, 0, 0))
    for x, y in ((-0.6, -0.9), (0.6, -0.9), (-0.55, 0.85)):
        cylinder("Leg", 0.06, 0.62, m["ebony"], location=(x, y, 0), top=0.05, sides=8)
        cylinder("Caster", 0.04, 0.04, m["brass"], location=(x, y, 0), sides=8)
    box("Lyre", (0.25, 0.04, 0.5), m["ebony"], location=(0, -0.7, 0.3))
    box("Bench", (0.8, 0.35, 0.06), m["ebony"], location=(0, -1.55, 0.5), bevel=0.01)
    box("Bench Seat", (0.75, 0.3, 0.04), m["velvet"], location=(0, -1.55, 0.54), bevel=0.01)
    for x in (-0.35, 0.35):
        for y in (-1.68, -1.42):
            cylinder("Bench Leg", 0.02, 0.47, m["ebony"], location=(x, y, 0), sides=6)
    cylinder("Candelabrum", 0.02, 0.25, m["silver"], location=(-0.45, -0.75, 0.94), sides=6)
    for k in range(3):
        x = -0.45 + 0.12 * (k - 1)
        candle(f"Candle {k}", None, (x, -0.75, 1.19 + (0.05 if k == 1 else 0)), m, 0.14, flicker=f"Flame {k}")
