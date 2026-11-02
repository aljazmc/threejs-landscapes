import math

import bpy

from shooter import (Sheet, clear_scene, emission_material, front_camera, glow,
                     material, setup_scene, text)

# Sheet of 640x150 logos of the main menu, a row per language (the subtitle
# translated): the title in magenta neon tubes over dark
# chrome letters, the subtitle in cyan, with a soft neon halo.
WIDTH = 640
HEIGHT = 150
PIXELS_PER_METER = 100
MAX_WIDTH = (WIDTH - 40) / PIXELS_PER_METER  # meters
SUBTITLES = [
    "A SPACE COMMANDO AGAINST THE ALIEN BOARDERS",
    "EIN WELTRAUMKOMMANDO GEGEN DIE ALIEN-ENTERER",
    "KOMANDOS KOSMICZNY PRZECIW OBCYM ABORDAŻYSTOM",
    "VESOLJSKI KOMANDOS PROTI NEZEMSKIM ZAVOJEVALCEM",
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
    bpy.data.objects["Sun"].rotation_euler = (math.radians(70), 0, math.radians(-30))

    chrome = material("Chrome", "#3a4258", 0.2, 1.0)
    neon = emission_material("Neon Magenta", "#ff3ae0", 2.2)
    core = emission_material("Neon Core", "#ffc8f6", 2.5)
    cyan = emission_material("Neon Cyan", "#3af6ff", 1.6)

    text("HULL BREACH", 0.86, chrome, (0.04, 0.3, 0.21), 0.06, 0.01)
    text("HULL BREACH", 0.86, neon, (0, 0, 0.25), 0.0, 0.026, fill=False)
    text("HULL BREACH", 0.86, core, (0, -0.04, 0.25), 0.0, 0.008, fill=False)
    rows = subtitles(lambda body: text(body, 0.2, cyan, (0, 0, -0.5),
                                       0.0, 0.006, spacing=1.15))
    return Sheet(WIDTH, HEIGHT, rows,
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=5, strength=1.0))
