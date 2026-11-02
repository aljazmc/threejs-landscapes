import importlib
import math
import os
import sys

import bpy

from shooter import Sheet, add_sun, add_world, front_camera, glow, setup_scene

# Weapon icons of the HUD, 112x56 pixels each: the revolver and the
# flamethrower (built by their own projects) seen from the side.
WIDTH = 112
HEIGHT = 56

scripts_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build(project):
    name = project.rsplit("-", 1)[-1]
    sys.path.insert(0, os.path.join(scripts_dir, project))
    getattr(importlib.import_module(name), name)()


def icon(project, center, pixels_per_meter):
    def pose():
        build(project)
        scene = setup_scene(samples=48, sun=False)
        add_world("#6a5a5a", 1.2)
        add_sun(4.0, (40, 0, 60))
        # the barrel (-Y) points to the right of the picture
        front_camera(WIDTH, HEIGHT, pixels_per_meter, location=(-10, center, 0.0),
                     rotation=(90, 0, -90))
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
    return pose


def icons():
    return Sheet(WIDTH, HEIGHT, [[icon("gothic-revolver", -0.12, 260),
                                  icon("gothic-flamethrower", -0.15, 140)]],
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=2, strength=0.8))
