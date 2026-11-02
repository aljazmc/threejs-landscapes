"""Shared Blender helpers: scene, materials, primitives, flat front views,
sprite sheet rendering and the palette that colors the exported models.

World axes are the game's: Z up, a meter is a meter. Models stand on the
origin facing -Y and are symmetric in X wherever it matters, because the
game reads the models mirrored in X (into its left handed axes); it keeps
its left handed coordinates and converts them for drawing, so the models
look as modeled.

Images (sprite sheets, textures, menu graphics) are rendered with Cycles.
Models carry no image of their own: every face gets the flat color of its
material from a small palette texture that bake_palette() makes and
exportglb.py embeds into the GLB file. Faces of glowing materials
(emission > 0) end up in the "Glow" material, which the game draws without
lighting, the others in "Palette".
"""

import math
import os
import re
import tempfile

import bmesh
import bpy
import numpy
from mathutils import Vector


class Sheet:
    """Sprite sheet of equally sized cells. Each cell is a function posing
    the scene for that frame (or None for an empty cell). post, if given,
    changes the rendered RGBA canvas (rows top down) before it is saved."""

    def __init__(self, width, height, rows, post=None):
        self.width = width
        self.height = height
        self.rows = rows
        self.post = post


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
                       bpy.data.images):
        for block in list(collection):
            collection.remove(block)


def setup_scene(samples=48, transparent=True, sun=True):
    """Cycles, so the sprites carry soft edges in the alpha channel."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = samples > 64
    scene.cycles.pixel_filter_type = 'BLACKMAN_HARRIS'
    scene.cycles.filter_width = 1.2
    scene.cycles.max_bounces = 4
    scene.render.film_transparent = transparent
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    add_world()
    if sun:
        add_sun()
    return scene


def add_world(hex_color="#283050", strength=0.6):
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = color(hex_color)
    background.inputs["Strength"].default_value = strength
    return world


def add_sun(energy=3.0, rotation=(50, 0, -30)):
    light = bpy.data.lights.new("Sun", 'SUN')
    light.energy = energy
    light.angle = math.radians(8)
    light.color = color("#e8f0ff")[:3]
    sun = bpy.data.objects.new("Sun", light)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = [math.radians(angle) for angle in rotation]
    return sun


def front_camera(width, height, pixels_per_meter, location=(0, -20, 0),
                 rotation=(90, 0, 0)):
    """Orthographic camera looking along +Y (by default) at the XZ plane,
    rendering width x height pixels with pixels_per_meter."""
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    camera = new_object("Camera", bpy.data.cameras.new("Camera"),
                        location=location, rotation=rotation)
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = max(width, height) / pixels_per_meter
    camera.data.clip_start = 0.1
    camera.data.clip_end = 200
    scene.camera = camera
    return camera


def text(body, size, mat, location=(0, 0, 0), extrude=0.02, bevel=0.0,
         rotation=(90, 0, 0), spacing=1.05, fill=True):
    """Centered 3D text, standing in the XZ plane facing -Y by default.
    Without fill only its outlines are drawn, as round tubes (bevel)."""
    curve = bpy.data.curves.new(body, 'FONT')
    if not fill:
        curve.fill_mode = 'NONE'
    curve.body = body
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    curve.bevel_depth = bevel
    curve.bevel_resolution = 2
    curve.space_character = spacing
    obj = new_object(body, curve, location=location, rotation=rotation)
    curve.materials.append(mat)
    return obj


# --- materials -------------------------------------------------------------

def material(name, hex_color, roughness=0.7, metallic=0.0, emission=0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat["hex"] = hex_color
    mat["glow"] = emission > 0
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = color(hex_color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = color(hex_color)
        shader.inputs["Emission Strength"].default_value = emission
    return mat


def node(tree, kind, inputs=(), **properties):
    """Inputs are (socket, value) pairs; a value that is a socket gets
    linked, anything else becomes the socket's default value."""
    new = tree.nodes.new(kind)
    for name, value in properties.items():
        setattr(new, name, value)
    for socket, value in inputs:
        socket = new.inputs[socket]
        if isinstance(value, bpy.types.NodeSocket):
            tree.links.new(value, socket)
        else:
            socket.default_value = value
    return new


