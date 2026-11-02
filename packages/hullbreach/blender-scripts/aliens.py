"""Builders for the ten alien species, each exported as a model by its own
project (blender-scripts/shooter-<species>).

An alien stands on the origin facing -Y. Its parts hang from empties
("joints") which the game turns to animate it, so their names matter:

    Body          everything else hangs from it; bobs while walking
    LegA <n>      hips swinging around X, half a step ahead of
    LegB <n>      these (alternating gait)
    Leg<A|B> <n> Knee
                  bends further to lift the foot as the leg swings forward
    Leg<A|B> <n> Down
                  (insect legs, below the knee) straightens to lift the foot
    ClawL, ClawR  shoulders of the clawed arms; raised and slashed down
                  (around X) in the attack, one after the other
    Claw<L|R> Elbow
                  cocks in the wind-up and straightens in the blow
    Head          nods into the attack
    Tail <n>      sways around Z, each segment a bit more
    Hover         (instead of legs) the body floats and bobs

The exported model keeps exactly these joints (shooter.py's ANIMATED);
the meshes hanging from each are merged into one.

Colors: a glossy skin, a darker chitin and one glowing color (eyes, veins)
per species, in the neon spirit of the ship.
"""

import math

from shooter import (box, clear_scene, cylinder, joint, limb, material, sphere,
                     tube)


def skins(name, skin, chitin, glow):
    """Clears the scene and returns the species' materials."""
    clear_scene()
    return (material(name + " Skin", skin, 0.3, 0.1),
            material(name + " Chitin", chitin, 0.45, 0.2),
            material(name + " Glow", glow, emission=6.0))


def start(height):
    """The Body joint at height."""
    return joint("Body", location=(0, 0, height))


def blade(name, parent, length, width, mat, curl=0.35, location=(0, 0, 0),
          rotation=(0, 0, 0)):
    """Curved claw pointing down -Z from its joint, bending towards -Y."""
    holder = joint(name, parent, location)
    holder.rotation_euler = [math.radians(a) for a in rotation]
    points = [(0, -curl * length * (t * t), -length * t) for t in
              (i / 6 for i in range(7))]
    tube(name + " Blade", points, lambda t: width * (1 - t) + 0.004, mat, holder,
         sides=5)
    return holder


def claw_arm(body, side, shoulder, upper, fore, claws, claw_length, skin, chitin,
             glow, thickness=0.06, elbow=-50, spread=0.06):
    """Arm on side (1 = +X) hanging from the shoulder point with a hand of
    claws; the joint is named ClawL or ClawR."""
    name = "ClawL" if side > 0 else "ClawR"
    arm = joint(name, body, shoulder)
    arm.rotation_euler = (math.radians(-25), 0, math.radians(-10 * side))
    sphere(name + " Shoulder", thickness * 1.5, chitin, arm)
    limb(name + " Upper", thickness, upper, skin, arm, top=thickness * 0.8)
    elbow_joint = joint(name + " Elbow", arm, (0, 0, -upper))
    elbow_joint.rotation_euler = (math.radians(elbow), 0, 0)
    sphere(name + " Elbow Knob", thickness * 1.1, chitin, elbow_joint)
    limb(name + " Fore", thickness * 0.9, fore, chitin, elbow_joint, top=thickness * 0.7)
    hand = joint(name + " Hand", elbow_joint, (0, 0, -fore))
    sphere(name + " Palm", thickness * 1.1, skin, hand, scale=(1.2, 1, 1))
    for index in range(claws):
        offset = (index - (claws - 1) / 2) * spread
        blade(f"{name} Talon {index}", hand, claw_length, thickness * 0.5,
              glow if index == claws // 2 else chitin, location=(offset, 0, 0),
              rotation=(0, offset * 120, 0))
    return arm


