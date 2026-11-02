import math
import random

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     material, new_object, setup_scene, sphere)

# 64x64 glow sprites for the fights, drawn as billboards: the revolver's
# muzzle flash (white-gold), a silver bullet's spark where it hits, embers
# of the flamethrower (orange), monster blood (dark red, drawn with alpha)
# and smoke.
SIZE = 64
PIXELS_PER_METER = 64


def star(name, points, length, core, ray, parent):
    sphere(name + " Core", 0.08, core, parent, subdivisions=2)
    for index in range(points):
        angle = 180 * index / points
        long = length * (1.0 if index % 2 == 0 else 0.55)
        box(f"{name} Ray {index}", (long, 0.01, 0.025), ray, parent, rotation=(0, angle, 0))


def flare():
    clear_scene()
    setup_scene(sun=False)
    front_camera(SIZE, SIZE, PIXELS_PER_METER, location=(0, -10, 0))
    groups = []

    flash = new_object("Muzzle Flash")
    star("Flash", 6, 0.8, emission_material("Flash Core", "#ffffff", 8.0),
         emission_material("Flash Ray", "#ffd060", 5.0), flash)
    sphere("Flash Ball", 0.2, emission_material("Flash Glow", "#ffb030", 3.0), flash)
    groups.append(flash)

    spark = new_object("Silver Spark")
    star("Spark", 8, 0.55, emission_material("Spark Core", "#ffffff", 6.0),
         emission_material("Spark Ray", "#c8d8ff", 4.0), spark)
    groups.append(spark)

    ember = new_object("Ember")
    star("Ember", 6, 0.6, emission_material("Hot", "#fff0b0", 6.0),
         emission_material("Orange", "#ff7a1a", 4.0), ember)
    sphere("Ember Ball", 0.2, emission_material("Fire", "#ff5a10", 3.0), ember)
    groups.append(ember)

    blood = new_object("Blood")
    rng = random.Random(11)
    red = material("Blood", "#6a0008", 0.3)
    for index in range(14):
        angle = rng.uniform(0, 2 * math.pi)
        distance = rng.uniform(0.0, 0.32)
        sphere(f"Drop {index}", rng.uniform(0.03, 0.08), red, blood,
               (distance * math.cos(angle), 0, distance * math.sin(angle)), subdivisions=1)
    groups.append(blood)

    smoke = new_object("Smoke")
    gray = material("Smoke", "#4a4644", 1.0)
    for index in range(7):
        angle = 2 * math.pi * index / 7
        sphere(f"Puff {index}", 0.16, gray, smoke, (0.14 * math.cos(angle), -0.05, 0.14 * math.sin(angle)),
               subdivisions=2)
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
