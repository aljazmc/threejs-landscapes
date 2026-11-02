from elven import elven_materials
from shooter import box, clear_scene, cylinder, sphere

EXPORT = "glb"

# The explosive arrow in flight, along -Y: a burning rune charge behind its
# gold head.


def arrow():
    clear_scene()
    m = elven_materials()
    cylinder("Shaft", 0.007, 0.8, m["wood"], location=(0, 0.4, 0), rotation=(90, 0, 0), sides=6)
    for k in range(3):
        box(f"Fletch {k}", (0.002, 0.08, 0.025), m["blossom"], location=(0, 0.33, 0), rotation=(0, 120 * k, 0))
    sphere("Charge", 0.03, m["fire"], location=(0, -0.03, 0), scale=(1, 1.6, 1))
    cylinder("Point", 0.016, 0.07, m["gold"], location=(0, -0.06, 0), rotation=(90, 0, 0), top=0.0, sides=6)
