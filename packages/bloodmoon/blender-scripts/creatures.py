"""Builders of jointed creatures, which the game animates by turning their
joints, so their names matter:

    Body          everything else hangs from it; bobs while walking
    LegA <n>      hips swinging around X, half a step ahead of
    LegB <n>      these (alternating gait)
    ArmL, ArmR    shoulders of the striking arms; raised and swung down
                  (around X) in the attack, one after the other
    Head          nods into the attack
    Tail <n>      sways around Z, each segment a bit more
    WingL, WingR  flap around Y
    Hover         (instead of legs) the body floats and bobs

A creature stands on the origin facing -Y.
"""

import math

from shooter import (box, clear_scene, cylinder, joint, limb, material, mesh_from,
                     new_object, sphere, tube)


def skins(name, skin, dark, glow, roughness=0.6):
    """Clears the scene and returns the creature's skin, its darker second
    color and its glowing color (eyes and the like)."""
    clear_scene()
    return (material(name + " Skin", skin, roughness, 0.0),
            material(name + " Dark", dark, roughness, 0.1),
            material(name + " Glow", glow, emission=6.0))


def start(height):
    """The Body joint at height."""
    return joint("Body", location=(0, 0, height))


def blade(name, parent, length, width, mat, curl=0.35, location=(0, 0, 0),
          rotation=(0, 0, 0)):
    """Curved claw, horn or fang pointing down -Z from its joint, bending
    towards -Y."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    points = [(0, -curl * length * (t * t), -length * t) for t in
              (i / 6 for i in range(7))]
    tube(name + " Blade", points, lambda t: width * (1 - t) + 0.004, mat, holder,
         sides=5)
    return holder


def claws(count, length, mat, glow=None, spread=0.06, width=0.03):
    """A hand of claws, for arm()."""
    def build(name, hand):
        for index in range(count):
            offset = (index - (count - 1) / 2) * spread
            blade(f"{name} Talon {index}", hand, length, width,
                  glow if glow is not None and index == count // 2 else mat,
                  location=(offset, 0, 0), rotation=(0, offset * 120, 0))
    return build


def arm(body, side, shoulder, upper, fore, skin, dark, hand=None, thickness=0.06,
        elbow=-50, fist=None):
    """Arm on side (1 = +X) hanging from the shoulder point; hand(name,
    joint) adds what it holds or its claws. The joint is named ArmL or ArmR."""
    name = "ArmL" if side > 0 else "ArmR"
    shoulder_joint = joint(name, body, shoulder)
    shoulder_joint.rotation_euler = (math.radians(-25), 0, math.radians(-10 * side))
    sphere(name + " Shoulder", thickness * 1.5, dark, shoulder_joint)
    limb(name + " Upper", thickness, upper, skin, shoulder_joint, top=thickness * 0.8)
    elbow_joint = joint(name + " Elbow", shoulder_joint, (0, 0, -upper))
    elbow_joint.rotation_euler = (math.radians(elbow), 0, 0)
    sphere(name + " Elbow Knob", thickness * 1.1, dark, elbow_joint)
    limb(name + " Fore", thickness * 0.9, fore, skin, elbow_joint, top=thickness * 0.7)
    wrist = joint(name + " Hand", elbow_joint, (0, 0, -fore))
    sphere(name + " Palm", thickness * 1.1, fist or skin, wrist, scale=(1.2, 1, 1))
    if hand is not None:
        hand(name, wrist)
    return shoulder_joint


def biped_legs(body, hip_width, thigh, shin, skin, dark, thickness=0.08,
               digitigrade=False, foot=None, toes=True):
    """Two legs reaching from the hips (body's origin) to the ground."""
    for side, group in ((1, "LegA 0"), (-1, "LegB 0")):
        hip = joint(group, body, (side * hip_width, 0, 0))
        sphere(group + " Hip", thickness * 1.3, dark, hip)
        knee_bend = 40 if digitigrade else -12
        top = joint(group + " Thigh", hip)
        top.rotation_euler = (math.radians(-knee_bend / 2), 0, 0)
        limb(group + " Thigh Limb", thickness, thigh, skin, top, top=thickness * 0.75)
        knee = joint(group + " Knee", top, (0, 0, -thigh))
        knee.rotation_euler = (math.radians(knee_bend), 0, 0)
        limb(group + " Shin", thickness * 0.75, shin, foot or dark, knee, top=thickness * 0.5)
        ankle = joint(group + " Foot", knee, (0, 0, -shin))
        ankle.rotation_euler = (math.radians(-knee_bend / 2), 0, 0)
        if toes:
            for toe in (-1, 0, 1):
                blade(f"{group} Toe {toe}", ankle, thickness * 2.2, thickness * 0.35, dark,
                      curl=0.1, rotation=(-80, 0, 25 * toe))
        else:
            box(group + " Boot", (thickness * 2, thickness * 3.2, thickness * 1.2), foot or dark,
                ankle, (0, -thickness * 0.8, -thickness * 0.3), bevel=thickness * 0.2)


def quadruped_legs(body, length, width, height, skin, dark, thickness=0.07):
    """Four legs at the corners of a body length long, trotting (diagonal
    pairs together)."""
    for index, (x, y) in enumerate(((1, -1), (-1, -1), (1, 1), (-1, 1))):
        group = "LegA" if x * y < 0 else "LegB"
        hip = joint(f"{group} {index}", body, (x * width, y * length / 2, 0))
        sphere(f"{group} {index} Hip", thickness * 1.4, skin, hip)
        upper = joint(f"{group} {index} Upper", hip)
        upper.rotation_euler = (math.radians(15 * y), 0, 0)
        limb(f"{group} {index} Thigh", thickness, height * 0.55, skin, upper, top=thickness * 0.7)
        knee = joint(f"{group} {index} Knee", upper, (0, 0, -height * 0.55))
        knee.rotation_euler = (math.radians(-30 * y), 0, 0)
        limb(f"{group} {index} Shin", thickness * 0.7, height * 0.5, dark, knee, top=thickness * 0.5)
        sphere(f"{group} {index} Paw", thickness * 0.9, dark, knee, (0, -0.03, -height * 0.5),
               scale=(1, 1.4, 0.6))


def insect_legs(body, pairs, length, height, skin, dark, spread=0.25,
                thickness=0.04, reach=1.0):
    """Pairs of jointed legs fanning out to the sides, in a tripod gait."""
    for pair in range(pairs):
        y = (pair - (pairs - 1) / 2) * spread
        for side in (1, -1):
            group = "LegA" if (pair + (side > 0)) % 2 else "LegB"
            name = f"{group} {pair * 2 + (side > 0)}"
            hip = joint(name, body, (side * 0.12, y, 0))
            fan = math.radians((pair - (pairs - 1) / 2) * 25)
            hip.rotation_euler = (0, 0, -side * fan)
            up = joint(name + " Upper", hip)
            up.rotation_euler = (0, math.radians(-side * 125), 0)
            limb(name + " Femur", thickness, length * 0.45 * reach, dark, up,
                 top=thickness * 0.8)
            knee = joint(name + " Knee", up, (0, 0, -length * 0.45 * reach))
            sphere(name + " Knee Knob", thickness * 1.2, skin, knee)
            down = joint(name + " Down", knee)
            down.rotation_euler = (0, math.radians(side * 105), 0)
            limb(name + " Tibia", thickness * 0.8, height * 1.15, skin, down,
                 top=thickness * 0.2)


def tail(body, start_point, segments, length, radius, skin, dark, rise=0.0, tip=None):
    """Chain of Tail joints going back (+Y) from start_point; tip(joint, step)
    may add something to its end."""
    parent = joint("Tail 0", body, start_point)
    step = length / segments
    for index in range(segments):
        if index:
            parent = joint(f"Tail {index}", parent, (0, step, rise))
        r = radius * (1 - index / (segments + 1))
        sphere(f"Tail {index} Segment", r, dark if index % 2 else skin, parent,
               (0, step / 2, rise / 2), scale=(1, 1.4, 1))
    if tip is not None:
        tip(parent, step)
    return parent


def wings(body, location, span, skin, bone):
    """Two bat or dragon wings, WingL and WingR, spread to the sides."""
    for side in (1, -1):
        wing = joint("WingL" if side > 0 else "WingR", body, (side * location[0], location[1], location[2]))
        wing.rotation_euler = (0, math.radians(side * 15), 0)
        tube(f"Wing Bone {side}", [(0, 0, 0), (side * span * 0.5, 0.05, 0.25),
                                   (side * span, 0.15, 0.05)], 0.025, bone, wing)
        for index in range(3):
            tip = (side * span * (0.45 + 0.27 * index), 0.12 + 0.05 * index, -0.35 + 0.12 * index)
            tube(f"Wing Finger {side} {index}", [(side * span * 0.5, 0.05, 0.25), tip], 0.012, bone, wing)
        def membrane(bm, side=side):
            points = [(0, 0, 0), (side * span * 0.5, 0.05, 0.25), (side * span, 0.15, 0.05),
                      (side * span * 0.85, 0.2, -0.2), (side * span * 0.55, 0.15, -0.3),
                      (side * span * 0.3, 0.1, -0.2), (0, 0.05, -0.25)]
            bm.faces.new([bm.verts.new(p) for p in points])
        new_object(f"Wing Membrane {side}", mesh_from(f"Wing Membrane {side}", membrane), wing,
                   mat=skin)


def eyes(parent, count, radius, mat, location, spread):
    for index in range(count):
        x = (index - (count - 1) / 2) * spread
        sphere(f"Eye {index}", radius, mat, parent,
               (location[0] + x, location[1], location[2] - abs(x) * 0.3),
               subdivisions=1)


def spikes(parent, count, start_point, step, length, mat, tilt=30):
    for index in range(count):
        x, y, z = start_point
        cylinder(f"Spike {index}", length * 0.25, length, mat, parent,
                 (x, y + step[1] * index, z + step[2] * index), top=0.0, sides=5,
                 rotation=(tilt, 0, 0))


def horns(head, mat, width, length, curl=0.4, rise=60, location=(0, 0, 0.1)):
    for side in (1, -1):
        blade(f"Horn {side}", head, length, length * 0.18, mat, curl=curl,
              location=(side * width + location[0], location[1], location[2]),
              rotation=(180 - rise, side * 35, 0))


def held(name, build):
    """A hand holding a weapon: build(prefix, grip) models it with its grip at
    the origin and the weapon pointing down -Z (forward when the arm is up)."""
    def hand(arm_name, wrist):
        grip = joint(f"{arm_name} {name}", wrist)
        grip.rotation_euler = (math.radians(-90), 0, 0)
        build(f"{arm_name} {name}", grip)
    return hand