def biped_legs(body, hip_width, thigh, shin, skin, chitin, thickness=0.08,
               digitigrade=False):
    """Two legs reaching from the hips (body's origin) to the ground."""
    for side, group in ((1, "LegA 0"), (-1, "LegB 0")):
        hip = joint(group, body, (side * hip_width, 0, 0))
        sphere(group + " Hip", thickness * 1.3, chitin, hip)
        knee_bend = 40 if digitigrade else -12
        top = joint(group + " Thigh", hip)
        top.rotation_euler = (math.radians(-knee_bend / 2), 0, 0)
        limb(group + " Thigh Limb", thickness, thigh, skin, top, top=thickness * 0.75)
        knee = joint(group + " Knee", top, (0, 0, -thigh))
        knee.rotation_euler = (math.radians(knee_bend), 0, 0)
        limb(group + " Shin", thickness * 0.75, shin, chitin, knee, top=thickness * 0.5)
        foot = joint(group + " Foot", knee, (0, 0, -shin))
        foot.rotation_euler = (math.radians(-knee_bend / 2), 0, 0)
        for toe in (-1, 0, 1):
            blade(f"{group} Toe {toe}", foot, thickness * 2.2, thickness * 0.35, chitin,
                  curl=0.1, rotation=(-80, 0, 25 * toe))


def insect_legs(body, pairs, length, height, skin, chitin, spread=0.25,
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
            # upper segment rising outwards, then a long one down to the floor
            up = joint(name + " Upper", hip)
            up.rotation_euler = (0, math.radians(-side * 125), 0)
            limb(name + " Femur", thickness, length * 0.45 * reach, chitin, up,
                 top=thickness * 0.8)
            knee = joint(name + " Knee", up, (0, 0, -length * 0.45 * reach))
            sphere(name + " Knee Knob", thickness * 1.2, skin, knee)
            down = joint(name + " Down", knee)
            down.rotation_euler = (0, math.radians(side * 105), 0)
            limb(name + " Tibia", thickness * 0.8, height * 1.15, skin, down,
                 top=thickness * 0.2)


def tail(body, start_point, segments, length, radius, skin, chitin, glow,
         rise=0.0, sting=None):
    """Chain of Tail joints going back (+Y) from start_point."""
    parent = joint("Tail 0", body, start_point)
    step = length / segments
    for index in range(segments):
        if index:
            parent = joint(f"Tail {index}", parent, (0, step, rise))
        r = radius * (1 - index / (segments + 1))
        sphere(f"Tail {index} Segment", r, chitin if index % 2 else skin, parent,
               (0, step / 2, rise / 2), scale=(1, 1.4, 1))
    if sting:
        sphere("Tail Bulb", radius * 0.9, glow, parent, (0, step, rise))
        blade("Sting", parent, sting, radius * 0.4, chitin, curl=-0.5,
              location=(0, step * 1.3, rise + radius * 0.5), rotation=(-150, 0, 0))
    return parent


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


# --- the ten species ---------------------------------------------------------

def stalker():
    """Tall, thin biped with a long smooth skull and long scythe claws."""
    skin, chitin, glow = skins("Stalker", "#2a2236", "#120f1a", "#36f0ff")
    body = start(1.05)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(18), 0, 0)
    cylinder("Pelvis", 0.15, 0.18, chitin, torso, (0, 0, -0.05), top=0.12)
    cylinder("Ribs", 0.13, 0.55, skin, torso, (0, 0, 0.1), top=0.2, scale=(1, 0.7, 1))
    for index in range(4):
        box(f"Rib {index}", (0.36, 0.05, 0.03), chitin, torso, (0, -0.1, 0.25 + 0.09 * index))
    spikes(torso, 4, (0, 0.14, 0.4), (0, 0.02, 0.1), 0.18, chitin, tilt=-40)
    head = joint("Head", torso, (0, -0.05, 0.75))
    sphere("Skull", 0.15, chitin, head, (0, 0.18, 0.08), scale=(0.8, 2.0, 0.85))
    sphere("Jaw", 0.1, skin, head, (0, -0.1, -0.02), scale=(0.8, 1.2, 0.6))
    eyes(head, 2, 0.03, glow, (0, -0.15, 0.06), 0.1)
    for side in (1, -1):
        claw_arm(torso, side, (side * 0.22, -0.02, 0.58), 0.38, 0.36, 3, 0.32,
                 skin, chitin, glow, thickness=0.045)
    biped_legs(body, 0.11, 0.5, 0.52, skin, chitin, thickness=0.06, digitigrade=True)
    tail(body, (0, 0.12, -0.05), 6, 1.0, 0.07, skin, chitin, glow, rise=-0.03)


