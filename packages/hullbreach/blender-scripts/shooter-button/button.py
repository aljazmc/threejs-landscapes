import math

import bpy

from shooter import (Sheet, box, clear_scene, emission_material, front_camera, glow,
                     material, new_object, setup_scene)

# Sprite sheet of 240x52 menu button backgrounds; the game draws the labels.
# Rows: normal (dark glass plate with a cyan neon frame and cut corners)
# and highlighted (magenta frame, violet lit glass), seen from the front.
WIDTH = 240
HEIGHT = 52
PIXELS_PER_METER = 100


def plate(glass, neon, accent):
    width, height = (WIDTH - 14) / PIXELS_PER_METER, (HEIGHT - 14) / PIXELS_PER_METER
    group = new_object("Button")
    box("Glass", (width, 0.06, height), glass, group, bevel=0.03)
    thick = 0.025
    box("Top", (width - 0.2, 0.02, thick), neon, group, (0, -0.04, height / 2))
    box("Bottom", (width - 0.2, 0.02, thick), neon, group, (0, -0.04, -height / 2))
    box("Left", (thick, 0.02, height - 0.12), neon, group, (-width / 2, -0.04, 0))
    box("Right", (thick, 0.02, height - 0.12), neon, group, (width / 2, -0.04, 0))
    for x in (-1, 1):
        for z in (-1, 1):
            # cut corners: diagonal neon pieces
            box("Corner", (0.12, 0.02, thick), neon, group,
                (x * (width / 2 - 0.042), -0.04, z * (height / 2 - 0.042)),
                rotation=(0, 45 * x * z, 0))
        box("Tick", (0.05, 0.02, 0.12), accent, group, (x * (width / 2 - 0.12), -0.04, 0))
    return group


def button():
    clear_scene()
    setup_scene()
    front_camera(WIDTH, HEIGHT, PIXELS_PER_METER, location=(0, -10, 0))
    bpy.data.objects["Sun"].rotation_euler = (math.radians(60), 0, math.radians(-20))

    normal = plate(material("Dark Glass", "#101826", 0.15, 0.3),
                   emission_material("Cyan", "#2af0ff", 4.0),
                   emission_material("Cyan Dim", "#1a6a80", 2.0))
    highlighted = plate(material("Lit Glass", "#3a1450", 0.15, 0.3),
                        emission_material("Magenta", "#ff3ae0", 5.0),
                        emission_material("Amber", "#ffb020", 4.0))

    def show(shown):
        def pose():
            for group in (normal, highlighted):
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(WIDTH, HEIGHT, [[show(normal)], [show(highlighted)]],
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=3, strength=0.8))
