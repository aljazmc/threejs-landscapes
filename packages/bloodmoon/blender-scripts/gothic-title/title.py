import math

import bpy

from shooter import (Sheet, clear_scene, emission_material, front_camera, glow,
                     material, setup_scene, text)

# Sheet of 640x150 logos of the main menu, a row per language (the subtitle
# translated): the title in tarnished silver letters over
# a blood red shadow, the subtitle glowing like embers.
WIDTH = 640
HEIGHT = 150
PIXELS_PER_METER = 100
MAX_WIDTH = (WIDTH - 40) / PIXELS_PER_METER  # meters
SUBTITLES = [
    "SILVER AND FIRE AGAINST THE CHILDREN OF THE NIGHT",
    "SILBER UND FEUER GEGEN DIE KINDER DER NACHT",
    "SREBRO I OGIEŃ PRZECIW DZIECIOM NOCY",
    "SREBRO IN OGENJ PROTI OTROKOM NOČI",
]


def subtitles(make):
    """The subtitle in English, Deutsch, Polski and Slovenščina, each made by
    make(body) and narrowed to fit the logo, as sheet rows showing one each."""
    objects = [make(body) for body in SUBTITLES]
    bpy.context.view_layer.update()
    for obj in objects:
        if obj.dimensions.x > MAX_WIDTH:
            obj.scale *= MAX_WIDTH / obj.dimensions.x

    def show(shown):
        def pose():
            for obj in objects:
                obj.hide_render = obj is not shown
        return pose
    return [[show(obj)] for obj in objects]


def title():
    clear_scene()
    setup_scene(samples=64)
    front_camera(WIDTH, HEIGHT, PIXELS_PER_METER, location=(0, -20, 0))
    bpy.data.objects["Sun"].rotation_euler = (math.radians(65), 0, math.radians(-35))
    silver = material("Silver", "#d0d4d8", 0.25, 1.0)
    shadow = material("Blood Shadow", "#5a0610", 0.4, 0.3)
    ember = emission_material("Ember", "#ff8a3a", 1.6)
    text("BLOODMOON MANOR", 0.56, silver, (0, 0, 0.22), 0.08, 0.02)
    text("BLOODMOON MANOR", 0.56, shadow, (0.04, 0.12, 0.18), 0.02, 0.02)
    rows = subtitles(lambda body: text(body, 0.18, ember, (0, 0, -0.5), 0.0, 0.006,
                                       spacing=1.15))
    return Sheet(WIDTH, HEIGHT, rows,
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=5, strength=0.7))
