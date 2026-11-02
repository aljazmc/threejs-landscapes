import math

from elven import elven_materials
from shooter import clear_scene, cylinder, joint, sphere, torus

EXPORT = "glb"

# Round fountain of the grove hall, 3 m across: a basin with glowing water,
# a column of two bowls and a swan on top; its water rings turn ("Spin").


def fountain():
    clear_scene()
    m = elven_materials()
    cylinder("Basin", 1.5, 0.55, m["marble"], sides=32)
    cylinder("Water", 1.35, 0.03, m["water"], location=(0, 0, 0.48), sides=32)
    torus("Basin Rim", 1.5, 0.07, m["stone"], location=(0, 0, 0.55), segments=40)
    torus("Gold Band", 1.52, 0.02, m["gold"], location=(0, 0, 0.35), segments=40, sides=4)
    cylinder("Column", 0.14, 1.5, m["marble"], location=(0, 0, 0.5), top=0.1, sides=12)
    cylinder("Lower Bowl", 0.15, 0.2, m["marble"], location=(0, 0, 1.2), top=0.7, sides=24)
    cylinder("Lower Water", 0.65, 0.02, m["water"], location=(0, 0, 1.38), sides=24)
    cylinder("Upper Bowl", 0.1, 0.15, m["marble"], location=(0, 0, 1.9), top=0.4, sides=20)
    cylinder("Upper Water", 0.36, 0.02, m["water"], location=(0, 0, 2.03), sides=20)
    swan = joint("Swan", location=(0, 0, 2.1))
    sphere("Swan Body", 0.14, m["marble"], swan, (0, 0.03, 0.08), scale=(0.8, 1.3, 0.7))
    cylinder("Swan Neck", 0.03, 0.3, m["marble"], swan, (0, -0.1, 0.1), rotation=(-20, 0, 0), sides=6)
    sphere("Swan Head", 0.05, m["marble"], swan, (0, -0.16, 0.38))
    sphere("Swan Crown", 0.02, m["gold"], swan, (0, -0.16, 0.44))
    for k, (z, r) in enumerate(((0.52, 1.0), (1.42, 0.45))):
        spin = joint(f"Spin+ Ripple {k}", location=(0, 0, z))
        torus(f"Ripple {k}", r, 0.012, m["moon"], spin, segments=32, sides=4)
        for index in range(6):
            a = 2 * math.pi * index / 6
            sphere(f"Drop {k} {index}", 0.03, m["moon"], spin, (r * math.cos(a), r * math.sin(a), 0.03),
                   subdivisions=1)
