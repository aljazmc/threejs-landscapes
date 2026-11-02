import random

import bpy

from shooter import (Sheet, clear_scene, color, emission_material, front_camera, glow, node,
                     setup_scene, sphere)

# The flamethrower's fire: 16 frames of 128x128 pixels (4 rows of 4) of one
# billow of burning fuel, for billboards about 1.5 m across that fly from
# the nozzle and grow. It starts as a small, white-blue hot jet, swells into
# a turbulent orange fireball (a Cycles volume) and cools into dark red
# flames and smoke, with sparks flying off.
SIZE = 128
FRAMES = 16
METERS = 1.6


def fire_material():
    mat = bpy.data.materials.new("Fire")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.remove(tree.nodes["Principled BSDF"])
    output = tree.nodes["Material Output"]
    coordinates = node(tree, "ShaderNodeTexCoord").outputs["Object"]
    turbulence = node(tree, "ShaderNodeTexNoise",
                      [("Vector", coordinates), ("Scale", 3.0), ("Detail", 8.0),
                       ("Roughness", 0.65), ("Distortion", 0.9)], noise_dimensions='4D')
    radius = node(tree, "ShaderNodeVectorMath", [(0, coordinates)],
                  operation='LENGTH').outputs["Value"]
    falloff = node(tree, "ShaderNodeMapRange", [("Value", radius), ("From Min", 0.3),
                                                ("From Max", 1.0), ("To Min", 1.0),
                                                ("To Max", 0.0)]).outputs["Result"]
    shape = node(tree, "ShaderNodeMath", [(0, turbulence.outputs["Fac"]), (1, falloff)],
                 operation='MULTIPLY').outputs[0]
    density = node(tree, "ShaderNodeMapRange", [("Value", shape), ("From Min", 0.1),
                                                ("From Max", 0.4), ("To Min", 0.0),
                                                ("To Max", 1.0)])
    density_scale = node(tree, "ShaderNodeMath", [(0, density.outputs["Result"]), (1, 30.0)],
                         operation='MULTIPLY')
    heat = node(tree, "ShaderNodeMath", [(0, shape), (1, 1.0)], operation='MULTIPLY')
    ramp = node(tree, "ShaderNodeValToRGB", [("Fac", heat.outputs[0])])
    elements = ramp.color_ramp.elements
    elements[0].position = 0.2
    elements[0].color = color("#1a0604")
    elements[1].position = 0.8
    elements[1].color = color("#fff8e0")
    for position, hex_color in ((0.35, "#a01a04"), (0.5, "#ff6a10"), (0.65, "#ffb030")):
        element = elements.new(position)
        element.color = color(hex_color)
    volume = node(tree, "ShaderNodeVolumePrincipled",
                  [("Density", density_scale.outputs[0]), ("Color", color("#2a2220")),
                   ("Emission Color", ramp.outputs["Color"])])
    tree.links.new(volume.outputs[0], output.inputs["Volume"])
    mat["turbulence"] = turbulence.name
    mat["heat"] = heat.name
    mat["volume"] = volume.name
    return mat


def fire():
    clear_scene()
    scene = setup_scene(samples=24)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
    scene.cycles.volume_step_rate = 1.0
    front_camera(SIZE, SIZE, SIZE / METERS, location=(0, -20, 0))

    mat = fire_material()
    rng = random.Random(8)
    balls = []
    for index in range(5):
        ball = sphere(f"Billow {index}", 0.35, None, subdivisions=3)
        ball.data.materials.append(mat)
        offset = (0, 0, 0) if index == 0 else (rng.uniform(-0.25, 0.25), rng.uniform(-0.15, 0.15),
                                               rng.uniform(-0.2, 0.25))
        balls.append((ball, offset, 1.0 if index == 0 else rng.uniform(0.55, 0.8)))
    core = sphere("Jet", 0.12, emission_material("Jet", "#d8e8ff", 20.0), scale=(1, 1, 1.4))
    spark_mat = emission_material("Spark", "#ffd080", 12.0)
    sparks = []
    for index in range(10):
        direction = (rng.uniform(-1, 1), 0, rng.uniform(-0.6, 1))
        spark = sphere(f"Spark {index}", 0.015, spark_mat)
        sparks.append((spark, direction, rng.uniform(0.3, 0.6)))
    tree = mat.node_tree
    turbulence = tree.nodes[mat["turbulence"]]
    heat = tree.nodes[mat["heat"]]
    volume = tree.nodes[mat["volume"]]

    def frame(index):
        t = index / (FRAMES - 1)

        def pose():
            grow = 0.45 + 1.5 * t ** 0.6
            for ball, offset, size in balls:
                scale = grow * size
                ball.scale = (scale, scale, scale * (1 + 0.3 * t))
                ball.location = (offset[0] * grow, offset[1] * grow, offset[2] * grow + 0.25 * t)
            core.hide_render = t > 0.2
            core.scale = [0.8 + 2 * t] * 3
            turbulence.inputs["W"].default_value = t * 2.0
            heat.inputs[1].default_value = 1.5 * (1 - t) ** 0.8 + 0.45
            volume.inputs["Emission Strength"].default_value = 9 * (1 - t) ** 1.3 + 0.3
            for spark, direction, speed in sparks:
                distance = 0.2 + speed * t
                spark.location = (direction[0] * distance, -0.3, direction[2] * distance + 0.2 * t)
                spark.hide_render = t > 0.75
        return pose

    rows = [[frame(row * 4 + column) for column in range(4)] for row in range(4)]
    return Sheet(SIZE, SIZE, rows,
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=4, strength=0.9))
