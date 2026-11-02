"""Shared Blender helpers: scene, materials, primitives, flat front views,
sprite sheet rendering, a glow filter for the images and the clean-up of
the models before their glTF export.

Models are built with Blender's axes: Z up, a meter is a meter, standing on
the origin and facing -Y. The glTF export turns them to its Y up axes,
where they face +Z.
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

# joints the game moves (see the creatures and props); the other empties
# only placed parts while modeling
ANIMATED = re.compile(r"^(Body|Leg[AB] \d+|Leg[AB] \d+ (Knee|Down)|Arm[LR]|Arm[LR] Elbow|Head|Tail \d+|Wing[LR]|Hover|"
                      r"Spin[+-]? .*|Pump \d+|Flame \d+|Muzzle|Nock|Arrow|Drum)$")


def merge_model():
    """Joins the meshes hanging from the same animated joint (or from the
    model's root) into one mesh with their materials, so the game draws a
    model in a few calls instead of one per part; the other empties go away."""
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

    for joint_obj in kept:
        joint_obj.parent = holder(joint_obj)
        joint_obj.matrix_world = worlds[joint_obj]

    for target, meshes in groups.items():
        base = worlds[target].inverted() if target is not None else None
        materials = []
        bm = bmesh.new()
        for obj in meshes:
            data = obj.data.copy()
            data.transform(worlds[obj] if base is None else base @ worlds[obj])
            slots = []
            for mat in data.materials:
                if mat not in materials:
                    materials.append(mat)
                slots.append(materials.index(mat))
            for polygon in data.polygons:
                polygon.material_index = slots[polygon.material_index] if slots else 0
            bm.from_mesh(data)
            bpy.data.meshes.remove(data)
        name = (target.name if target is not None else "Model") + " Mesh"
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        for mat in materials:
            mesh.materials.append(mat)
        new_object(name, mesh, target)

    for obj in objects:
        if obj not in kept and obj.type in ('MESH', 'EMPTY'):
            bpy.data.objects.remove(obj)