def mix_color(tree, factor, a, b):
    mix = node(tree, "ShaderNodeMix", data_type='RGBA', clamp_factor=True)
    for index, value in ((0, factor), (6, a), (7, b)):
        if isinstance(value, bpy.types.NodeSocket):
            tree.links.new(value, mix.inputs[index])
        else:
            mix.inputs[index].default_value = value
    return mix.outputs[2]


def noise(tree, scale, detail=4.0, vector=None):
    inputs = [("Scale", scale), ("Detail", detail)]
    if vector is not None:
        inputs.append(("Vector", vector))
    return node(tree, "ShaderNodeTexNoise", inputs).outputs["Fac"]


def shader_material(name, build):
    """Material whose Principled BSDF inputs are linked by build(tree, bsdf)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    build(tree, tree.nodes["Principled BSDF"])
    return mat


def emission_material(name, hex_color, strength=1.0):
    """Pure light, for the glowing parts of images."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.remove(tree.nodes["Principled BSDF"])
    emit = node(tree, "ShaderNodeEmission", [("Color", color(hex_color)),
                                             ("Strength", strength)])
    tree.links.new(emit.outputs[0], tree.nodes["Material Output"].inputs[0])
    return mat


# --- primitives ------------------------------------------------------------

def new_object(name, data=None, parent=None, location=(0, 0, 0),
               rotation=(0, 0, 0), scale=(1, 1, 1), mat=None):
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = [math.radians(angle) for angle in rotation]
    obj.scale = scale
    if mat is not None:
        data.materials.append(mat)
    return obj


def joint(name, parent=None, location=(0, 0, 0)):
    """Empty that a limb hangs from; the game poses it by rotating it."""
    return new_object(name, None, parent, location)


def mesh_from(name, build, smooth=False):
    bm = bmesh.new()
    build(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    return mesh


def box(name, size, mat, parent=None, location=(0, 0, 0), rotation=(0, 0, 0),
        bevel=0.0):
    def build(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=size, verts=bm.verts)
        if bevel:
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2,
                            affect='EDGES')
    return new_object(name, mesh_from(name, build), parent, location,
                      rotation, mat=mat)


def cylinder(name, radius, depth, mat, parent=None, location=(0, 0, 0),
             rotation=(0, 0, 0), top=None, sides=12, smooth=True, scale=(1, 1, 1)):
    """Cylinder (or cone, with a top radius) standing on its base at the
    origin and reaching depth up along +Z."""
    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=sides,
                              radius1=radius,
                              radius2=radius if top is None else top,
                              depth=depth)
        bmesh.ops.translate(bm, vec=(0, 0, depth / 2), verts=bm.verts)
    return new_object(name, mesh_from(name, build, smooth), parent, location,
                      rotation, scale, mat)


def limb(name, radius, length, mat, parent, top=None, sides=8):
    """Cylinder hanging down from its joint."""
    return cylinder(name, radius, length, mat, parent, (0, 0, -length),
                    top=top if top is not None else radius, sides=sides)


def sphere(name, radius, mat, parent=None, location=(0, 0, 0),
           scale=(1, 1, 1), rotation=(0, 0, 0), subdivisions=2):
    def build(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions,
                                   radius=radius)
    return new_object(name, mesh_from(name, build, True), parent, location,
                      rotation, scale, mat)


def torus(name, radius, thickness, mat, parent=None, location=(0, 0, 0),
          rotation=(0, 0, 0), segments=24, sides=8):
    """Ring lying in the XY plane."""
    def build(bm):
        rings = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            center = Vector((math.cos(a) * radius, math.sin(a) * radius, 0))
            out = Vector((math.cos(a), math.sin(a), 0))
            rings.append([bm.verts.new(center + thickness * (math.cos(b) * out
                                                             + Vector((0, 0, math.sin(b)))))
                          for b in (2 * math.pi * j / sides for j in range(sides))])
        for i in range(segments):
            ring, following = rings[i], rings[(i + 1) % segments]
            for j in range(sides):
                k = (j + 1) % sides
                bm.faces.new((ring[j], ring[k], following[k], following[j]))
    return new_object(name, mesh_from(name, build, True), parent, location,
                      rotation, mat=mat)


