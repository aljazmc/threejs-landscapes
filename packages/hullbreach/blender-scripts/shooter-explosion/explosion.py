import math
import random

import bpy

from shooter import (Sheet, box, clear_scene, color, emission_material, front_camera,
                     glow, material, node, sphere, setup_scene, torus)

# The grenade's explosion: 16 frames of 128x128 pixels (4 rows of 4) for a
# billboard 6 m across. A white flash, then a cluster of turbulent fireballs
# (Cycles volumes) swelling orange and rolling up into dark smoke, while
# sparks and debris fly out and a shockwave ring races along the floor.
SIZE = 128
FRAMES = 16
METERS = 6.0


def fireball_material():
    mat = bpy.data.materials.new("Fireball")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.remove(tree.nodes["Principled BSDF"])
    output = tree.nodes["Material Output"]
    coordinates = node(tree, "ShaderNodeTexCoord").outputs["Object"]
    turbulence = node(tree, "ShaderNodeTexNoise",
                      [("Vector", coordinates), ("Scale", 1.7), ("Detail", 10.0),
                       ("Roughness", 0.65), ("Distortion", 0.4)], noise_dimensions='4D')
    radius = node(tree, "ShaderNodeVectorMath", [(0, coordinates)],
                  operation='LENGTH').outputs["Value"]
    falloff = node(tree, "ShaderNodeMapRange", [("Value", radius), ("From Min", 0.35),
                                                ("From Max", 1.0), ("To Min", 1.0),
                                                ("To Max", 0.0)]).outputs["Result"]
    shape = node(tree, "ShaderNodeMath", [(0, turbulence.outputs["Fac"]), (1, falloff)],
                 operation='MULTIPLY').outputs[0]
    density = node(tree, "ShaderNodeMapRange", [("Value", shape), ("From Min", 0.12),
                                                ("From Max", 0.4), ("To Min", 0.0),
                                                ("To Max", 1.0)])
    density_scale = node(tree, "ShaderNodeMath", [(0, density.outputs["Result"]), (1, 30.0)],
                         operation='MULTIPLY')
    heat = node(tree, "ShaderNodeMath", [(0, shape), (1, 1.0)], operation='MULTIPLY')
    ramp = node(tree, "ShaderNodeValToRGB", [("Fac", heat.outputs[0])])
    elements = ramp.color_ramp.elements
    elements[0].position = 0.2
    elements[0].color = color("#200806")
    elements[1].position = 0.75
    elements[1].color = color("#fff4c0")
    for position, hex_color in ((0.35, "#c02a08"), (0.5, "#ff7a14"), (0.62, "#ffc23a")):
        element = elements.new(position)
        element.color = color(hex_color)
    volume = node(tree, "ShaderNodeVolumePrincipled",
                  [("Density", density_scale.outputs[0]), ("Color", color("#2a2420")),
                   ("Emission Color", ramp.outputs["Color"])])
    tree.links.new(volume.outputs[0], output.inputs["Volume"])
    mat["turbulence"] = turbulence.name
    mat["heat"] = heat.name
    mat["volume"] = volume.name
    return mat


def explosion():
    clear_scene()
    scene = setup_scene(samples=24)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
    scene.cycles.volume_step_rate = 1.0
    front_camera(SIZE, SIZE, SIZE / METERS, location=(0, -20, 0))

    mat = fireball_material()
    rng = random.Random(5)
    balls = []
    for index in range(7):
        ball = sphere(f"Fireball {index}", 1.0, None, subdivisions=3)
        ball.data.materials.append(mat)
        offset = (0, 0, 0) if index == 0 else (rng.uniform(-0.55, 0.55),
                                               rng.uniform(-0.3, 0.3),
                                               rng.uniform(-0.3, 0.6))
        balls.append((ball, offset, 1.0 if index == 0 else rng.uniform(0.5, 0.75),
                      rng.uniform(0.8, 1.3)))
    flash = sphere("Flash", 1.0, emission_material("Flash", "#fffbe8", 30.0), subdivisions=2)
    tree = mat.node_tree
    turbulence = tree.nodes[mat["turbulence"]]
    heat = tree.nodes[mat["heat"]]
    volume = tree.nodes[mat["volume"]]

    spark_mat = emission_material("Spark", "#ffd890", 12.0)
    sparks = []
    for index in range(26):
        direction = (rng.uniform(-1, 1), rng.uniform(-0.6, 0.2), rng.uniform(-0.7, 1))
        length = math.sqrt(sum(c * c for c in direction))
        direction = tuple(c / length for c in direction)
        spark = sphere(f"Spark {index}", 0.05, spark_mat, scale=(1, 1, 3.5))
        spark.rotation_euler = (0, math.atan2(direction[0], direction[2]), 0)
        sparks.append((spark, direction, rng.uniform(1.6, 2.8)))
    debris_mat = material("Debris", "#1a1614", 0.8, 0.3)
    debris = []
    for index in range(10):
        direction = (rng.uniform(-1, 1), rng.uniform(-0.5, 0.5), rng.uniform(0.1, 1))
        chunk = box(f"Debris {index}", (0.12, 0.08, 0.1), debris_mat,
                    rotation=(rng.uniform(0, 90), rng.uniform(0, 90), 0))
        debris.append((chunk, direction, rng.uniform(2.0, 3.0)))
    ring_mat = emission_material("Shockwave", "#bff0ff", 6.0)
    ring = torus("Shockwave", 1.0, 0.05, ring_mat, rotation=(10, 0, 0), segments=48, sides=6)

    def frame(index):
        t = index / (FRAMES - 1)

        def pose():
            grow = 0.4 + 1.5 * (1 - (1 - t) ** 2.5)
            for ball, offset, size, speed in balls:
                # each ball swells with its own speed; the hot cloud rises
                scale = grow * size * min(1.0, 0.4 + t * 3 * speed)
                ball.scale = (scale, scale, scale * (1 + 0.2 * t))
                ball.location = tuple(c * grow * 0.9 for c in offset)
                ball.location.z += 0.4 * t
            flash.scale = [0.6 * (1 + 3 * t)] * 3
            flash.hide_render = index > 1
            for chunk, direction, speed in debris:
                distance = speed * t ** 0.7
                chunk.location = (direction[0] * distance, direction[1] * distance,
                                  direction[2] * distance - 2.5 * t * t)
                chunk.rotation_euler.x = 6 * t
                chunk.hide_render = t > 0.8
            turbulence.inputs["W"].default_value = t * 1.5
            # heat: white hot at first, then cooling to embers and smoke
            heat.inputs[1].default_value = 2.6 * (1 - t) ** 0.9 + 0.3
            volume.inputs["Emission Strength"].default_value = 24 * (1 - t) ** 1.5 + 0.2
            volume.inputs["Density"].default_value = 0
            for spark, direction, speed in sparks:
                distance = 0.3 + speed * t ** 0.6
                spark.location = tuple(c * distance for c in direction)
                spark.hide_render = t > 0.65
            radius = 0.5 + 4.0 * t ** 0.7
            ring.scale = (radius, radius, radius)
            ring.location = (0, 0, -0.6)
            ring.hide_render = t > 0.55
            ring_mat.node_tree.nodes["Emission"].inputs["Strength"].default_value = \
                6.0 * (1 - t / 0.55)
        return pose

    rows = [[frame(row * 4 + column) for column in range(4)] for row in range(4)]
    return Sheet(SIZE, SIZE, rows,
                 post=lambda canvas: glow(canvas, SIZE, SIZE, radius=4, strength=0.9))
