import importlib
import math
import os
import sys

import bpy

from shooter import Sheet, add_sun, add_world, front_camera, glow, setup_scene

# Weapon icons of the HUD, 112x56 pixels each: the laser gun and the
# grenade launcher (built by their own projects) seen from the side.
WIDTH = 112
HEIGHT = 56
PIXELS_PER_METER = 120

scripts_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build(project):
    name = project.rsplit("-", 1)[-1]
    sys.path.insert(0, os.path.join(scripts_dir, project))
    getattr(importlib.import_module(name), name)()


def icon(project, center):
    def pose():
        build(project)
        scene = setup_scene(samples=48, sun=False)
        add_world("#5a6a8a", 1.2)
        add_sun(4.0, (40, 0, 60))
        # the barrel (-Y) points to the right of the picture
        front_camera(WIDTH, HEIGHT, PIXELS_PER_METER, location=(-10, center, 0.06),
                     rotation=(90, 0, -90))
        scene.render.resolution_x = WIDTH
        scene.render.resolution_y = HEIGHT
    return pose


def icons():
    return Sheet(WIDTH, HEIGHT, [[icon("shooter-laser", -0.15),
                                  icon("shooter-launcher", -0.05)]],
                 post=lambda canvas: glow(canvas, WIDTH, HEIGHT, radius=2, strength=0.8))
