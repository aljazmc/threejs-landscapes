from gothic import candle, gothic_materials
from shooter import box, clear_scene, cylinder, joint, mesh_from, new_object, sphere

EXPORT = "glb"

# A vampire's coffin on a bier in the far corner of the crypt, facing -Y
# with its head at +X: black wood with a silver cross gone dark, lined with
# red velvet. Its lid lifts and drops back ("Pump" joint, bobbing in the
# game) as something stirs inside, its glowing eyes peering out.


def coffin_shape(name, depth, mat, z, scale=1.0):
    """The six-sided coffin outline, 2 m long along X, extruded."""
    def build(bm):
        outline = [(-1.0, -0.25), (0.45, -0.35), (1.0, -0.28), (1.0, 0.28), (0.45, 0.35), (-1.0, 0.25)]
        outline = [(x * scale, y * scale) for x, y in outline]
        bottom = [bm.verts.new((x, y, z)) for x, y in outline]
        top = [bm.verts.new((x, y, z + depth)) for x, y in outline]
        bm.faces.new(list(reversed(bottom)))
        bm.faces.new(top)
        for i in range(len(outline)):
            j = (i + 1) % len(outline)
            bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    return new_object(name, mesh_from(name, build), mat=mat)


def coffin():
    clear_scene()
    m = gothic_materials()
    box("Bier", (2.2, 0.9, 0.45), m["darkstone"], location=(0, 0, 0.225), bevel=0.03)
    coffin_shape("Box", 0.45, m["ebony"], 0.45)
    coffin_shape("Lining", 0.02, m["velvet"], 0.86, 0.9)
    lid = joint("Pump 0", location=(0, 0, 0.92))
    holder = coffin_shape("Lid", 0.07, m["ebony"], 0)
    holder.parent = lid
    holder.location = (0, -0.06, 0.04)
    holder.rotation_euler = (0.12, 0, 0)
    box("Cross", (1.0, 0.06, 0.02), m["silver"], lid, (0.05, -0.06, 0.13), rotation=(7, 0, 0))
    box("Cross Bar", (0.06, 0.4, 0.02), m["silver"], lid, (0.35, -0.06, 0.13), rotation=(7, 0, 0))
    for x in (0.6, 0.68):
        sphere(f"Eye {x}", 0.02, m["evil"], location=(x, -0.36, 0.9), scale=(1.2, 1, 0.6))
    for x in (-0.95, 0.95):
        for y in (-0.3, 0.3):
            box("Handle", (0.12, 0.02, 0.04), m["iron"], location=(x * 0.6, y * 1.2, 0.65))
    for x in (-1.05, 1.05):
        cylinder("Candlestick", 0.05, 0.9, m["iron"], location=(x, -0.5, 0), top=0.02, sides=6)
        candle(f"Candle {x}", None, (x, -0.5, 0.9), m, 0.25, flicker=f"Flame {int(x > 0)}")
