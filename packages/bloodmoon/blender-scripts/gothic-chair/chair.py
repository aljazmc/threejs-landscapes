from gothic import gothic_materials, pointed_arch, spire
from shooter import box, clear_scene, cylinder

EXPORT = "glb"

# Two high-backed dining chairs side by side, 1.4 m across, facing -Y:
# black oak with red velvet seats and pointed backs.


def chair():
    clear_scene()
    m = gothic_materials()
    for index, x0 in enumerate((-0.35, 0.35)):
        box(f"Seat {index}", (0.5, 0.45, 0.06), m["oak"], location=(x0, 0, 0.45), bevel=0.015)
        box(f"Cushion {index}", (0.44, 0.4, 0.05), m["velvet"], location=(x0, -0.01, 0.5), bevel=0.02)
        box(f"Back {index}", (0.5, 0.06, 0.95), m["ebony"], location=(x0, 0.2, 1.0), bevel=0.02)
        box(f"Back Panel {index}", (0.34, 0.02, 0.6), m["velvet"], location=(x0, 0.165, 1.0))
        pointed_arch(f"Back Arch {index}", None, 0.4, 0.75, 0.012, m["iron"], (x0, 0.16, 0.6))
        for dx in (-0.22, 0.22):
            spire(f"Finial {index}", None, 0.2, 0.03, m["oak"], (x0 + dx, 0.2, 1.47))
            for y in (-0.18, 0.18):
                cylinder(f"Leg {index}", 0.025, 0.43, m["ebony"], location=(x0 + dx, y, 0), sides=6)