def tube(name, points, radius, mat, parent=None, sides=6):
    """Round tube through 3D points, for pipes, cables and claws."""
    def build(bm):
        rings = []
        for index, point in enumerate(points):
            point = Vector(point)
            before = Vector(points[max(index - 1, 0)])
            after = Vector(points[min(index + 1, len(points) - 1)])
            tangent = (after - before).normalized()
            up = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
            side = tangent.cross(up).normalized()
            up = side.cross(tangent)
            r = radius(index / (len(points) - 1)) if callable(radius) else radius
            rings.append([bm.verts.new(point + r * (math.cos(a) * side
                                                    + math.sin(a) * up))
                          for a in (2 * math.pi * i / sides
                                    for i in range(sides))])
        for ring, following in zip(rings, rings[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                bm.faces.new((ring[i], ring[j], following[j], following[i]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return new_object(name, mesh_from(name, build, True), parent, mat=mat)


def mirrored(build, *args, **kwargs):
    """Calls build(sign) for both sides, sign 1 for +X and -1 for -X."""
    return [build(sign, *args, **kwargs) for sign in (1, -1)]


# --- rendering -------------------------------------------------------------

def read_pixels(path):
    image = bpy.data.images.load(path)
    width, height = image.size
    pixels = numpy.empty(width * height * 4, dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    # Blender stores the rows bottom up
    return pixels.reshape(height, width, 4)[::-1]


def save_pixels(canvas, filepath):
    height, width = canvas.shape[:2]
    image = bpy.data.images.new("Sheet", width, height, alpha=True)
    image.pixels.foreach_set(canvas[::-1].ravel())
    image.filepath_raw = filepath
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)


def render_sheet(sheet, filepath):
    """Render every cell of the sheet and save them side by side as PNG."""
    scene = bpy.context.scene
    columns = max(len(row) for row in sheet.rows)
    canvas = numpy.zeros((sheet.height * len(sheet.rows),
                          sheet.width * columns, 4), dtype=numpy.float32)
    with tempfile.TemporaryDirectory() as tmp:
        frame = os.path.join(tmp, "frame.png")
        for row, cells in enumerate(sheet.rows):
            for column, pose in enumerate(cells):
                if pose is None:
                    continue
                pose()
                scene.render.resolution_x = sheet.width
                scene.render.resolution_y = sheet.height
                scene.render.filepath = frame
                bpy.ops.render.render(write_still=True)
                y = row * sheet.height
                x = column * sheet.width
                canvas[y:y + sheet.height, x:x + sheet.width] = read_pixels(frame)
    if sheet.post is not None:
        canvas = sheet.post(canvas)
    save_pixels(canvas, filepath)


def blur(image, radius):
    """Gaussian-like blur of a float image (three box blurs per axis)."""
    out = image.astype(numpy.float32)
    size = max(1, int(radius))
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (size, size)
            padded = numpy.pad(out, pad, mode='constant')
            total = numpy.cumsum(padded, axis=axis, dtype=numpy.float64)
            total = numpy.insert(total, 0, 0, axis=axis)
            high = numpy.take(total, range(2 * size + 1, total.shape[axis]), axis=axis)
            low = numpy.take(total, range(0, total.shape[axis] - 2 * size - 1), axis=axis)
            out = ((high - low) / (2 * size + 1)).astype(numpy.float32)
    return out


def glow(canvas, cell_w, cell_h, radius=6, strength=1.2):
    """Neon halo: the bright pixels of each cell, blurred, put under it."""
    out = canvas.copy()
    for y in range(0, canvas.shape[0], cell_h):
        for x in range(0, canvas.shape[1], cell_w):
            cell = canvas[y:y + cell_h, x:x + cell_w]
            light = cell[..., :3] * cell[..., 3:4]
            bright = numpy.clip(light - 0.35, 0, None) * 1.6
            halo = blur(bright, radius) * strength
            halo_alpha = numpy.clip(halo.max(axis=2, keepdims=True), 0, 1)
            alpha = cell[..., 3:4]
            color = cell[..., :3] * alpha + halo * (1 - alpha)
            new_alpha = alpha + halo_alpha * (1 - alpha)
            out[y:y + cell_h, x:x + cell_w, :3] = numpy.clip(
                color / numpy.maximum(new_alpha, 1e-4), 0, 1)
            out[y:y + cell_h, x:x + cell_w, 3:4] = new_alpha
    return out


# --- models ----------------------------------------------------------------

PALETTE_CELL = 8  # pixels per color
PALETTE_COLUMNS = 8


def bake_palette(filepath):
    """Writes the colors of all materials of the meshes into a palette image
    at filepath, maps every face onto its color and leaves two materials,
    "Palette" and "Glow", that use the image."""
    colors = []
    meshes = {obj.data for obj in bpy.data.objects if obj.type == 'MESH'}
    for mesh in meshes:
        for mat in mesh.materials:
            if mat is not None and mat.get("hex") not in colors:
                colors.append(mat.get("hex", "#ff00ff"))
    rows = max(1, math.ceil(len(colors) / PALETTE_COLUMNS))
    size = PALETTE_CELL * PALETTE_COLUMNS
    canvas = numpy.zeros((rows * PALETTE_CELL, size, 4), dtype=numpy.float32)
    cells = {}
    for index, hex_color in enumerate(colors):
        row, column = divmod(index, PALETTE_COLUMNS)
        rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        canvas[row * PALETTE_CELL:(row + 1) * PALETTE_CELL,
               column * PALETTE_CELL:(column + 1) * PALETTE_CELL] = rgb + [1.0]
        cells[hex_color] = ((column + 0.5) / PALETTE_COLUMNS,
                            1 - (row + 0.5) / rows)
    save_pixels(canvas, filepath)

    image = bpy.data.images.load(filepath)
    shared = {}
    for glow in (False, True):
        mat = bpy.data.materials.new("Glow" if glow else "Palette")
        mat.use_nodes = True
        tree = mat.node_tree
        texture = node(tree, "ShaderNodeTexImage", image=image,
                       interpolation='Closest')
        tree.links.new(texture.outputs["Color"],
                       tree.nodes["Principled BSDF"].inputs["Base Color"])
        shared[glow] = mat

    for mesh in meshes:
        if not mesh.uv_layers:
            mesh.uv_layers.new(name="UVMap")
        uv = mesh.uv_layers.active.data
        used = [False, False]
        for polygon in mesh.polygons:
            mat = mesh.materials[polygon.material_index] if mesh.materials else None
            hex_color = mat.get("hex", "#ff00ff") if mat else "#ff00ff"
            glow = bool(mat.get("glow", False)) if mat else False
            used[glow] = True
            for loop in polygon.loop_indices:
                uv[loop].uv = cells.get(hex_color, (0, 0))
            polygon.material_index = int(glow)
        mesh.materials.clear()
        mesh.materials.append(shared[False])
        mesh.materials.append(shared[True])
        if not used[True]:
            mesh.materials.pop(index=1)
        elif not used[False]:
            for polygon in mesh.polygons:
                polygon.material_index = 0
            mesh.materials.pop(index=0)


# --- the ship's look ---------------------------------------------------------

def ship_materials():
    """Gunmetal hull plates, dark rubber and the neon of the ship's props."""
    return {
        "hull": material("Hull", "#4a5263", 0.45, 0.7),
        "light": material("Light Hull", "#8a93a6", 0.4, 0.7),
        "dark": material("Dark Hull", "#1c2029", 0.6, 0.5),
        "black": material("Rubber", "#0d0f14", 0.9),
        "brass": material("Brass", "#b58a3c", 0.35, 0.9),
        "rust": material("Rust", "#6e3b22", 0.8, 0.3),
        "fabric": material("Fabric", "#2b2f4a", 0.95),
        "cyan": material("Neon Cyan", "#22f2ff", emission=5.0),
        "magenta": material("Neon Magenta", "#ff2bd6", emission=5.0),
        "amber": material("Neon Amber", "#ffb020", emission=5.0),
        "green": material("Neon Green", "#4dff6a", emission=5.0),
        "red": material("Neon Red", "#ff3040", emission=5.0),
        "violet": material("Neon Violet", "#9a4dff", emission=5.0),
        "screen": material("Screen", "#0b5a8a", emission=2.0),
        "screen2": material("Screen Teal", "#0a7a6a", emission=2.0),
        "screen3": material("Screen Purple", "#4a1a7a", emission=2.0),
        "white": material("Neon White", "#e8f6ff", emission=4.0),
    }


def button_grid(name, columns, rows, pitch, size, mats, parent, location,
                rotation=(0, 0, 0)):
    """Rows of small glowing buttons in the XY plane of a joint, cycling
    through mats so a panel looks busy."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(angle) for angle in rotation]
    x0 = -(columns - 1) * pitch / 2
    y0 = -(rows - 1) * pitch / 2
    for row in range(rows):
        for column in range(columns):
            mat = mats[(row * 7 + column * 3 + row * column) % len(mats)]
            box(f"{name} {row} {column}", (size, size, size * 0.6), mat, holder,
                (x0 + column * pitch, y0 + row * pitch, 0))
    return holder


def gauge(name, radius, mat, needle, parent, location, rotation=(0, 0, 0),
          angle=30):
    """Round dial with a rim and a needle, facing +Z of its joint."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    cylinder(name + " Face", radius, 0.01, mat, holder, sides=16)
    torus(name + " Rim", radius, 0.008, material("Chrome", "#c8d0dc", 0.2, 1.0),
          holder, (0, 0, 0.01), segments=16, sides=4)
    box(name + " Needle", (0.006, radius * 0.8, 0.004), needle, holder,
        (0, radius * 0.35, 0.014), rotation=(0, 0, angle))
    return holder


# joints the game moves (see aliens.py and the props); the other empties
# only placed parts while modeling
ANIMATED = re.compile(r"^(Body|Leg[AB] \d+|Claw[LR]|Head|Tail \d+|Hover|Spin[+-]? .*|"
                      r"Pump \d+|Muzzle|Drum)$")


def merge_model():
    """Joins the meshes hanging from the same animated joint (or from the
    model's root) into one mesh, so the game draws a model in a few calls
    instead of one per button; the other empties go away. Run after
    bake_palette, when all meshes share the Palette and Glow materials."""
    bpy.context.view_layer.update()
    objects = list(bpy.data.objects)
    kept = [obj for obj in objects if obj.type == 'EMPTY' and ANIMATED.match(obj.name)]

    def holder(obj):
        parent = obj.parent
        while parent is not None and parent not in kept:
            parent = parent.parent
        return parent

    worlds = {obj: obj.matrix_world.copy() for obj in objects}
    groups = {}
    for obj in objects:
        if obj.type == 'MESH':
            groups.setdefault(holder(obj), []).append(obj)
    shared = [bpy.data.materials["Palette"], bpy.data.materials["Glow"]]

    for joint_obj in kept:
        parent = holder(joint_obj)
        joint_obj.parent = parent
        joint_obj.matrix_world = worlds[joint_obj]

    for target, meshes in groups.items():
        base = worlds[target].inverted() if target is not None else None
        bm = bmesh.new()
        for obj in meshes:
            data = obj.data.copy()
            data.transform(worlds[obj] if base is None else base @ worlds[obj])
            slots = [shared.index(mat) for mat in data.materials]
            for polygon in data.polygons:
                polygon.material_index = slots[polygon.material_index]
            bm.from_mesh(data)
            bpy.data.meshes.remove(data)
        name = (target.name if target is not None else "Model") + " Mesh"
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        used = {polygon.material_index for polygon in mesh.polygons}
        for mat in shared:
            mesh.materials.append(mat)
        if used == {1}:
            for polygon in mesh.polygons:
                polygon.material_index = 0
            mesh.materials.pop(index=0)
        elif used == {0}:
            mesh.materials.pop(index=1)
        new_object(name, mesh, target)

    for obj in objects:
        if obj not in kept and (obj.type == 'MESH' or obj.type == 'EMPTY'):
            bpy.data.objects.remove(obj)
