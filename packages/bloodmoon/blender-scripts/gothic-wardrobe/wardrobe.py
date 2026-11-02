from gothic import gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, sphere

EXPORT = "glb"

# Tall black wardrobe with pointed arch panels and iron hinges, facing -Y;
# one door stands ajar on the darkness inside.


def wardrobe():
    clear_scene()
    m = gothic_materials()
    box("Body", (0.9, 0.6, 2.1), m["ebony"], location=(0, 0.1, 1.05), bevel=0.03)
    box("Inside", (0.8, 0.02, 1.8), m["marble"], location=(0, -0.19, 1.05))
    box("Crown", (1.0, 0.68, 0.12), m["oak"], location=(0, 0.1, 2.15), bevel=0.03)
    for x in (-0.35, 0.0, 0.35):
        spire("Pinnacle", None, 0.3, 0.04, m["oak"], (x, -0.15, 2.2))
    for index, (x, turn) in enumerate(((-0.22, 0), (0.22, 25))):
        door = box(f"Door {index}", (0.4, 0.03, 1.85), m["oak"], location=(x, -0.21, 1.05),
                   rotation=(0, 0, turn), bevel=0.01)
        if turn:
            door.location = (0.42 - 0.2 * 0.906, -0.21 - 0.2 * 0.423, 1.05)
            continue
        pointed_arch(f"Panel {index}", None, 0.3, 1.3, 0.012, m["iron"], (x, -0.235, 0.35))
        sphere(f"Knob {index}", 0.025, m["brass"], location=(x + 0.15, -0.24, 1.05))
        for z in (0.4, 1.7):
            box(f"Hinge {index} {z}", (0.12, 0.01, 0.03), m["iron"], location=(x - 0.14, -0.235, z))
