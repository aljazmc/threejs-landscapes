import math

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     new_object, setup_scene, sphere, torus)

# Two 128x128 aiming marks drawn in the middle of the screen: the
# revolver's (a silver ring with four ticks and a red point) and the
# flamethrower's (brass brackets showing the width of its fire cone).
SIZE = 128
PIXELS_PER_METER = 100


def revolver_mark(silver, red):
    group = new_object("Revolver")
    torus("Ring", 0.18, 0.012, silver, group, rotation=(90, 0, 0), segments=32, sides=4)
    for index in range(4):
        a = math.radians(90 * index)
        box(f"Tick {index}", (0.12, 0.01, 0.018), silver, group, (0.27 * math.cos(a), 0, 0.27 * math.sin(a)),
            rotation=(0, -90 * index, 0))
    sphere("Point", 0.025, red, group)
    return group


def flamer_mark(brass, red):
    group = new_object("Flamethrower")
    for side in (1, -1):
        for z in (1, -1):
            box(f"Bracket H {side} {z}", (0.12, 0.01, 0.02), brass, group, (side * 0.38, 0, z * 0.3))
            box(f"Bracket V {side} {z}", (0.02, 0.01, 0.12), brass, group, (side * 0.43, 0, z * 0.25))
    for k in range(3):
        sphere(f"Dot {k}", 0.018, red, group, ((k - 1) * 0.09, 0, 0))
    return group


def crosshair():
    clear_scene()
    setup_scene(sun=False)
    front_camera(SIZE, SIZE, PIXELS_PER_METER, location=(0, -10, 0))
    revolver = revolver_mark(emission_material("Silver", "#e0e8ff", 2.5), emission_material("Red", "#ff3040", 3.0))
    flamer = flamer_mark(emission_material("Brass", "#ffc060", 2.5), emission_material("Red 2", "#ff6020", 3.0))

    def show(shown):
        def pose():
            for group in (revolver, flamer):
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(SIZE, SIZE, [[show(revolver), show(flamer)]],
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=3, strength=0.9))
