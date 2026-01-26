"""Shared toolkit of the cartoonish low poly Ptuj models: a flat color
palette, one material per palette entry and a mesh builder of chunky
primitives that are shaded flat.

Blender axes are kept: X points east, Y north and Z up; the glTF exporter
turns them into three.js' Y up. Every model faces south (-Y), that is the
side with its door, and stands on Z = 0 with a plinth reaching below it, so
it can sit on uneven ground.
"""
import math
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

PALETTE = {
    # ground
    "grass": "#8cc152",
    "grass_dark": "#5e9e3f",
    "meadow": "#a8d468",
    "field_wheat": "#e8c65a",
    "field_green": "#b5d96b",
    "field_soil": "#c49a68",
    "vine": "#4f8f3a",
    "soil": "#a87b50",
    "sand": "#e6d3a3",
    "riverbed": "#9c8a6a",
    "earth": "#7a5236",
    "road": "#d9c9a8",
    "asphalt": "#5f6266",
    "plaza": "#ece0c8",
    "gravel": "#e4d8bd",
    "track": "#c8553d",
    "water": "#3fa7d6",
    # buildings
    "wall": "#f6efe0",
    "wall_cream": "#f3e3bd",
    "wall_yellow": "#f5d482",
    "wall_pink": "#f0b7a4",
    "wall_blue": "#bcd6e6",
    "wall_green": "#cfe3b4",
    "wall_ochre": "#e7bf7d",
    "stone": "#cfc6b4",
    "stone_dark": "#9e9483",
    "roof": "#d1543b",
    "roof_dark": "#a03f2d",
    "roof_brown": "#7b4a33",
    "copper": "#5fbf9f",
    "gold": "#f5c242",
    "window": "#34506b",
    "door": "#7a4b2a",
    "wood": "#9a6a43",
    "wood_dark": "#6b4529",
    "shutter": "#4f9a5a",
    "white": "#ffffff",
    "black": "#2b2b2b",
    # details
    "red": "#d9333f",
    "green": "#3aa655",
    "blue": "#3b7dd8",
    "yellow": "#f7d038",
    "pink": "#f28ab2",
    "brass": "#d4a640",
    "leather": "#5b3a29",
    "fur": "#e9e1d2",
    "fur_dark": "#3b2c25",
    "horn": "#efe3c8",
    "skin": "#f2c9a0",
    "fluo_yellow": "#e4ff1a",
    "fluo_pink": "#ff3d9a",
    "fluo_green": "#3dff6e",
    "leaf": "#6fb544",
    "leaf_light": "#9bd05a",
    "leaf_dark": "#3f8a3c",
    "trunk": "#7a5232",
    "cloud": "#ffffff",
}


def color(hex_color, alpha=1.0):
    """Hex sRGB to the linear RGBA that node sockets expect."""
    def linear(channel):
        channel /= 255
        if channel <= 0.04045:
            return channel / 12.92
        return ((channel + 0.055) / 1.055) ** 2.4
    return tuple(linear(int(hex_color[i:i + 2], 16)) for i in (1, 3, 5)) + (alpha,)


def clear_scene():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights, bpy.data.curves,
                       bpy.data.actions):
        for block in list(collection):
            collection.remove(block)


def setup_scene(fps=30, frames=1):
    scene = bpy.context.scene
    scene.render.fps = fps
    scene.render.fps_base = 1
    scene.frame_start = 0
    scene.frame_end = frames - 1
    scene.unit_settings.system = 'METRIC'
    return scene


