import math

from gothic import gothic_materials
from shooter import box, clear_scene, cylinder, joint, mesh_from, new_object, sphere, tube

EXPORT = "glb"

# A stone gargoyle crouching on a pillar, wings half spread, horns and a
# grinning maw, its eyes glowing red; facing -Y.


def gargoyle():
    clear_scene()
    m = gothic_materials()
    s = m["stone"]
    box("Pillar", (0.8, 0.8, 1.1), m["darkstone"], location=(0, 0, 0.55), bevel=0.04)
    box("Pillar Cap", (0.9, 0.9, 0.1), s, location=(0, 0, 1.15), bevel=0.03)
    body = joint("Figure", location=(0, 0, 1.2))
    sphere("Haunch", 0.25, s, body, (0, 0.1, 0.22), scale=(1.2, 1, 0.8))
    sphere("Chest", 0.22, s, body, (0, -0.08, 0.55), scale=(1.1, 0.9, 1.1))
    for side in (1, -1):
        tube(f"Arm {side}", [(side * 0.2, -0.1, 0.65), (side * 0.25, -0.2, 0.35), (side * 0.14, -0.3, 0.05)],
             0.05, s, body)
        for k in range(3):
            cylinder(f"Talon {side} {k}", 0.015, 0.08, s, body, (side * 0.14 + 0.03 * (k - 1), -0.34, 0.02),
                     rotation=(100, 0, 0), top=0.0, sides=4)
        tube(f"Leg {side}", [(side * 0.25, 0.15, 0.2), (side * 0.3, -0.05, 0.12), (side * 0.25, -0.15, 0.02)],
             0.07, s, body)
        # wing: a bone with a membrane, half spread backwards
        wing = joint(f"Wing {side}", body, (side * 0.15, 0.1, 0.7))
        wing.rotation_euler = (math.radians(-20), 0, math.radians(side * 30))
        tube(f"Wing Bone {side}", [(0, 0, 0), (side * 0.4, 0.15, 0.35), (side * 0.75, 0.3, 0.2)], 0.03, s, wing)

        def membrane(bm, side=side):
            points = [(0, 0, 0), (side * 0.4, 0.15, 0.35), (side * 0.75, 0.3, 0.2),
                      (side * 0.6, 0.3, -0.2), (side * 0.35, 0.2, -0.15), (side * 0.15, 0.1, -0.3)]
            bm.faces.new([bm.verts.new(p) for p in points])
        new_object(f"Wing Membrane {side}", mesh_from(f"Wing Membrane {side}", membrane), wing, mat=s)
        cylinder(f"Horn {side}", 0.035, 0.22, s, body, (side * 0.09, -0.1, 0.92),
                 rotation=(-30, side * 25, 0), top=0.0, sides=6)
        cylinder(f"Ear {side}", 0.03, 0.12, s, body, (side * 0.13, -0.05, 0.86), rotation=(0, side * -70, 0),
                 top=0.0, sides=4)
        sphere(f"Eye {side}", 0.022, m["evil"], body, (side * 0.06, -0.27, 0.86))
    sphere("Head", 0.14, s, body, (0, -0.12, 0.85), scale=(1, 1.1, 0.9))
    sphere("Snout", 0.09, s, body, (0, -0.25, 0.78), scale=(1, 1.1, 0.7))
    box("Maw", (0.12, 0.04, 0.03), m["marble"], location=(0, -0.33, 1.95))
    for k in range(4):
        cylinder(f"Fang {k}", 0.01, 0.04, m["bone"], body, (-0.045 + 0.03 * k, -0.33, 0.73),
                 rotation=(180, 0, 0), top=0.0, sides=4)
    tube("Tail", [(0, 0.3, 0.2), (0.15, 0.45, 0.0), (0.05, 0.42, -0.2), (-0.1, 0.45, -0.35)],
         lambda t: 0.05 * (1 - t) + 0.01, s, body)
