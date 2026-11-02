import math
import random

import numpy

from shooter import (Sheet, box, clear_scene, color, cylinder, emission_material,
                     front_camera, material, mix_color, new_object, node,
                     setup_scene, shader_material, sphere)

# Textures of the ship's walls, floors and ceilings: 256x256 pixel tiles of
# 1x1 m that repeat seamlessly, modeled as relief panels seen from the front
# under an even white light.
#
# Rows are the sections: engine room, hallway, cabins, control room, and
# a last row with the control room's bow window. Columns: wall base (the
# lowest meter), wall panel, wall top (the band under the ceiling, with the
# neon lights), floor, ceiling. The sheet holds the tiles twice: the upper
# half is the surface color, the lower half what glows on its own, which
# the game adds without lighting.
TILE = 256
PIXELS_PER_METER = TILE
SECTIONS = ["engine", "hallway", "cabin", "control"]
KINDS = ["base", "panel", "top", "floor", "ceiling"]


def grimy(name, dark, light, scale=8.0, roughness=0.6, metallic=0.5):
    """Metal with noise in its color, for plates that are not too clean."""
    def build(tree, bsdf):
        coordinates = node(tree, "ShaderNodeTexCoord").outputs["Object"]
        grain = node(tree, "ShaderNodeTexNoise",
                     [("Vector", coordinates), ("Scale", scale),
                      ("Detail", 8.0)]).outputs["Fac"]
        tree.links.new(mix_color(tree, grain, color(dark), color(light)),
                       bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return shader_material(name, build)


def plate(name, mat, parent, x=0.0, z=0.0, w=1.0, h=1.0, depth=0.04, y=0.0,
          bevel=0.012):
    return box(name, (w, depth, h), mat, parent, (x, y - depth / 2, z), bevel=bevel)


def rivets(name, mat, parent, inset=0.06, size=0.018):
    for x in (-1, 1):
        for z in (-1, 1):
            sphere(name, size, mat, parent, (x * (0.5 - inset), -0.04, z * (0.5 - inset)),
                   subdivisions=1)


def stars(parent, glow_white, glow_blue, count=90, seed=7):
    rng = random.Random(seed)
    for index in range(count):
        size = 0.003 + rng.random() ** 4 * 0.012
        mat = glow_blue if rng.random() < 0.3 else glow_white
        # stars wrap around the tile edges so the window repeats seamlessly
        x, z = rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5)
        sphere(f"Star {index}", size, mat, parent, (x, -0.01, z), subdivisions=1)