def material(name):
    """The material of a palette entry, created once and shared. Its name is
    what the app looks for when it swaps in its own materials."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    rgba = color(PALETTE[name])
    new = bpy.data.materials.new(name)
    if new.node_tree is None:
        new.use_nodes = True
    shader = next(node for node in new.node_tree.nodes
                  if node.type == 'BSDF_PRINCIPLED')
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = 0.9
    new.diffuse_color = rgba
    new.use_backface_culling = True
    return new


def matrix(at=(0, 0, 0), rotation=0.0, scale=(1, 1, 1)):
    """Placement of a primitive; a number rotates around Z, a triple is an
    XYZ euler."""
    if isinstance(rotation, (int, float)):
        rotation = (0.0, 0.0, rotation)
    return (Matrix.Translation(at) @ Euler(rotation).to_matrix().to_4x4()
            @ Matrix.Diagonal(Vector(scale).to_4d()))


class Builder:
    """Collects primitives into one mesh with a material slot per palette
    entry used. Faces are turned to point away from their primitive's center,
    so hand made primitives have to be convex."""

    def __init__(self, name, seed=0):
        self.name = name
        self.bm = bmesh.new()
        self.materials = []
        self.random = random.Random(seed)

    def slot(self, name):
        if name not in self.materials:
            self.materials.append(name)
        return self.materials.index(name)

    def polygons(self, points, polygons, mat, transform=None):
        transform = transform or Matrix.Identity(4)
        points = [transform @ Vector(point) for point in points]
        center = sum(points, Vector()) / len(points)
        verts = [self.bm.verts.new(point) for point in points]
        index = self.slot(mat)
        for polygon in polygons:
            face = self.bm.faces.new([verts[i] for i in polygon])
            face.normal_update()
            if face.normal.dot(face.calc_center_median() - center) < 0:
                face.normal_flip()
            face.material_index = index

    def _assign(self, verts, mat):
        index = self.slot(mat)
        for face in {face for vert in verts for face in vert.link_faces}:
            face.material_index = index

    # --- primitives --------------------------------------------------------

    def box(self, at, size, mat, rotation=0.0):
        """Box of size (x, y, z) standing with its bottom center on at."""
        w, d, h = size[0] / 2, size[1] / 2, size[2]
        points = [(x, y, z) for z in (0, h) for y in (-d, d) for x in (-w, w)]
        self.polygons(points, [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4),
                               (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)],
                      mat, matrix(at, rotation))

    def prism(self, at, outline, height, mat, rotation=0.0):
        """Upright prism over a convex outline of (x, y) points."""
        count = len(outline)
        points = [(x, y, z) for z in (0, height) for x, y in outline]
        polygons = [tuple(range(count)), tuple(range(count, 2 * count))]
        polygons += [(i, (i + 1) % count, count + (i + 1) % count, count + i)
                     for i in range(count)]
        self.polygons(points, polygons, mat, matrix(at, rotation))

    def cylinder(self, at, radius, height, mat, sides=8, top=None,
                 rotation=0.0):
        """Cylinder (or frustum/cone with top radius) on its bottom center."""
        top = radius if top is None else top
        result = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=sides,
            radius1=radius, radius2=top, depth=height,
            matrix=matrix(at, rotation) @ Matrix.Translation((0, 0,
                                                              height / 2)))
        self._assign(result["verts"], mat)

    def cone(self, at, radius, height, mat, sides=8, rotation=0.0):
        self.cylinder(at, radius, height, mat, sides, 0.0, rotation)

    def ico(self, at, radius, mat, subdivisions=1, scale=(1, 1, 1),
            jitter=0.0, rotation=0.0):
        """Faceted blob around at, roughened by jitter (share of radius)."""
        result = bmesh.ops.create_icosphere(
            self.bm, subdivisions=subdivisions, radius=radius,
            matrix=matrix(at, rotation, scale))
        for vert in result["verts"]:
            vert.co += Vector([self.random.uniform(-1, 1)
                               for _ in range(3)]) * jitter * radius
        self._assign(result["verts"], mat)

    def sphere(self, at, radius, mat, segments=8, rings=6, scale=(1, 1, 1)):
        result = bmesh.ops.create_uvsphere(
            self.bm, u_segments=segments, v_segments=rings, radius=radius,
            matrix=matrix(at, 0.0, scale))
        self._assign(result["verts"], mat)

    def pyramid(self, at, size, height, mat, rotation=0.0):
        w, d = size[0] / 2, size[1] / 2
        points = [(-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0),
                  (0, 0, height)]
        self.polygons(points, [(0, 1, 2, 3), (0, 1, 4), (1, 2, 4), (2, 3, 4),
                               (3, 0, 4)], mat, matrix(at, rotation))

    def strip(self, profile, x0, x1, mat):
        """Solid along Y between a lower and an upper profile of (y, low,
        high), built from one convex block per step."""
        for (y0, low0, high0), (y1, low1, high1) in zip(profile, profile[1:]):
            points = [(x, y, z) for x in (x0, x1)
                      for y, z in ((y0, low0), (y1, low1), (y1, high1),
                                   (y0, high0))]
            self.polygons(points, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
                                   (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
                          mat)

    # --- roofs -------------------------------------------------------------

    def gable_roof(self, at, size, height, mat, wall=None, overhang=0.5,
                   thickness=0.35, ridge="x"):
        """Two roof slabs over walls of size (x, y) whose top is at, with the
        ridge along X or Y and the triangular gable walls in wall."""
        rotation = 0.0 if ridge == "x" else math.pi / 2
        w, d = (size[0], size[1]) if ridge == "x" else (size[1], size[0])
        transform = matrix(at, rotation)
        half = d / 2
        rise = thickness * math.hypot(half, height) / half
        drop = overhang * height / half
        x = w / 2 + overhang
        for side in (-1, 1):
            edge = side * (half + overhang)
            outline = [(edge, -drop), (0, height), (0, height + rise),
                       (edge, rise - drop)]
            points = [(px, y, z) for px in (-x, x) for y, z in outline]
            self.polygons(points, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
                                   (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
                          mat, transform)
        if wall:
            points = [(px, y, z) for px in (-w / 2, w / 2)
                      for y, z in ((-half, 0), (half, 0), (0, height))]
            self.polygons(points, [(0, 1, 2), (3, 4, 5)], wall, transform)

    def hip_roof(self, at, size, height, mat, overhang=0.5):
        """Roof sloping on all four sides, a pyramid when size is square."""
        w, d = size[0] / 2 + overhang, size[1] / 2 + overhang
        drop = overhang * height / min(w, d)
        if abs(w - d) < 1e-3:
            self.pyramid(Vector(at) - Vector((0, 0, drop)), (2 * w, 2 * d),
                         height + drop, mat)
            return
        base = [(-w, -d, -drop), (w, -d, -drop), (w, d, -drop), (-w, d, -drop)]
        if w > d:
            ridge = [(-(w - d), 0, height), (w - d, 0, height)]
            polygons = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)]
        else:
            ridge = [(0, -(d - w), height), (0, d - w, height)]
            polygons = [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)]
        self.polygons(base + ridge, polygons + [(0, 1, 2, 3)], mat,
                      matrix(at))

    def onion(self, at, radius, mat, tip="gold"):
        """Baroque bulb cap with a lantern and a golden spire."""
        x, y, z = at
        self.cylinder((x, y, z), radius * 0.9, radius * 0.5, mat, 8,
                      radius * 1.05)
        self.sphere((x, y, z + radius * 1.2), radius, mat, 8, 6,
                    (1, 1, 0.85))
        self.cone((x, y, z + radius * 1.7), radius * 0.6, radius * 0.9, mat)
        self.cylinder((x, y, z + radius * 2.4), radius * 0.28, radius * 0.7,
                      "white", 8)
        self.sphere((x, y, z + radius * 3.35), radius * 0.4, mat, 8, 5)
        self.cone((x, y, z + radius * 3.55), radius * 0.15, radius * 1.4, tip,
                  6)
        self.sphere((x, y, z + radius * 4.4), radius * 0.13, tip, 6, 4)

    # --- facades -----------------------------------------------------------

    def windows(self, at, size, floors, floor_height, sides="NESW",
                spacing=2.8, mat="window", door=None, shutters=None,
                window=(0.9, 1.3), first=0):
        """Windows on the faces of a box of size (x, y) standing on at,
        floor by floor from floor first. The door replaces the middle window
        of the ground floor on the south side."""
        x0, y0, z0 = at
        w, d = size[0] / 2, size[1] / 2
        ww, wh = window
        faces = {"S": ((0, -1), w), "N": ((0, 1), w),
                 "E": ((1, 0), d), "W": ((-1, 0), d)}
        for side in sides:
            (nx, ny), half = faces[side]
            columns = max(1, int(2 * half / spacing))
            for column in range(columns):
                along = -half + (column + 0.5) * 2 * half / columns
                for floor in range(first, floors):
                    z = z0 + floor * floor_height + floor_height * 0.32
                    px = x0 + (nx * w if nx else along)
                    py = y0 + (ny * d if ny else along)
                    is_door = (door and side == "S" and floor == 0
                               and column == columns // 2)
                    width, height = (1.3, 2.3) if is_door else (ww, wh)
                    if is_door:
                        z = z0
                    size3 = (width, 0.24, height) if ny else (0.24, width,
                                                              height)
                    self.box((px, py, z), size3, door if is_door else mat)
                    if shutters and not is_door:
                        for s in (-1, 1):
                            offset = s * (width / 2 + 0.25)
                            shutter = ((0.4, 0.2, height) if ny
                                       else (0.2, 0.4, height))
                            self.box((px + (0 if nx else offset),
                                      py + (offset if nx else 0), z),
                                     shutter, shutters)

    def finish(self, parent=None, location=(0, 0, 0)):
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for name in self.materials:
            mesh.materials.append(material(name))
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        obj.location = location
        return obj


def marker(name, location, rotation=0.0, scale=1.0, **extras):
    """Empty exported as a glTF node whose extras (three.js userData) tell
    the app what to put there, e.g. model="castle" or path="river"."""
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler.z = rotation
    obj.scale = (scale,) * 3
    for key, value in extras.items():
        obj[key] = value
    return obj


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj
