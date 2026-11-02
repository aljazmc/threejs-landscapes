from elven import elven_materials
from shooter import cylinder, clear_scene, joint, sphere, torus

EXPORT = "glb"

# Tall standing brazier of gold with a flickering fire ("Flame" joints
# flicker in the game) and a ring of moon runes.


def brazier():
    clear_scene()
    m = elven_materials()
    cylinder("Foot", 0.35, 0.1, m["darkstone"], sides=12)
    cylinder("Stem", 0.06, 1.3, m["gold"], location=(0, 0, 0.1), top=0.04, sides=8)
    cylinder("Bowl", 0.18, 0.25, m["gold"], location=(0, 0, 1.35), top=0.38, sides=16)
    torus("Rune Ring", 0.38, 0.015, m["rune"], location=(0, 0, 1.6), segments=24, sides=4)
    sphere("Coals", 0.3, m["ember"], location=(0, 0, 1.55), scale=(1, 1, 0.3))
    for index, (x, y, h) in enumerate(((0, 0, 0.6), (0.12, 0.05, 0.4), (-0.1, -0.06, 0.45))):
        flame = joint(f"Flame {index}", location=(x, y, 1.6))
        sphere(f"Fire {index}", 0.12, m["fire"], flame, (0, 0, h / 2), scale=(1, 1, h / 0.2), subdivisions=2)