class Tiles:
    def __init__(self):
        self.groups = {}
        m = self.m = {
            "rusty": grimy("Rusty", "#2a2420", "#5a4434", 6.0, 0.7, 0.6),
            "iron": grimy("Iron", "#2c3038", "#4a505c", 10.0, 0.5, 0.7),
            "gunmetal": grimy("Gunmetal", "#3a4252", "#5a6476", 12.0, 0.35, 0.7),
            "steel": grimy("Steel", "#6a7284", "#8c94a6", 14.0, 0.35, 0.8),
            "warm": grimy("Warm Panel", "#4a4052", "#62566e", 5.0, 0.6, 0.2),
            "carpet": grimy("Carpet", "#2a1838", "#3e2650", 60.0, 0.95, 0.0),
            "black": grimy("Black Glass", "#0a0c12", "#161a24", 4.0, 0.15, 0.4),
            "dark": material("Dark", "#14171e", 0.6, 0.4),
            "grating": material("Grating", "#3a3e44", 0.5, 0.8),
            "hazard": material("Hazard", "#d8a020", 0.6),
            "space": material("Space", "#000000", 1.0),
            "amber": emission_material("Amber", "#ffa21a", 4.0),
            "red": emission_material("Red", "#ff2a3a", 4.0),
            "cyan": emission_material("Cyan", "#22eaff", 4.0),
            "cyan dim": emission_material("Cyan Dim", "#1a9ab0", 1.5),
            "magenta": emission_material("Magenta", "#ff2ad6", 4.0),
            "violet": emission_material("Violet", "#9a5aff", 3.0),
            "lamp": emission_material("Lamp", "#e8f2ff", 3.0),
            "screen": emission_material("Screen", "#1a6aa8", 1.2),
            "star": emission_material("Star", "#ffffff", 4.0),
            "star blue": emission_material("Star Blue", "#9ac8ff", 4.0),
        }
        for row, section in enumerate(SECTIONS):
            for kind in KINDS:
                group = new_object(f"{section} {kind}")
                getattr(self, f"{section}_{kind}")(group, m)
                self.groups[(row, kind)] = group
        window = new_object("window")
        self.window(window, m)
        self.groups[(len(SECTIONS), "base")] = window
        for group in self.groups.values():
            # behind the bevels of the plates, so no light shows between tiles
            box("Back", (1.0, 0.01, 1.0), m["dark"], group, (0, 0.02, 0))

    # --- engine room: rusty plates, hazard stripes, amber lights, grating

    def engine_base(self, g, m):
        plate("Plate", m["rusty"], g)
        for index in range(6):
            box(f"Stripe {index}", (0.12, 0.01, 0.5), m["hazard"], g,
                (-0.5 + 0.2 * index, -0.045, -0.05), rotation=(0, 40, 0))
        plate("Kick", m["dark"], g, z=-0.42, h=0.16, depth=0.06)
        plate("Top Lip", m["iron"], g, z=0.32, h=0.1, depth=0.06)
        rivets("Rivet", m["iron"], g)

    def engine_panel(self, g, m):
        plate("Plate", m["rusty"], g)
        plate("Inset", m["iron"], g, w=0.8, h=0.8, depth=0.06)
        for index in range(5):
            plate(f"Vent {index}", m["dark"], g, z=-0.2 + 0.1 * index, w=0.5, h=0.03,
                  depth=0.08, bevel=0.005)
        rivets("Rivet", m["iron"], g)

    def engine_top(self, g, m):
        plate("Plate", m["rusty"], g)
        plate("Light Box", m["dark"], g, z=0.1, h=0.18, depth=0.07)
        plate("Light", m["amber"], g, z=0.1, w=0.9, h=0.06, depth=0.08, bevel=0.0)
        cylinder("Pipe", 0.06, 1.0, m["iron"], g, (-0.5, -0.08, -0.25), rotation=(0, 90, 0),
                 sides=10)

    def engine_floor(self, g, m):
        plate("Base", m["dark"], g)
        for index in range(9):
            plate(f"Bar X {index}", m["grating"], g, x=-0.4 + 0.1 * index, w=0.025,
                  depth=0.06, bevel=0.004)
            plate(f"Bar Z {index}", m["grating"], g, z=-0.4 + 0.1 * index, h=0.025,
                  depth=0.05, bevel=0.004)
        plate("Frame X", m["iron"], g, z=0.49, h=0.04, depth=0.07)
        plate("Frame X2", m["iron"], g, z=-0.49, h=0.04, depth=0.07)
        plate("Frame Z", m["iron"], g, x=0.49, w=0.04, depth=0.07)
        plate("Frame Z2", m["iron"], g, x=-0.49, w=0.04, depth=0.07)

    def engine_ceiling(self, g, m):
        self.engine_floor(g, m)
        sphere("Warning Lamp", 0.05, m["red"], g, (0, -0.08, 0), subdivisions=2)

    # --- hallway: clean gunmetal, cyan neon, white ceiling lights

    def hallway_base(self, g, m):
        plate("Plate", m["gunmetal"], g)
        plate("Kick", m["dark"], g, z=-0.4, h=0.2, depth=0.06)
        plate("Guide", m["cyan"], g, z=-0.28, h=0.02, depth=0.065, bevel=0.0)
        plate("Seam", m["dark"], g, z=0.2, h=0.02, depth=0.045, bevel=0.0)

    def hallway_panel(self, g, m):
        plate("Plate", m["gunmetal"], g)
        plate("Inset", m["steel"], g, w=0.86, h=0.9, depth=0.055)
        plate("Strip", m["cyan"], g, x=0.38, w=0.025, h=0.7, depth=0.06, bevel=0.0)
        plate("Label", m["dark"], g, x=-0.2, z=0.3, w=0.3, h=0.08, depth=0.06)
        plate("Label Glow", m["violet"], g, x=-0.25, z=0.3, w=0.15, h=0.025, depth=0.062,
              bevel=0.0)

    def hallway_top(self, g, m):
        plate("Plate", m["gunmetal"], g)
        plate("Cove", m["dark"], g, z=0.25, h=0.3, depth=0.08)
        plate("Light", m["magenta"], g, z=0.18, h=0.03, depth=0.085, bevel=0.0)
        plate("Cable Tray", m["iron"], g, z=-0.2, h=0.1, depth=0.07)

    def hallway_floor(self, g, m):
        plate("Plate", m["steel"], g, bevel=0.02)
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.25):
                plate(f"Tread {x} {z}", m["gunmetal"], g, x=x, z=z, w=0.4, h=0.4, depth=0.05)
        sphere("Guide Light", 0.02, m["cyan"], g, (0, -0.04, 0), subdivisions=1)

    def hallway_ceiling(self, g, m):
        plate("Plate", m["gunmetal"], g)
        cylinder("Lamp Rim", 0.11, 0.03, m["dark"], g, (0, -0.06, 0), rotation=(90, 0, 0), sides=16)
        cylinder("Lamp", 0.07, 0.03, m["lamp"], g, (0, -0.075, 0), rotation=(90, 0, 0), sides=16)

    # --- cabins: warm violet panels, carpet, magenta accents

    def cabin_base(self, g, m):
        plate("Plate", m["warm"], g)
        plate("Kick", m["dark"], g, z=-0.42, h=0.16, depth=0.06)

    def cabin_panel(self, g, m):
        plate("Plate", m["warm"], g, bevel=0.03)
        plate("Inset", m["warm"], g, w=0.8, h=0.8, depth=0.05, bevel=0.03)

    def cabin_top(self, g, m):
        plate("Plate", m["warm"], g)
        plate("Light", m["magenta"], g, z=0.3, h=0.025, depth=0.06, bevel=0.0)

    def cabin_floor(self, g, m):
        plate("Carpet", m["carpet"], g, bevel=0.0)

    def cabin_ceiling(self, g, m):
        plate("Plate", m["warm"], g)
        cylinder("Lamp", 0.12, 0.02, m["lamp"], g, (0, -0.06, 0), rotation=(90, 0, 0), sides=16)

    # --- control room: black glass, data screens, cyan

    def control_base(self, g, m):
        plate("Plate", m["black"], g)
        plate("Kick", m["gunmetal"], g, z=-0.42, h=0.16, depth=0.06)
        plate("Edge", m["cyan"], g, z=-0.33, h=0.015, depth=0.065, bevel=0.0)

    def control_panel(self, g, m):
        plate("Plate", m["black"], g)
        plate("Screen", m["screen"], g, w=0.8, h=0.6, depth=0.045, bevel=0.0)
        rng = random.Random(3)
        for index in range(7):
            width = rng.uniform(0.1, 0.5)
            plate(f"Data {index}", m["cyan"] if index % 3 else m["magenta"], g,
                  x=-0.35 + width / 2, z=0.22 - 0.075 * index, w=width, h=0.018,
                  depth=0.05, bevel=0.0)

    def control_top(self, g, m):
        plate("Plate", m["black"], g)
        plate("Light", m["cyan"], g, z=0.2, h=0.04, depth=0.06, bevel=0.0)
        plate("Light 2", m["cyan"], g, z=0.1, h=0.012, depth=0.06, bevel=0.0)

    def control_floor(self, g, m):
        plate("Plate", m["black"], g, bevel=0.02)
        plate("Edge", m["cyan dim"], g, z=0.495, h=0.008, depth=0.045, bevel=0.0)
        plate("Edge 2", m["cyan dim"], g, x=0.495, w=0.008, depth=0.045, bevel=0.0)

    def control_ceiling(self, g, m):
        plate("Plate", m["gunmetal"], g)
        plate("Inset", m["dark"], g, w=0.84, h=0.84, depth=0.05)
        sphere("Indicator", 0.025, m["cyan dim"], g, (0.36, -0.06, 0.36), subdivisions=1)

    # --- the bow window: stars between window bars

    def window(self, g, m):
        plate("Space", m["space"], g, depth=0.01, bevel=0.0)
        stars(g, m["star"], m["star blue"])
        plate("Bar Bottom", m["gunmetal"], g, z=-0.48, h=0.04, depth=0.08)
        plate("Bar Top", m["gunmetal"], g, z=0.48, h=0.04, depth=0.08)
        plate("Mullion", m["gunmetal"], g, x=0.48, w=0.04, depth=0.08)
        plate("Mullion 2", m["gunmetal"], g, x=-0.48, w=0.04, depth=0.08)


def split(canvas):
    """The lit renders above minus their glow, and the glow below."""
    half = canvas.shape[0] // 2
    lit, glow = canvas[:half], canvas[half:]
    out = canvas.copy()
    out[:half, :, :3] = numpy.clip(lit[..., :3] - glow[..., :3], 0, 1)
    out[..., 3] = 1.0
    return out


def tiles():
    clear_scene()
    scene = setup_scene(samples=32, transparent=False, sun=False)
    world = scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value = (1, 1, 1, 1)
    front_camera(TILE, TILE, PIXELS_PER_METER, location=(0, -10, 0))
    built = Tiles()

    def show(key, lit):
        def pose():
            for other, group in built.groups.items():
                for obj in [group] + list(group.children_recursive):
                    obj.hide_render = other != key
            world.inputs["Strength"].default_value = 1.0 if lit else 0.0
        return pose

    rows = []
    for lit in (True, False):
        for row in range(len(SECTIONS) + 1):
            rows.append([show((row, kind), lit) if (row, kind) in built.groups else None
                         for kind in KINDS])
    return Sheet(TILE, TILE, rows, post=split)
