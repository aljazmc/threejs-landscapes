import math

from elven import elven_materials
from shooter import box, clear_scene, cylinder, joint, sphere, torus, tube

EXPORT = "glb"

# The elf's sword in first person: a long leaf-shaped blade along -Y with
# glowing runes, a gold guard like two leaves and a wrapped grip. The origin
# is at the grip, the empty "Muzzle" marks the blade's tip.


def sword():
    clear_scene()
    m = elven_materials()
    steel = m["silver"]
    blade = joint("Blade", location=(0, -0.1, 0))
    blade.rotation_euler = (math.radians(90), 0, 0)  # +Z of the blade is -Y
    profile = [(0.0, 0.026), (0.15, 0.038), (0.45, 0.045), (0.7, 0.036), (0.85, 0.018), (0.9, 0.0)]
    for index in range(len(profile) - 1):
        (z0, w0), (z1, w1) = profile[index], profile[index + 1]
        cylinder(f"Edge {index}", w0, z1 - z0, steel, blade, (0, 0, z0), top=w1, sides=4,
                 smooth=False, scale=(1, 0.18, 1))
    for index in range(5):
        box(f"Rune {index}", (0.01, 0.004, 0.045), m["rune"], blade, (0, 0.006, 0.12 + 0.12 * index))
    for side in (1, -1):
        tube(f"Guard {side}", [(0, 0, 0), (side * 0.07, 0, -0.01), (side * 0.12, 0, 0.04)],
             lambda t: 0.018 * (1 - t) + 0.004, m["gold"], blade)
    sphere("Guard Gem", 0.018, m["crystal"], blade, (0, -0.012, 0))
    cylinder("Grip", 0.016, 0.16, m["darkwood"], location=(0, -0.1, 0), rotation=(-90, 0, 0), sides=8)
    for index in range(4):
        torus(f"Wrap {index}", 0.017, 0.004, m["gold"], location=(0, -0.08 + 0.04 * index, 0),
              rotation=(90, 0, 0), segments=10, sides=4)
    sphere("Pommel", 0.025, m["gold"], location=(0, 0.075, 0))
    joint("Muzzle", location=(0, -1.0, 0))
