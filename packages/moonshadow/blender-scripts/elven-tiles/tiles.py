import math
import random

import numpy

from elven import filigree_arch
from shooter import (Sheet, box, clear_scene, color, cylinder, emission_material,
                     front_camera, material, mix_color, new_object, node,
                     setup_scene, shader_material, sphere, torus, tube)

# Textures of the keep's walls, floors and ceilings: 256x256 pixel tiles of
# 1x1 m that repeat seamlessly, modeled as relief panels seen from the front
# under an even white light.
#
# Rows are the sections: grove hall, gallery, chambers, throne hall, and a
# last row with the throne hall's stained glass window. Columns: wall base
# (the lowest meter), wall panel, wall top (the band under the ceiling, with
# the rune lights), floor, ceiling. The sheet holds the tiles twice: the
# upper half is the surface color, the lower half what glows on its own,
# which the game uses as the emission texture.
TILE = 256
PIXELS_PER_METER = TILE
SECTIONS = ["grove", "gallery", "chamber", "throne"]
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
            "moss stone": grimy("Moss Stone", "#5a6a4a", "#9a9a88", 7.0, 0.85, 0.0),
            "white stone": grimy("White Stone", "#c8c4b8", "#e8e4da", 9.0, 0.6, 0.0),
            "marble": grimy("Marble", "#d8d6ce", "#f4f2ec", 3.0, 0.25, 0.0),
            "dark marble": grimy("Dark Marble", "#2a3a4a", "#3a4e60", 3.0, 0.25, 0.0),
            "wood": grimy("Elm", "#5a3820", "#7a5030", 18.0, 0.6, 0.0),
            "dark wood": grimy("Dark Wood", "#2e1c10", "#44291a", 18.0, 0.6, 0.0),
            "moss": grimy("Moss", "#2a4a1e", "#4a6a2a", 40.0, 0.95, 0.0),
            "velvet": material("Banner", "#1e3a7a", 0.9),
            "gold": material("Gold", "#e0b040", 0.3, 1.0),
            "dark": material("Shadow", "#14161c", 0.8),
            "night": material("Night", "#0a1024", 0.9),
            "rune": emission_material("Rune", "#7ae0ff", 3.0),
            "moon": emission_material("Moon", "#d0ecff", 3.0),
            "fire": emission_material("Fire", "#ffb040", 3.0),
            "star": emission_material("Star", "#ffffff", 4.0),
            "gold glow": emission_material("Gold Glow", "#ffd070", 2.0),
            "glass": [emission_material(f"Glass {i}", c, 2.2) for i, c in
                      enumerate(("#3a6aff", "#2ad06a", "#ffcc3a", "#c83aff", "#3ae0ff", "#ff5a3a"))],
            "lead": material("Lead", "#2a2a2e", 0.6, 0.6),
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

    # --- grove hall: mossy stone, carved vines, moon lanterns, a starry vault

    def grove_base(self, g, m):
        plate("Stone", m["moss stone"], g)
        plate("Plinth", m["white stone"], g, z=-0.38, h=0.24, depth=0.06)
        for x in (-0.25, 0.25):
            plate(f"Block {x}", m["moss stone"], g, x=x, z=0.15, w=0.48, h=0.45, depth=0.05)

    def grove_panel(self, g, m):
        plate("Stone", m["moss stone"], g)
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.25):
                plate(f"Block {x} {z}", m["white stone"], g, x=x + (0.25 if z > 0 else 0) * 0, z=z,
                      w=0.48, h=0.48, depth=0.05, bevel=0.02)
        tube("Vine", [(-0.5, -0.06, -0.3), (-0.1, -0.06, 0.1), (0.2, -0.06, -0.1), (0.5, -0.06, 0.3)],
             0.018, m["moss"], g)
        for k, (x, z) in enumerate(((-0.3, -0.12), (0.0, 0.08), (0.3, 0.05))):
            sphere(f"Leaf {k}", 0.05, m["moss"], g, (x, -0.07, z), scale=(1.4, 0.3, 0.8))

    def grove_top(self, g, m):
        plate("Stone", m["moss stone"], g)
        plate("Cornice", m["white stone"], g, z=0.35, h=0.2, depth=0.08)
        sphere("Lantern", 0.08, m["moon"], g, (0, -0.1, 0.0))
        torus("Lantern Ring", 0.1, 0.012, m["gold"], g, (0, -0.1, 0.0), rotation=(90, 0, 0))

    def grove_floor(self, g, m):
        plate("Moss", m["moss"], g, bevel=0.0)
        for x, z, w in ((-0.22, -0.2, 0.42), (0.22, 0.22, 0.4), (0.25, -0.25, 0.3), (-0.25, 0.25, 0.3)):
            plate(f"Flag {x} {z}", m["white stone"], g, x=x, z=z, w=w, h=w * 0.9, depth=0.05, bevel=0.03)

    def grove_ceiling(self, g, m):
        plate("Night", m["night"], g, bevel=0.0)
        rng = random.Random(5)
        for k in range(14):
            sphere(f"Star {k}", 0.008 + rng.random() ** 3 * 0.015, m["star"], g,
                   (rng.uniform(-0.46, 0.46), -0.05, rng.uniform(-0.46, 0.46)), subdivisions=1)

    # --- gallery: white stone, gold arches, a frieze of runes, marble floor

    def gallery_base(self, g, m):
        plate("Wainscot", m["dark wood"], g)
        plate("Panel", m["wood"], g, w=0.8, h=0.6, depth=0.05, z=-0.05)
        plate("Rail", m["gold"], g, z=0.42, h=0.04, depth=0.06, bevel=0.0)

    def gallery_panel(self, g, m):
        plate("Stone", m["white stone"], g)
        plate("Inset", m["white stone"], g, w=0.8, h=0.9, depth=0.05, bevel=0.03)
        filigree_arch("Arch", g, 0.6, 0.8, m["gold"], (0, -0.06, -0.4))

    def gallery_top(self, g, m):
        plate("Stone", m["white stone"], g)
        plate("Frieze", m["dark marble"], g, z=0.15, h=0.22, depth=0.06)
        for x in (-0.3, 0.0, 0.3):
            box(f"Rune {x}", (0.08, 0.01, 0.08), m["rune"], g, (x, -0.065, 0.15), rotation=(0, 45, 0))
        plate("Cornice", m["gold"], g, z=0.4, h=0.04, depth=0.07, bevel=0.0)

    def gallery_floor(self, g, m):
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.25):
                plate(f"Tile {x} {z}", m["marble"] if (x > 0) == (z > 0) else m["dark marble"], g,
                      x=x, z=z, w=0.5, h=0.5, depth=0.04, bevel=0.005)

    def gallery_ceiling(self, g, m):
        plate("Vault", m["white stone"], g)
        torus("Rosette", 0.16, 0.02, m["gold"], g, (0, -0.05, 0), rotation=(90, 0, 0))
        sphere("Lamp", 0.07, m["moon"], g, (0, -0.06, 0))

    # --- chambers: wood paneling, a leafy frieze, plank floor

    def chamber_base(self, g, m):
        plate("Panel", m["dark wood"], g)
        plate("Inset", m["wood"], g, w=0.84, h=0.7, depth=0.05)

    def chamber_panel(self, g, m):
        plate("Plaster", m["white stone"], g, bevel=0.0)
        for x in (-0.5, 0.5):
            plate(f"Beam {x}", m["dark wood"], g, x=x, w=0.08, depth=0.05, bevel=0.0)

    def chamber_top(self, g, m):
        plate("Plaster", m["white stone"], g, bevel=0.0)
        plate("Frieze", m["wood"], g, z=0.25, h=0.18, depth=0.05)
        tube("Leaf Line", [(-0.5, -0.06, 0.25), (0, -0.06, 0.3), (0.5, -0.06, 0.25)], 0.02, m["moss"], g)
        sphere("Candle", 0.04, m["fire"], g, (0, -0.08, -0.05), scale=(1, 1, 1.5))

    def chamber_floor(self, g, m):
        for k in range(4):
            plate(f"Plank {k}", m["wood"] if k % 2 else m["dark wood"], g, x=-0.375 + 0.25 * k, w=0.245,
                  depth=0.04, bevel=0.005)

    def chamber_ceiling(self, g, m):
        plate("Boards", m["wood"], g)
        plate("Beam", m["dark wood"], g, w=0.12, depth=0.08, bevel=0.01)

    # --- throne hall: marble, gold pilasters, banners, a gold-starred vault

    def throne_base(self, g, m):
        plate("Marble", m["dark marble"], g)
        plate("Band", m["gold"], g, z=0.35, h=0.03, depth=0.05, bevel=0.0)

    def throne_panel(self, g, m):
        plate("Marble", m["marble"], g)
        plate("Pilaster", m["white stone"], g, x=-0.42, w=0.14, depth=0.07)
        plate("Pilaster Gold", m["gold"], g, x=-0.42, w=0.03, depth=0.075, bevel=0.0)
        plate("Banner", m["velvet"], g, x=0.08, w=0.5, h=0.9, depth=0.06, bevel=0.0)
        sphere("Banner Sigil", 0.09, m["gold glow"], g, (0.08, -0.07, 0.1), scale=(1, 0.2, 1.2))

    def throne_top(self, g, m):
        plate("Marble", m["marble"], g)
        plate("Frieze", m["dark marble"], g, z=0.2, h=0.2, depth=0.06)
        plate("Glow", m["gold glow"], g, z=0.2, h=0.03, depth=0.065, bevel=0.0)

    def throne_floor(self, g, m):
        plate("Marble", m["marble"], g, bevel=0.0)
        for k in range(4):
            box(f"Inlay {k}", (0.7, 0.01, 0.02), m["gold"], g, (0, -0.045, 0), rotation=(0, 45 * k, 0))

    def throne_ceiling(self, g, m):
        plate("Vault", m["night"], g, bevel=0.0)
        for k, (x, z) in enumerate(((-0.25, -0.25), (0.25, 0.25), (0.25, -0.25), (-0.25, 0.25))):
            box(f"Gold Star {k}", (0.06, 0.01, 0.06), m["gold glow"], g, (x, -0.045, z), rotation=(0, 45, 0))

    # --- the stained glass window: colored panes in lead, a moon in the middle

    def window(self, g, m):
        plate("Lead", m["lead"], g, depth=0.01, bevel=0.0)
        rng = random.Random(2)
        for x in range(4):
            for z in range(4):
                pane = m["glass"][rng.randrange(len(m["glass"]))]
                plate(f"Pane {x} {z}", pane, g, x=-0.375 + 0.25 * x, z=-0.375 + 0.25 * z, w=0.22, h=0.22,
                      depth=0.02, bevel=0.0)
        sphere("Moon", 0.12, m["moon"], g, (0, -0.03, 0), scale=(1, 0.2, 1))
        plate("Frame Bottom", m["white stone"], g, z=-0.48, h=0.04, depth=0.08)
        plate("Frame Top", m["white stone"], g, z=0.48, h=0.04, depth=0.08)
        plate("Mullion", m["white stone"], g, x=0.48, w=0.04, depth=0.08)
        plate("Mullion 2", m["white stone"], g, x=-0.48, w=0.04, depth=0.08)


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