def brute():
    """Hulking armored biped with massive arms and three heavy claws each."""
    skin, chitin, glow = skins("Brute", "#5a2a1e", "#2a1410", "#ff8a1a")
    body = start(0.95)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(22), 0, 0)
    sphere("Belly", 0.36, skin, torso, (0, 0, 0.3), scale=(1.1, 0.9, 1.0))
    sphere("Chest", 0.42, chitin, torso, (0, 0.02, 0.7), scale=(1.3, 0.9, 0.8))
    for index in range(3):
        box(f"Plate {index}", (0.5 - 0.08 * index, 0.1, 0.12), chitin, torso,
            (0, 0.32, 0.45 + 0.18 * index), rotation=(-15, 0, 0), bevel=0.03)
    spikes(torso, 3, (0, 0.3, 0.8), (0, 0.05, 0.12), 0.25, glow, tilt=-35)
    head = joint("Head", torso, (0, -0.25, 0.95))
    sphere("Skull", 0.18, chitin, head, scale=(1.1, 1.0, 0.8))
    for side in (1, -1):
        cylinder("Horn", 0.05, 0.25, skin, head, (side * 0.15, -0.02, 0.08), top=0.0,
                 rotation=(-30, side * 40, 0), sides=6)
    box("Maw", (0.2, 0.05, 0.06), glow, head, (0, -0.17, -0.06))
    eyes(head, 2, 0.035, glow, (0, -0.15, 0.05), 0.14)
    for side in (1, -1):
        claw_arm(torso, side, (side * 0.52, -0.05, 0.75), 0.42, 0.42, 3, 0.26,
                 skin, chitin, glow, thickness=0.11, spread=0.08)
    biped_legs(body, 0.24, 0.45, 0.45, skin, chitin, thickness=0.13)


def crawler():
    """Low six-legged bug with mandibles and two raptorial claws in front."""
    skin, chitin, glow = skins("Crawler", "#3b5a1e", "#1c2a0e", "#e8ff2a")
    body = start(0.55)
    sphere("Thorax", 0.3, chitin, body, scale=(0.9, 1.2, 0.6))
    sphere("Abdomen", 0.38, skin, body, (0, 0.55, 0.05), scale=(0.9, 1.3, 0.7))
    for index in range(4):
        box(f"Stripe {index}", (0.5, 0.04, 0.02), glow, body, (0, 0.35 + 0.13 * index, 0.3))
    insect_legs(body, 3, 0.9, 0.55, skin, chitin, spread=0.3)
    head = joint("Head", body, (0, -0.38, 0.05))
    sphere("Skull", 0.18, chitin, head, scale=(1.0, 1.0, 0.8))
    eyes(head, 4, 0.025, glow, (0, -0.15, 0.06), 0.06)
    for side in (1, -1):
        blade(f"Mandible {side}", head, 0.18, 0.03, skin, curl=0.6,
              location=(side * 0.08, -0.12, -0.05), rotation=(-80, 0, side * 30))
        claw_arm(body, side, (side * 0.2, -0.3, 0.1), 0.3, 0.3, 2, 0.25, skin, chitin,
                 glow, thickness=0.04, elbow=-80)


def mantis():
    """Upright four-legged mantis with two great scythe arms."""
    skin, chitin, glow = skins("Mantis", "#5ac83a", "#245a1a", "#ff3ad0")
    body = start(0.8)
    sphere("Abdomen", 0.25, skin, body, (0, 0.35, 0.0), scale=(0.8, 1.8, 0.7))
    torso = joint("Torso", body, (0, -0.1, 0.05))
    torso.rotation_euler = (math.radians(30), 0, 0)
    cylinder("Prothorax", 0.1, 0.7, chitin, torso, top=0.08)
    head = joint("Head", torso, (0, 0, 0.75))
    sphere("Skull", 0.14, skin, head, scale=(1.4, 0.8, 0.9))
    for side in (1, -1):
        sphere("Compound Eye", 0.07, glow, head, (side * 0.17, -0.02, 0.03))
        cylinder("Antenna", 0.008, 0.4, chitin, head, (side * 0.04, -0.05, 0.08),
                 rotation=(-30, side * 25, 0), sides=4, top=0.002)
        claw_arm(torso, side, (side * 0.12, -0.05, 0.6), 0.4, 0.4, 1, 0.5, skin, chitin,
                 glow, thickness=0.05, elbow=-110)
    insect_legs(body, 2, 1.0, 0.8, skin, chitin, spread=0.5, thickness=0.035)
    for side in (1, -1):
        box("Wing", (0.25, 0.7, 0.01), material("Mantis Wing", "#9affc8", 0.2, 0.0),
            body, (side * 0.12, 0.35, 0.18), rotation=(0, side * 15, 0))


def arachnid():
    """Eight-legged spider with two clawed forelimbs and a glowing back."""
    skin, chitin, glow = skins("Arachnid", "#1a1418", "#0a0808", "#ff2a3a")
    body = start(0.7)
    sphere("Cephalothorax", 0.3, chitin, body, scale=(1.0, 1.1, 0.7))
    sphere("Abdomen", 0.45, skin, body, (0, 0.6, 0.15), scale=(1.0, 1.2, 0.85))
    sphere("Hourglass", 0.12, glow, body, (0, 0.6, 0.53), scale=(1.0, 1.4, 0.3))
    insect_legs(body, 4, 1.1, 0.7, skin, chitin, spread=0.18, thickness=0.04)
    head = joint("Head", body, (0, -0.32, 0.05))
    eyes(head, 4, 0.03, glow, (0, -0.02, 0.12), 0.07)
    eyes(head, 2, 0.045, glow, (0, -0.06, 0.05), 0.12)
    for side in (1, -1):
        claw_arm(body, side, (side * 0.18, -0.3, 0.05), 0.32, 0.32, 2, 0.22, skin, chitin,
                 glow, thickness=0.04, elbow=-70)


def raptor():
    """Fast leaning biped with a long tail and small sickle claws."""
    skin, chitin, glow = skins("Raptor", "#1e5a6a", "#0e2a32", "#ffe23a")
    body = start(0.85)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(60), 0, 0)
    sphere("Chest", 0.25, skin, torso, (0, 0, 0.3), scale=(0.9, 0.8, 1.6))
    spikes(torso, 5, (0, 0.2, 0.0), (0, 0.0, 0.14), 0.15, glow, tilt=-60)
    head = joint("Head", torso, (0, -0.05, 0.75))
    head.rotation_euler = (math.radians(-55), 0, 0)
    sphere("Skull", 0.13, chitin, head, (0, -0.1, 0), scale=(0.8, 1.8, 0.8))
    box("Teeth", (0.1, 0.25, 0.03), material("Teeth", "#e8e0c8", 0.4), head,
        (0, -0.2, -0.07))
    eyes(head, 2, 0.025, glow, (0, -0.15, 0.06), 0.14)
    for side in (1, -1):
        claw_arm(torso, side, (side * 0.18, -0.15, 0.5), 0.22, 0.22, 3, 0.18, skin,
                 chitin, glow, thickness=0.04)
    biped_legs(body, 0.15, 0.45, 0.48, skin, chitin, thickness=0.08, digitigrade=True)
    tail(body, (0, 0.2, 0.05), 8, 1.4, 0.13, skin, chitin, glow, rise=0.02)


def squid():
    """Floating cephalopod: a glowing mantle and tentacles, two of them
    ending in hooked claws."""
    skin, chitin, glow = skins("Squid", "#8a2a7a", "#3a0e36", "#3affea")
    body = start(1.2)
    joint("Hover", body)
    sphere("Mantle", 0.35, skin, body, (0, 0.1, 0.35), scale=(0.9, 1.0, 1.6),
           rotation=(-20, 0, 0))
    for index in range(5):
        sphere(f"Spot {index}", 0.05, glow, body,
               (0.25 * math.cos(index * 1.3), 0.1 + 0.2 * math.sin(index * 1.3),
                0.25 + 0.15 * index), subdivisions=1)
    head = joint("Head", body, (0, -0.15, 0.0))
    sphere("Face", 0.25, chitin, head, scale=(1.0, 0.9, 0.8))
    eyes(head, 2, 0.06, glow, (0, -0.2, 0.05), 0.26)
    for index in range(6):
        angle = 2 * math.pi * index / 6
        x, y = 0.18 * math.cos(angle), 0.18 * math.sin(angle)
        tentacle = joint(f"Tail {index}", body, (x, y, -0.15))
        points = [(x * t * 2, y * t * 2, -0.9 * t + 0.1 * math.sin(t * 6 + index))
                  for t in (i / 8 for i in range(9))]
        tube(f"Tentacle {index}", [(px - x, py - y, pz) for px, py, pz in points],
             lambda t: 0.06 * (1 - t) + 0.01, skin, tentacle, sides=6)
    for side in (1, -1):
        claw_arm(body, side, (side * 0.25, -0.2, -0.05), 0.4, 0.45, 2, 0.3, skin, chitin,
                 glow, thickness=0.045, elbow=-40)


def scorpion():
    """Armored six-legged scorpion with crushing pincers and a stinger."""
    skin, chitin, glow = skins("Scorpion", "#c8641e", "#5a2a0e", "#3affff")
    body = start(0.5)
    for index in range(4):
        box(f"Carapace {index}", (0.55 - 0.06 * index, 0.3, 0.2), chitin, body,
            (0, -0.15 + 0.28 * index, 0.0), bevel=0.06)
    insect_legs(body, 3, 0.9, 0.5, skin, chitin, spread=0.3, thickness=0.04)
    head = joint("Head", body, (0, -0.35, 0.05))
    eyes(head, 2, 0.035, glow, (0, -0.05, 0.08), 0.08)
    for side in (1, -1):
        claw_arm(body, side, (side * 0.28, -0.3, 0.0), 0.32, 0.36, 2, 0.28, skin, chitin,
                 glow, thickness=0.07, elbow=-60, spread=0.1)
    tail(body, (0, 0.85, 0.05), 6, 0.9, 0.11, skin, chitin, glow, rise=0.16, sting=0.25)


def ghoul():
    """Hunched pale biped with long knuckle-dragging arms and a gaping maw."""
    skin, chitin, glow = skins("Ghoul", "#9aa4b8", "#4a5266", "#ff3ae8")
    body = start(0.85)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(40), 0, 0)
    cylinder("Gut", 0.18, 0.4, skin, torso, top=0.22, scale=(1.1, 0.8, 1))
    sphere("Hump", 0.3, chitin, torso, (0, 0.08, 0.5), scale=(1.1, 0.9, 0.9))
    spikes(torso, 5, (0, 0.28, 0.2), (0, 0.0, 0.1), 0.12, chitin, tilt=-60)
    head = joint("Head", torso, (0, -0.15, 0.7))
    head.rotation_euler = (math.radians(-30), 0, 0)
    sphere("Skull", 0.16, skin, head, scale=(0.9, 1.1, 1.0))
    sphere("Maw", 0.09, glow, head, (0, -0.13, -0.05), scale=(1.0, 0.6, 1.2))
    eyes(head, 3, 0.025, glow, (0, -0.14, 0.07), 0.07)
    for side in (1, -1):
        claw_arm(torso, side, (side * 0.3, -0.05, 0.5), 0.5, 0.5, 4, 0.22, skin, chitin,
                 glow, thickness=0.05, elbow=-20, spread=0.05)
    biped_legs(body, 0.14, 0.42, 0.45, skin, chitin, thickness=0.07)


def cyclops():
    """Squat biped with a single huge glowing eye and four clawed arms."""
    skin, chitin, glow = skins("Cyclops", "#d8b02a", "#5a4410", "#ff2a2a")
    body = start(0.85)
    sphere("Body Ball", 0.5, skin, body, (0, 0, 0.5), scale=(1.0, 0.9, 1.0))
    sphere("Belly Plate", 0.4, chitin, body, (0, -0.15, 0.3), scale=(0.9, 0.6, 0.8))
    head = joint("Head", body, (0, -0.32, 0.65))
    sphere("Eye White", 0.24, material("Eye White", "#f0f0e0", 0.2), head,
           scale=(1.0, 0.6, 1.0))
    sphere("Iris", 0.12, glow, head, (0, -0.12, 0), scale=(1.0, 0.5, 1.0))
    sphere("Pupil", 0.05, material("Pupil", "#050505", 0.2), head, (0, -0.18, 0))
    for side in (1, -1):
        sphere("Lid", 0.25, chitin, head, (0, 0.02, side * 0.06), scale=(1.05, 0.6, 0.6))
    spikes(body, 4, (0, 0.2, 0.9), (0, 0.1, -0.05), 0.2, chitin, tilt=-20)
    for side in (1, -1):
        claw_arm(body, side, (side * 0.48, -0.1, 0.65), 0.35, 0.35, 3, 0.22, skin, chitin,
                 glow, thickness=0.07)
        lower = joint(f"Lower Arm {side}", body, (side * 0.45, -0.15, 0.3))
        lower.rotation_euler = (math.radians(-60), 0, math.radians(-side * 20))
        limb(f"Lower Arm Limb {side}", 0.05, 0.3, skin, lower)
        blade(f"Lower Talon {side}", lower, 0.2, 0.03, chitin, location=(0, 0, -0.3))
    biped_legs(body, 0.25, 0.4, 0.42, skin, chitin, thickness=0.1)
