import math

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     new_object, setup_scene, sphere, torus)

# Two 128x128 targeting reticles drawn in the middle of the screen, in the
# cyberpunk HUD style: the laser gun's (cyan broken rings, tick marks and a
# center dot) and the grenade launcher's (magenta brackets with an amber
# range ladder below the aim point).
SIZE = 128
PIXELS_PER_METER = 100  # the reticle is modeled 1.28 m across


def arc(name, radius, start, end, thickness, mat, parent, steps=10):
    """Ring segment in the XZ plane from angle start to end (degrees)."""
    for index in range(steps):
        a0 = math.radians(start + (end - start) * index / steps)
        a1 = math.radians(start + (end - start) * (index + 1) / steps)
        mid = (a0 + a1) / 2
        length = radius * abs(a1 - a0) * 1.08
        box(f"{name} {index}", (length, 0.01, thickness), mat, parent,
            (radius * math.cos(mid), 0, radius * math.sin(mid)),
            rotation=(0, -math.degrees(mid) + 90, 0))


def laser_reticle(cyan, white):
    group = new_object("Laser")
    for quarter in range(4):
        arc(f"Ring {quarter}", 0.34, quarter * 90 + 12, quarter * 90 + 78, 0.022, cyan, group)
        angle = math.radians(quarter * 90)
        box(f"Tick {quarter}", (0.14, 0.01, 0.022), white, group,
            (0.5 * math.cos(angle), 0, 0.5 * math.sin(angle)),
            rotation=(0, -quarter * 90, 0))
    for quarter in range(4):
        arc(f"Inner {quarter}", 0.18, quarter * 90 + 50, quarter * 90 + 130, 0.014, cyan, group,
            steps=6)
    sphere("Dot", 0.03, white, group)
    return group


def grenade_reticle(magenta, amber):
    group = new_object("Grenade")
    for x in (-1, 1):
        for z in (-1, 1):
            box("Bracket H", (0.16, 0.01, 0.024), magenta, group, (x * 0.36, 0, z * 0.42))
            box("Bracket V", (0.024, 0.01, 0.16), magenta, group, (x * 0.44, 0, z * 0.34))
    torus("Ring", 0.1, 0.012, magenta, group, rotation=(90, 0, 0), segments=24, sides=4)
    for index in range(4):
        width = 0.22 - 0.04 * index
        box(f"Ladder {index}", (width, 0.01, 0.016), amber, group, (0, 0, -0.18 - 0.08 * index))
    box("Stem", (0.016, 0.01, 0.12), amber, group, (0, 0, 0.18))
    sphere("Dot", 0.025, amber, group)
    return group


def crosshair():
    clear_scene()
    setup_scene(sun=False)
    front_camera(SIZE, SIZE, PIXELS_PER_METER, location=(0, -10, 0))
    laser = laser_reticle(emission_material("Cyan", "#2af0ff", 3.0),
                          emission_material("White", "#e8fbff", 3.0))
    grenade = grenade_reticle(emission_material("Magenta", "#ff3ae0", 3.0),
                              emission_material("Amber", "#ffb020", 3.0))

    def show(shown):
        def pose():
            for group in (laser, grenade):
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(SIZE, SIZE, [[show(laser), show(grenade)]],
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=3, strength=1.0))
