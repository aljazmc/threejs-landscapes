from elven import elven_materials
from shooter import box, clear_scene, cylinder, sphere

EXPORT = "glb"

# Long feast table, 3 m along X: silver plates, goblets, fruit bowls and
# candles.


def table():
    clear_scene()
    m = elven_materials()
    box("Top", (3.0, 0.9, 0.07), m["wood"], location=(0, 0, 0.78), bevel=0.02)
    box("Runner", (2.8, 0.35, 0.01), m["velvet"], location=(0, 0, 0.82))
    for x in (-1.3, 1.3):
        box("Trestle", (0.08, 0.7, 0.75), m["darkwood"], location=(x, 0, 0.38))
    box("Beam", (2.6, 0.08, 0.08), m["darkwood"], location=(0, 0, 0.2))
    for index, x in enumerate((-1.1, -0.4, 0.4, 1.1)):
        for y in (-0.3, 0.3):
            cylinder("Plate", 0.11, 0.015, m["silver"], location=(x, y, 0.815), sides=16)
            cylinder("Goblet", 0.03, 0.14, m["gold"], location=(x + 0.15, y * 0.7, 0.815), top=0.04, sides=8)
    for x in (-0.75, 0.75):
        cylinder("Bowl", 0.14, 0.07, m["silver"], location=(x, 0, 0.815), top=0.18, sides=12)
        for k in range(4):
            sphere("Fruit", 0.045, m["blossom"] if k % 2 else m["leaf"],
                   location=(x + 0.05 * (k - 1.5), 0.02 * (k % 2), 0.9), subdivisions=1)
    for x in (-0.05, 0.05):
        cylinder("Candle", 0.02, 0.2, m["linen"], location=(x * 6, 0, 0.82), sides=8)
        sphere("Flame", 0.025, m["fire"], location=(x * 6, 0, 1.05), scale=(1, 1, 1.6), subdivisions=1)
