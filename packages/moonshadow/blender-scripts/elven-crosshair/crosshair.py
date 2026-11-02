import math

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     new_object, setup_scene, sphere)

# Two 128x128 aiming marks drawn in the middle of the screen: the sword's
# (four silver leaves around a moon-blue point, showing its reach) and the
# bow's (gold chevrons with a range ladder for the arrow's drop).
SIZE = 128
PIXELS_PER_METER = 100


def leaf(name, parent, angle, mat, distance, length=0.16):
    a = math.radians(angle)
    sphere(name, 0.05, mat, parent, (distance * math.cos(a), 0, distance * math.sin(a)),
           scale=(length / 0.1, 0.2, 0.45), rotation=(0, -angle, 0))


def sword_mark(silver, moon):
    group = new_object("Sword")
    for index in range(4):
        leaf(f"Leaf {index}", group, 45 + 90 * index, silver, 0.24)
    sphere("Point", 0.03, moon, group)
    return group


def bow_mark(gold, moon):
    group = new_object("Bow")
    for side in (1, -1):
        box(f"Chevron A {side}", (0.2, 0.01, 0.025), gold, group, (side * 0.17, 0, 0.08), rotation=(0, side * 30, 0))
        box(f"Chevron B {side}", (0.2, 0.01, 0.025), gold, group, (side * 0.17, 0, -0.08), rotation=(0, side * -30, 0))
    for index in range(4):
        box(f"Ladder {index}", (0.18 - 0.03 * index, 0.01, 0.016), moon, group, (0, 0, -0.16 - 0.08 * index))
    sphere("Point", 0.025, moon, group)
    return group


def crosshair():
    clear_scene()
    setup_scene(sun=False)
    front_camera(SIZE, SIZE, PIXELS_PER_METER, location=(0, -10, 0))
    sword = sword_mark(emission_material("Silver", "#e8f0ff", 2.5), emission_material("Moon", "#8ae8ff", 3.0))
    bow = bow_mark(emission_material("Gold", "#ffd060", 2.5), emission_material("Moon 2", "#8ae8ff", 3.0))

    def show(shown):
        def pose():
            for group in (sword, bow):
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(SIZE, SIZE, [[show(sword), show(bow)]],
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=3, strength=0.9))
