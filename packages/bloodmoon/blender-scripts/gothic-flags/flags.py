import math

import bpy
import numpy

from shooter import Sheet, clear_scene, new_object, node, setup_scene

# Sprite sheet of 60x40 language flags in one row: English (Union Jack),
# Deutsch, Polski, Slovenščina, as cloth waving to the right, seen from the
# front. The patterns are painted with numpy into the cloth's texture.
WIDTH = 60
HEIGHT = 40
PIXELS_PER_METER = 100
FLAG_W, FLAG_H = 0.5, 0.3
TEXTURE_W, TEXTURE_H = 500, 300


def hex_rgb(hex_color):
    return numpy.array([int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def paint(draw):
    """RGB pattern, rows top down; draw(fill) gets fill(mask, color) and the
    pixel grid as flag coordinates u, v from 0 to 1."""
    v, u = numpy.mgrid[0:TEXTURE_H, 0:TEXTURE_W].astype(numpy.float64)
    u = (u + 0.5) / TEXTURE_W
    v = (v + 0.5) / TEXTURE_H
    pixels = numpy.zeros((TEXTURE_H, TEXTURE_W, 3))

    def fill(mask, hex_color):
        pixels[mask] = hex_rgb(hex_color)
    draw(fill, u, v)
    return pixels


def english(fill, u, v):
    # diagonals in a 2:1 space, so they keep the Union Jack angle
    x, y = u * 2, v
    fill(numpy.ones_like(u, dtype=bool), "#012169")
    for distance in (numpy.abs(x - 2 * y) / math.sqrt(5),
                     numpy.abs(x + 2 * y - 2) / math.sqrt(5)):
        fill(distance < 0.1, "#ffffff")
        fill(distance < 0.035, "#c8102e")
    fill((numpy.abs(u - 0.5) < 0.1) | (numpy.abs(v - 0.5) < 0.167), "#ffffff")
    fill((numpy.abs(u - 0.5) < 0.06) | (numpy.abs(v - 0.5) < 0.1), "#c8102e")


def deutsch(fill, u, v):
    for index, hex_color in enumerate(("#202020", "#dd0000", "#ffce00")):
        fill((v >= index / 3) & (v < (index + 1) / 3), hex_color)


def polski(fill, u, v):
    fill(v < 0.5, "#ffffff")
    fill(v >= 0.5, "#dc143c")


def slovenscina(fill, u, v):
    for index, hex_color in enumerate(("#ffffff", "#0b4ea2", "#ed1c24")):
        fill((v >= index / 3) & (v < (index + 1) / 3), hex_color)
    # the coat of arms: Triglav under three stars, over two waves, in a
    # shield that is square on top and pointed at the bottom
    cx, top, half, height = 0.27, 0.17, 0.09, 0.42
    sx = (u - cx) / half
    sy = (v - top) / height
    curve = numpy.where(sy < 0.45, 1.0,
                        numpy.sqrt(numpy.clip(1 - ((sy - 0.45) / 0.55) ** 2, 0, 1)))
    fill((sy >= 0) & (sy <= 1) & (numpy.abs(sx) <= curve), "#ed1c24")
    inner = (sy >= 0.05) & (sy <= 0.93) & (numpy.abs(sx) <= curve - 0.2)
    fill(inner, "#0b4ea2")
    # the middle peak and a lower one on each side
    ridge = numpy.interp(numpy.abs(sx), [0, 0.27, 0.5, 1], [0.36, 0.58, 0.52, 0.72])
    fill(inner & (sy > ridge) & (sy < 0.86), "#ffffff")
    for row in (0.74, 0.81):
        fill(inner & (numpy.abs(sy - row - 0.015 * numpy.sin(sx * 12)) < 0.018),
             "#0b4ea2")
    for x, y in ((-0.4, 0.15), (0.4, 0.15), (0.0, 0.27)):
        dx, dy = (sx - x) * half * FLAG_W / FLAG_H, (sy - y) * height
        angle = numpy.arctan2(dy, dx)
        radius = 0.03 * (0.6 + 0.4 * numpy.abs(numpy.cos(3 * angle)))
        fill(inner & (numpy.hypot(dx, dy) < radius), "#ffce00")


LANGUAGES = [english, deutsch, polski, slovenscina]


def cloth_material(index, draw):
    pixels = paint(draw)
    image = bpy.data.images.new(f"Flag{index}", TEXTURE_W, TEXTURE_H, alpha=True)
    rgba = numpy.concatenate([pixels, numpy.ones((TEXTURE_H, TEXTURE_W, 1))], axis=2)
    image.pixels.foreach_set(rgba[::-1].astype(numpy.float32).ravel())
    image.pack()

    mat = bpy.data.materials.new(f"Flag{index}")
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    texture = node(tree, "ShaderNodeTexImage", image=image, interpolation='Cubic')
    tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Sheen Weight"].default_value = 0.4
    return mat


def backing(name, mesh):
    """Dark rim around the cloth: a copy a little larger, just behind it."""
    mat = bpy.data.materials.get("Rim") or bpy.data.materials.new("Rim")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.012, 0.012, 0.02, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    rim = new_object(name, mesh.copy(), location=(0, 0.02, 0),
                     scale=(1 + 0.03 / FLAG_W, 1, 1 + 0.03 / FLAG_H))
    rim.data.materials.clear()
    rim.data.materials.append(mat)
    return rim


def cloth(index, draw):
    """Grid in the XZ plane, the hoist at the left, waving in Y (towards
    and away from the camera) more and more towards the fly."""
    columns, rows = 48, 16
    vertices, faces, uvs = [], [], []
    for row in range(rows + 1):
        for column in range(columns + 1):
            u, v = column / columns, row / rows
            wave = math.sin(u * 2.4 * math.pi - 0.6) * (0.25 + 0.75 * u)
            x = (u - 0.5) * FLAG_W
            z = (0.5 - v) * FLAG_H + 0.022 * wave - 0.02 * u * v
            vertices.append((x, 0.06 * math.cos(u * 2.4 * math.pi - 0.6) * u, z))
    for row in range(rows):
        for column in range(columns):
            a = row * (columns + 1) + column
            faces.append((a, a + columns + 1, a + columns + 2, a + 1))
            for r, c in ((row, column), (row + 1, column), (row + 1, column + 1),
                         (row, column + 1)):
                uvs.append((c / columns, 1 - r / rows))
    mesh = bpy.data.meshes.new(f"Flag{index}")
    mesh.from_pydata(vertices, [], faces)
    layer = mesh.uv_layers.new()
    layer.data.foreach_set("uv", [value for uv in uvs for value in uv])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    flag = new_object(f"Flag{index}", mesh, mat=cloth_material(index, draw))
    backing(f"Rim{index}", mesh).parent = flag
    return flag


def flags():
    clear_scene()
    scene = setup_scene(samples=96)
    camera = new_object("Camera", bpy.data.cameras.new("Camera"),
                        location=(0, -10, 0), rotation=(90, 0, 0))
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = WIDTH / PIXELS_PER_METER
    scene.camera = camera
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
    sun = bpy.data.objects["Sun"]
    sun.data.energy = 4.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(-55))

    cloths = [cloth(index, draw) for index, draw in enumerate(LANGUAGES)]

    def show(shown):
        def pose():
            for obj in cloths:
                for part in [obj] + list(obj.children):
                    part.hide_render = obj is not shown
        return pose

    return Sheet(WIDTH, HEIGHT, [[show(obj) for obj in cloths]])
