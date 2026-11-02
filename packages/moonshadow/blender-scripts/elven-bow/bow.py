import math

from elven import elven_materials
from shooter import box, clear_scene, cylinder, joint, sphere, tube

EXPORT = "glb"

# The elf's longbow in first person, held upright with the arrow along -Y:
# a recurve bow of pale wood with gold tips and an explosive arrow (glowing
# rune head) on the string. The game pulls the "Nock" joint (the arrow and
# the middle of the string) back while drawing and hides the "Arrow" once it
# is loosed; "Muzzle" is the arrow head.


def bow():
    clear_scene()
    m = elven_materials()
    wood = m["bark"]
    half = 0.65
    limb = [(0, 0.06 * (1 - t * t) - 0.02 * t ** 4, half * t) for t in (i / 8 for i in range(9))]
    tube("Upper Limb", limb, lambda t: 0.018 * (1 - t) + 0.007, wood)
    tube("Lower Limb", [(x, y, -z) for x, y, z in limb], lambda t: 0.018 * (1 - t) + 0.007, wood)
    for z in (half, -half):
        sphere("Tip", 0.014, m["gold"], location=(0, 0.04, z))
    cylinder("Grip", 0.022, 0.16, m["darkwood"], location=(0, 0.06, -0.08), sides=8)
    box("Rest", (0.01, 0.03, 0.02), m["gold"], location=(0.02, 0.04, 0.0))
    nock = joint("Nock", location=(0, 0.3, 0))
    # the string goes from the tips to the nock, which moves with the arrow
    tube("String Upper", [(0, 0.04 - 0.3, half), (0, 0, 0)], 0.003, m["linen"], nock)
    tube("String Lower", [(0, 0.04 - 0.3, -half), (0, 0, 0)], 0.003, m["linen"], nock)
    arrow = joint("Arrow", nock)  # hidden by the game once loosed
    cylinder("Shaft", 0.006, 0.75, m["wood"], arrow, rotation=(90, 0, 0), sides=6)
    for k in range(3):
        box(f"Fletch {k}", (0.002, 0.08, 0.025), m["blossom"], arrow, (0, -0.06, 0),
            rotation=(0, 120 * k, 0))
    head = joint("Arrow Head", arrow, (0, -0.75, 0))
    cylinder("Charge", 0.018, 0.06, m["fire"], head, rotation=(90, 0, 0), sides=8)
    cylinder("Point", 0.016, 0.06, m["gold"], head, (0, -0.06, 0), rotation=(90, 0, 0), top=0.0, sides=6)
    joint("Muzzle", nock, (0, -0.85, 0))
