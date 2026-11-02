import math
import random

import numpy

from gothic import pointed_arch
from shooter import (Sheet, box, clear_scene, color, cylinder, emission_material,
                     front_camera, material, mix_color, new_object, node,
                     setup_scene, shader_material, sphere, torus, tube)

# Textures of the castle's walls, floors and ceilings: 256x256 pixel tiles of
# 1x1 m that repeat seamlessly, modeled as relief panels seen from the front
# under an even white light.
#
# Rows are the sections: crypt, corridor, bedchambers, ballroom, and a last
# row with the ballroom's gothic window. Columns: wall base (the lowest
# meter), wall panel, wall top (the band under the ceiling, with the candle
# sconces), floor, ceiling. The sheet holds the tiles twice: the
# upper half is the surface color, the lower half what glows on its own,
# which the game uses as the emission texture.
TILE = 256
PIXELS_PER_METER = TILE
SECTIONS = ["crypt", "corridor", "chamber", "ballroom"]
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


class Tiles:
    def __init__(self):
        self.groups = {}
        m = self.m = {
            "rough stone": grimy("Rough Stone", "#2e2c2a", "#5a5650", 7.0, 0.9, 0.0),
            "stone": grimy("Castle Stone", "#3e3a36", "#6a645c", 9.0, 0.75, 0.0),
            "marble": grimy("Black Marble", "#141218", "#2a2630", 3.0, 0.2, 0.0),
            "red marble": grimy("Red Marble", "#3a0a10", "#5a1a20", 3.0, 0.2, 0.0),
            "oak": grimy("Dark Oak", "#24160c", "#3e2616", 18.0, 0.6, 0.0),
            "ebony": grimy("Ebony", "#100a08", "#20160e", 18.0, 0.4, 0.0),
            "moss": grimy("Damp", "#1a2214", "#2e3a22", 40.0, 0.95, 0.0),
            "wallpaper": grimy("Wallpaper", "#2a1216", "#3a1c20", 30.0, 0.9, 0.0),
            "velvet": material("Drape", "#5a0810", 0.9),
            "iron": material("Iron", "#2a2a2e", 0.45, 0.9),
            "gold": material("Old Gold", "#c8a040", 0.35, 1.0),
            "bone": material("Bone", "#c8bca0", 0.6),
            "dark": material("Shadow", "#0c0a0c", 0.8),
            "night": material("Night", "#06080e", 0.9),
            "fire": emission_material("Fire", "#ffa040", 3.0),
            "blood glow": emission_material("Blood Glow", "#ff2030", 2.0),
            "moon": emission_material("Moon", "#c0d4ff", 3.0),
            "star": emission_material("Star", "#d8e0ff", 3.0),
            "glass": [emission_material(f"Glass {i}", c, 2.0) for i, c in
                      enumerate(("#8a0a14", "#3a1a6a", "#1a2a6a", "#6a0a3a", "#c8a040", "#2a5a4a"))],
            "lead": material("Lead", "#1a1a1e", 0.6, 0.6),
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

    # --- crypt: rough damp blocks, niches of bones, torches, a ribbed vault

    def crypt_base(self, g, m):
        plate("Stone", m["moss"], g)
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.22):
                plate(f"Block {x} {z}", m["rough stone"], g, x=x, z=z, w=0.48, h=0.44, depth=0.05, bevel=0.025)

    def crypt_panel(self, g, m):
        plate("Stone", m["moss"], g)
        for z, offset in ((-0.33, 0.0), (0.0, 0.25), (0.33, 0.0)):
            for x in (-0.5, 0.0, 0.5):
                plate(f"Block {x} {z}", m["rough stone"], g, x=x + offset, z=z, w=0.48, h=0.3, depth=0.05,
                      bevel=0.025)
        plate("Niche", m["dark"], g, z=0.0, w=0.3, h=0.25, depth=0.07, bevel=0.0, y=0.02)
        sphere("Skull", 0.07, m["bone"], g, (0, -0.03, -0.03), scale=(0.85, 1, 0.9))

    def crypt_top(self, g, m):
        plate("Stone", m["rough stone"], g)
        plate("Cornice", m["stone"], g, z=0.38, h=0.18, depth=0.08)
        box("Sconce", (0.12, 0.08, 0.04), m["iron"], g, (0, -0.06, -0.12))
        sphere("Torch", 0.07, m["fire"], g, (0, -0.1, 0.0), scale=(0.8, 0.8, 1.4))

    def crypt_floor(self, g, m):
        plate("Dirt", m["moss"], g, bevel=0.0)
        for x, z, w in ((-0.22, -0.2, 0.42), (0.22, 0.22, 0.4), (0.25, -0.25, 0.3), (-0.25, 0.25, 0.3)):
            plate(f"Flag {x} {z}", m["rough stone"], g, x=x, z=z, w=w, h=w * 0.9, depth=0.05, bevel=0.03)

    def crypt_ceiling(self, g, m):
        plate("Vault", m["rough stone"], g, bevel=0.0)
        for k in range(2):
            box(f"Rib {k}", (1.45, 0.06, 0.08), m["stone"], g, (0, -0.04, 0), rotation=(0, 45 + 90 * k, 0))

    # --- corridor: wainscot, red damask, portraits of iron, a black and red floor

    def corridor_base(self, g, m):
        plate("Wainscot", m["ebony"], g)
        plate("Panel", m["oak"], g, w=0.8, h=0.6, depth=0.05, z=-0.05)
        pointed_arch("Panel Arch", g, 0.5, 0.45, 0.012, m["iron"], (0, -0.06, -0.3))
        plate("Rail", m["gold"], g, z=0.42, h=0.04, depth=0.06, bevel=0.0)

    def corridor_panel(self, g, m):
        plate("Wallpaper", m["wallpaper"], g, bevel=0.0)
        for x in (-0.5, 0.5):
            plate(f"Pilaster {x}", m["ebony"], g, x=x, w=0.1, depth=0.06)
        pointed_arch("Arch", g, 0.6, 0.85, 0.02, m["gold"], (0, -0.04, -0.42))

    def corridor_top(self, g, m):
        plate("Wallpaper", m["wallpaper"], g, bevel=0.0)
        plate("Frieze", m["ebony"], g, z=0.25, h=0.22, depth=0.06)
        plate("Cornice", m["gold"], g, z=0.4, h=0.04, depth=0.07, bevel=0.0)
        box("Sconce", (0.1, 0.08, 0.03), m["iron"], g, (0, -0.06, -0.15))
        sphere("Candle", 0.04, m["fire"], g, (0, -0.1, -0.05), scale=(1, 1, 1.6))

    def corridor_floor(self, g, m):
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.25):
                plate(f"Tile {x} {z}", m["marble"] if (x > 0) == (z > 0) else m["red marble"], g,
                      x=x, z=z, w=0.5, h=0.5, depth=0.04, bevel=0.005)

    def corridor_ceiling(self, g, m):
        plate("Vault", m["stone"], g)
        for k in range(2):
            box(f"Rib {k}", (1.45, 0.06, 0.06), m["ebony"], g, (0, -0.04, 0), rotation=(0, 45 + 90 * k, 0))
        sphere("Boss", 0.06, m["gold"], g, (0, -0.07, 0))

    # --- bedchambers: dark paneling, faded wallpaper, plank floor

    def chamber_base(self, g, m):
        plate("Panel", m["ebony"], g)
        plate("Inset", m["oak"], g, w=0.84, h=0.7, depth=0.05)

    def chamber_panel(self, g, m):
        plate("Wallpaper", m["wallpaper"], g, bevel=0.0)
        for x in (-0.5, 0.5):
            plate(f"Beam {x}", m["ebony"], g, x=x, w=0.08, depth=0.05, bevel=0.0)
        for k, (x, z) in enumerate(((-0.2, 0.2), (0.2, -0.2), (0.2, 0.3), (-0.2, -0.3))):
            box(f"Damask {k}", (0.08, 0.01, 0.12), m["velvet"], g, (x, -0.005, z), rotation=(0, 45, 0))

    def chamber_top(self, g, m):
        plate("Wallpaper", m["wallpaper"], g, bevel=0.0)
        plate("Frieze", m["oak"], g, z=0.25, h=0.18, depth=0.05)
        box("Sconce", (0.1, 0.08, 0.03), m["iron"], g, (0, -0.06, -0.15))
        sphere("Candle", 0.04, m["fire"], g, (0, -0.08, -0.05), scale=(1, 1, 1.5))

    def chamber_floor(self, g, m):
        for k in range(4):
            plate(f"Plank {k}", m["oak"] if k % 2 else m["ebony"], g, x=-0.375 + 0.25 * k, w=0.245,
                  depth=0.04, bevel=0.005)

    def chamber_ceiling(self, g, m):
        plate("Boards", m["oak"], g)
        plate("Beam", m["ebony"], g, w=0.12, depth=0.08, bevel=0.01)

    # --- ballroom: black marble, gold pilasters, red drapes, a painted night vault

    def ballroom_base(self, g, m):
        plate("Marble", m["marble"], g)
        plate("Band", m["gold"], g, z=0.35, h=0.03, depth=0.05, bevel=0.0)

    def ballroom_panel(self, g, m):
        plate("Marble", m["red marble"], g)
        plate("Pilaster", m["marble"], g, x=-0.42, w=0.14, depth=0.07)
        plate("Pilaster Gold", m["gold"], g, x=-0.42, w=0.03, depth=0.075, bevel=0.0)
        plate("Drape", m["velvet"], g, x=0.08, w=0.5, h=1.0, depth=0.06, bevel=0.0)
        sphere("Drape Crest", 0.08, m["blood glow"], g, (0.08, -0.07, 0.15), scale=(1, 0.2, 1.2))

    def ballroom_top(self, g, m):
        plate("Marble", m["marble"], g)
        plate("Frieze", m["red marble"], g, z=0.2, h=0.2, depth=0.06)
        plate("Gold", m["gold"], g, z=0.2, h=0.03, depth=0.065, bevel=0.0)
        box("Sconce", (0.12, 0.08, 0.03), m["gold"], g, (0, -0.07, -0.2))
        sphere("Candle", 0.045, m["fire"], g, (0, -0.1, -0.1), scale=(1, 1, 1.6))

    def ballroom_floor(self, g, m):
        plate("Marble", m["marble"], g, bevel=0.0)
        for x in (-0.25, 0.25):
            for z in (-0.25, 0.25):
                if (x > 0) != (z > 0):
                    plate(f"Square {x} {z}", m["red marble"], g, x=x, z=z, w=0.5, h=0.5, depth=0.045, bevel=0.004)
        sphere("Inlay Rose", 0.04, m["gold"], g, (0, -0.05, 0), scale=(1, 0.2, 1))

    def ballroom_ceiling(self, g, m):
        plate("Vault", m["night"], g, bevel=0.0)
        rng = random.Random(5)
        for k in range(3):
            sphere(f"Star {k}", 0.006 + rng.random() ** 3 * 0.01, m["star"], g,
                   (rng.uniform(-0.4, 0.4), -0.05, rng.uniform(-0.4, 0.4)), subdivisions=1)
        for x in (-0.5, 0.5):
            plate(f"Beam {x}", m["ebony"], g, x=x, w=0.1, depth=0.06)

    # --- the gothic window: blood red and violet panes in lead, a full moon

    def window(self, g, m):
        plate("Lead", m["lead"], g, depth=0.01, bevel=0.0)
        rng = random.Random(2)
        for x in range(4):
            for z in range(4):
                pane = m["glass"][rng.randrange(len(m["glass"]))]
                plate(f"Pane {x} {z}", pane, g, x=-0.375 + 0.25 * x, z=-0.375 + 0.25 * z, w=0.22, h=0.22,
                      depth=0.02, bevel=0.0)
        sphere("Moon", 0.14, m["moon"], g, (0, -0.03, 0.05), scale=(1, 0.2, 1))
        pointed_arch("Tracery", g, 0.9, 0.95, 0.025, m["stone"], (0, -0.05, -0.48))
        plate("Frame Bottom", m["stone"], g, z=-0.48, h=0.04, depth=0.08)
        plate("Frame Top", m["stone"], g, z=0.48, h=0.04, depth=0.08)
        plate("Mullion", m["stone"], g, x=0.48, w=0.04, depth=0.08)
        plate("Mullion 2", m["stone"], g, x=-0.48, w=0.04, depth=0.08)


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
