import math

from elven import column, elven_materials, filigree_arch, leaf_cluster
from shooter import box, clear_scene, cylinder, joint, sphere

EXPORT = "glb"

# The throne of the elven lord on a dais, facing -Y: a tall back like a
# tree, gold arches, two glowing rune stones beside it.


def throne():
    clear_scene()
    m = elven_materials()
    for index, (w, z) in enumerate(((2.8, 0.1), (2.3, 0.3))):
        box(f"Step {index}", (w, w * 0.9, 0.2), m["marble"], location=(0, 0.2, z), bevel=0.03)
    box("Seat", (0.9, 0.8, 0.15), m["wood"], location=(0, 0.25, 0.75), bevel=0.04)
    box("Cushion", (0.8, 0.7, 0.1), m["velvet"], location=(0, 0.22, 0.86), bevel=0.04)
    box("Back", (0.9, 0.15, 1.9), m["wood"], location=(0, 0.62, 1.6), bevel=0.04)
    filigree_arch("Back Arch", None, 0.8, 1.5, m["gold"], (0, 0.53, 0.95))
    for x in (-0.5, 0.5):
        box("Arm", (0.12, 0.7, 0.1), m["darkwood"], location=(x, 0.2, 1.1), bevel=0.03)
        sphere("Arm End", 0.07, m["gold"], location=(x, -0.15, 1.12))
    # the back grows into branches with silver leaves
    for index in range(5):
        angle = math.radians(-60 + 30 * index)
        branch = joint(f"Branch {index}", None, (0, 0.62, 2.5))
        branch.rotation_euler = (0, angle, 0)
        cylinder(f"Branch Limb {index}", 0.04, 0.7, m["wood"], branch, top=0.015, sides=6)
        leaf_cluster(f"Leaves {index}", branch, (0, 0, 0.7), 0.16, [m["silver"], m["leaf"]], 4, index)
    sphere("Crown Gem", 0.1, m["crystal"], location=(0, 0.52, 2.45))
    for x in (-1.1, 1.1):
        column("Rune Pillar", None, 1.4, 0.12, m["marble"], m["gold"], (x, 0.0, 0.4))
        sphere("Rune Stone", 0.12, m["rune"], location=(x, 0.0, 1.9))
