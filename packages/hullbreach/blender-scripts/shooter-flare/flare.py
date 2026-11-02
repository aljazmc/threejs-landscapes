import math
import random

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     material, new_object, setup_scene, sphere)

# 64x64 glow sprites for the shots, drawn as additive billboards: the laser
# hitting (cyan burst), the laser's muzzle flash (white-cyan star), the
# launcher's muzzle flash (orange star), the alien ichor splashing from a
# hit (green droplets) and a puff of smoke.
SIZE = 64
PIXELS_PER_METER = 64  # each sprite is modeled 1 m across


def star(name, points, length, core, ray, parent):
    sphere(name + " Core", 0.08, core, parent, subdivisions=2)
    for index in range(points):
        angle = 180 * index / points
        long = length * (1.0 if index % 2 == 0 else 0.55)
        box(f"{name} Ray {index}", (long, 0.01, 0.025), ray, parent,
            rotation=(0, angle, 0))


def flare():
    clear_scene()
    setup_scene(sun=False)
    front_camera(SIZE, SIZE, PIXELS_PER_METER, location=(0, -10, 0))
    groups = []

    impact = new_object("Impact")
    star("Impact", 8, 0.55, emission_material("White", "#f0ffff", 6.0),
         emission_material("Cyan", "#2af0ff", 4.0), impact)
    groups.append(impact)

    laser = new_object("Laser Flash")
    star("Laser", 4, 0.8, emission_material("White 2", "#ffffff", 6.0),
         emission_material("Cyan 2", "#6af6ff", 4.0), laser)
    groups.append(laser)

    blast = new_object("Launcher Flash")
    star("Blast", 6, 0.75, emission_material("Hot", "#fff0b0", 6.0),
         emission_material("Orange", "#ff7a1a", 4.0), blast)
    sphere("Blast Ball", 0.18, emission_material("Fire", "#ff5a10", 3.0), blast)
    groups.append(blast)

    ichor = new_object("Ichor")
    rng = random.Random(11)
    green = emission_material("Ichor", "#6aff3a", 2.0)
    for index in range(14):
        angle = rng.uniform(0, 2 * math.pi)
        distance = rng.uniform(0.0, 0.32)
        sphere(f"Drop {index}", rng.uniform(0.03, 0.08), green, ichor,
               (distance * math.cos(angle), 0, distance * math.sin(angle)), subdivisions=1)
    groups.append(ichor)

    smoke = new_object("Smoke")
    gray = material("Smoke", "#5a5a66", 1.0)
    for index in range(7):
        angle = 2 * math.pi * index / 7
        sphere(f"Puff {index}", 0.16, gray, smoke,
               (0.14 * math.cos(angle), -0.05, 0.14 * math.sin(angle)), subdivisions=2)
    sphere("Puff Center", 0.2, gray, smoke, (0, -0.1, 0), subdivisions=2)
    groups.append(smoke)

    def show(shown):
        def pose():
            for group in groups:
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(SIZE, SIZE, [[show(group) for group in groups]],
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=4, strength=1.3))
