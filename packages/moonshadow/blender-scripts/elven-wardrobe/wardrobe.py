from elven import elven_materials, filigree_arch
from shooter import box, clear_scene, sphere

EXPORT = "glb"

# Tall wardrobe with leaf-carved doors, facing -Y.


def wardrobe():
    clear_scene()
    m = elven_materials()
    box("Body", (0.9, 0.6, 2.1), m["darkwood"], location=(0, 0.1, 1.05), bevel=0.03)
    box("Crown", (1.0, 0.68, 0.12), m["wood"], location=(0, 0.1, 2.15), bevel=0.03)
    for index, x in enumerate((-0.22, 0.22)):
        box(f"Door {index}", (0.4, 0.03, 1.85), m["wood"], location=(x, -0.21, 1.05), bevel=0.01)
        filigree_arch(f"Carving {index}", None, 0.3, 1.2, m["gold"], (x, -0.235, 0.35))
        sphere(f"Knob {index}", 0.025, m["gold"], location=(x - 0.15 * (1 if index else -1), -0.24, 1.05))
    box("Rune", (0.12, 0.01, 0.12), m["rune"], location=(0, -0.235, 1.9), rotation=(0, 45, 0))
