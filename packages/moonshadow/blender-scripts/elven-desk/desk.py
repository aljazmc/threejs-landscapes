from elven import elven_materials
from shooter import box, clear_scene, cylinder, sphere

EXPORT = "glb"

# Writing desk with an open book, a quill, scrolls and a moon lamp, facing -Y.


def desk():
    clear_scene()
    m = elven_materials()
    box("Top", (0.9, 0.55, 0.05), m["wood"], location=(0, 0.05, 0.75), bevel=0.01)
    for x in (-0.4, 0.4):
        for y in (-0.18, 0.28):
            cylinder("Leg", 0.025, 0.73, m["darkwood"], location=(x, y, 0), sides=6)
    box("Book Left", (0.22, 0.3, 0.03), m["parchment"], location=(-0.12, 0.0, 0.79), rotation=(0, -6, 0))
    box("Book Right", (0.22, 0.3, 0.03), m["parchment"], location=(0.12, 0.0, 0.79), rotation=(0, 6, 0))
    box("Book Cover", (0.48, 0.32, 0.01), m["velvet"], location=(0, 0.0, 0.775))
    cylinder("Quill", 0.006, 0.3, m["linen"], location=(0.3, -0.05, 0.78), rotation=(0, 60, 20), sides=4)
    for index in range(3):
        cylinder(f"Scroll {index}", 0.03, 0.3, m["parchment"], location=(-0.38 + 0.07 * index, 0.25, 0.81),
                 rotation=(90, 0, 0), sides=8)
    cylinder("Lamp Stem", 0.015, 0.3, m["silver"], location=(0.3, 0.2, 0.78), sides=6)
    sphere("Lamp", 0.07, m["moon"], location=(0.3, 0.2, 1.12))
