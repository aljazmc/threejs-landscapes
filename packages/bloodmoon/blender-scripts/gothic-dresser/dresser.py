from gothic import candle, gothic_materials, pointed_arch
from shooter import box, clear_scene, cylinder, sphere, torus

EXPORT = "glb"

# Dresser of drawers with a tall black mirror that shows no reflection, a
# candlestick, a hairbrush and a silver goblet of blood, facing -Y.


def dresser():
    clear_scene()
    m = gothic_materials()
    box("Body", (0.9, 0.5, 0.85), m["ebony"], location=(0, 0.05, 0.425), bevel=0.02)
    box("Top", (0.95, 0.55, 0.04), m["marble"], location=(0, 0.05, 0.87), bevel=0.01)
    for row in range(3):
        z = 0.15 + row * 0.25
        box(f"Drawer {row}", (0.8, 0.02, 0.2), m["oak"], location=(0, -0.205, z), bevel=0.01)
        for x in (-0.2, 0.2):
            torus(f"Pull {row} {x}", 0.025, 0.006, m["brass"], location=(x, -0.225, z), rotation=(90, 0, 0),
                  segments=10, sides=4)
    box("Mirror Frame", (0.7, 0.05, 0.95), m["oak"], location=(0, 0.25, 1.4), bevel=0.02)
    box("Mirror", (0.58, 0.02, 0.8), m["marble"], location=(0, 0.22, 1.38))
    pointed_arch("Mirror Arch", None, 0.66, 0.6, 0.02, m["iron"], (0, 0.21, 1.6))
    cylinder("Candlestick", 0.04, 0.05, m["silver"], location=(-0.32, -0.05, 0.89), sides=10)
    candle("Candle", None, (-0.32, -0.05, 0.94), m, 0.18)
    box("Brush", (0.16, 0.05, 0.03), m["silver"], location=(0.1, -0.05, 0.905), rotation=(0, 0, 25))
    cylinder("Goblet Foot", 0.035, 0.01, m["silver"], location=(0.3, 0.0, 0.89), sides=10)
    cylinder("Goblet Stem", 0.008, 0.08, m["silver"], location=(0.3, 0.0, 0.9), sides=6)
    cylinder("Goblet Cup", 0.02, 0.07, m["silver"], location=(0.3, 0.0, 0.98), top=0.04, sides=10)
    cylinder("Goblet Blood", 0.036, 0.01, m["blood"], location=(0.3, 0.0, 1.04), sides=10)
    sphere("Skull", 0.07, m["bone"], location=(0.32, 0.18, 0.96), scale=(0.8, 1, 0.9))
