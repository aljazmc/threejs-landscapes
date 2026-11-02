import math

import bpy

from shooter import (Sheet, box, clear_scene, color, emission_material, front_camera,
                     glow, material, mix_color, new_object, node, setup_scene,
                     shader_material, sphere)

# Sprite sheet of 240x52 menu button backgrounds; the game draws the labels.
# Rows: normal (a black marble plate in an iron frame) and highlighted
# (brass frame, glowing blood red jewels at its ends), seen from the front.
WIDTH = 240
HEIGHT = 52
PIXELS_PER_METER = 100


def stone(name, dark, light):
    def build(tree, bsdf):
        coordinates = node(tree, "ShaderNodeTexCoord").outputs["Object"]
        grain = node(tree, "ShaderNodeTexNoise", [("Vector", coordinates), ("Scale", 6.0),
                                                  ("Detail", 6.0)]).outputs["Fac"]
        tree.links.new(mix_color(tree, grain, color(dark), color(light)), bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.3
    return shader_material(name, build)


def plate(frame, face, gem):
    width, height = (WIDTH - 10) / PIXELS_PER_METER, (HEIGHT - 10) / PIXELS_PER_METER
    group = new_object("Button")
    box("Frame", (width, 0.1, height), frame, group, bevel=0.06)
    box("Face", (width - 0.1, 0.1, height - 0.1), face, group, (0, -0.03, 0), bevel=0.04)
    for x in (-1, 1):
        sphere("Gem", 0.06, gem, group, (x * (width / 2 - 0.15), -0.1, 0), scale=(1, 0.5, 1))
    return group


def button():
    clear_scene()
    setup_scene()
    front_camera(WIDTH, HEIGHT, PIXELS_PER_METER, location=(0, -10, 0))
    bpy.data.objects["Sun"].rotation_euler = (math.radians(60), 0, math.radians(-20))
    normal = plate(material("Iron", "#5a5a62", 0.4, 1.0), stone("Black Marble", "#141218", "#2e2a34"),
                   emission_material("Dim Jewel", "#6a1018", 1.0))
    highlighted = plate(material("Brass", "#d8a040", 0.25, 1.0), stone("Red Marble", "#3a0810", "#5e1820"),
                        emission_material("Jewel", "#ff2a3a", 3.0))

    def show(shown):
        def pose():
            for group in (normal, highlighted):
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = group is not shown
        return pose

    return Sheet(WIDTH, HEIGHT, [[show(normal)], [show(highlighted)]],
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=3, strength=0.6))
