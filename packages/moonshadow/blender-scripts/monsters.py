"""The ten fantasy monsters that have broken into the elven keep, each
exported as a model by its own project (blender-scripts/elven-<monster>), built
from the jointed parts of creatures.py (see there for the joints the game
animates)."""

import math

from creatures import (arm, biped_legs, blade, claws, eyes, held, horns, insect_legs,
                       quadruped_legs, skins, spikes, start, tail)
from shooter import box, cylinder, joint, limb, material, sphere, tube


def axe(mat, wood):
    def build(name, grip):
        cylinder(name + " Haft", 0.025, 0.8, wood, grip, (0, 0, -0.65), sides=6)
        box(name + " Head", (0.04, 0.28, 0.22), mat, grip, (0, 0.1, -0.6), bevel=0.02)
    return build


def sword(mat, hilt):
    def build(name, grip):
        box(name + " Blade", (0.02, 0.06, 0.8), mat, grip, (0, 0, -0.5), bevel=0.005)
        box(name + " Guard", (0.04, 0.22, 0.03), hilt, grip, (0, 0, -0.09))
    return build


def club(wood, spike):
    def build(name, grip):
        cylinder(name + " Club", 0.04, 0.9, wood, grip, (0, 0, -0.9), top=0.12, sides=8)
        for index in range(5):
            a = index * 1.3
            cylinder(f"{name} Stud {index}", 0.025, 0.08, spike, grip,
                     (0.11 * math.cos(a), 0.11 * math.sin(a), -0.75 + 0.03 * index),
                     rotation=(math.degrees(math.sin(a)) * 1.5, math.degrees(math.cos(a)) * 1.5, 0),
                     top=0.0, sides=4)
    return build


def humanoid_torso(body, skin, dark, width, height, lean, belly=None):
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(lean), 0, 0)
    cylinder("Waist", width * 0.8, height * 0.45, belly or dark, torso, top=width * 0.9,
             scale=(1, 0.75, 1))
    sphere("Chest", width, skin, torso, (0, 0, height * 0.65), scale=(1.15, 0.8, 0.8))
    return torso


def orc():
    """Green-skinned orc warrior in leather with a heavy axe."""
    skin, dark, glow = skins("Orc", "#5a7a3a", "#3a2a1a", "#ff3a1a")
    iron = material("Orc Iron", "#5a5a60", 0.4, 0.8)
    body = start(0.95)
    torso = humanoid_torso(body, skin, dark, 0.3, 0.8, 12)
    box("Harness", (0.5, 0.36, 0.08), dark, torso, (0, 0, 0.55), rotation=(0, 30, 0))
    sphere("Pauldron", 0.15, iron, torso, (0.33, 0, 0.62), scale=(1, 1, 0.6))
    head = joint("Head", torso, (0, -0.05, 0.85))
    sphere("Skull", 0.15, skin, head, scale=(1.0, 1.0, 0.95))
    sphere("Jaw", 0.11, skin, head, (0, -0.07, -0.08), scale=(1.1, 1, 0.7))
    for side in (1, -1):
        blade(f"Tusk {side}", head, 0.08, 0.02, material("Tusk", "#e8e0c0", 0.5), curl=-0.6,
              location=(side * 0.06, -0.15, -0.1), rotation=(170, 0, 0))
        cylinder(f"Ear {side}", 0.04, 0.14, skin, head, (side * 0.14, 0, 0.02), rotation=(0, side * -80, 0),
                 top=0.0, sides=5)
    eyes(head, 2, 0.025, glow, (0, -0.13, 0.03), 0.1)
    arm(torso, 1, (0.32, 0, 0.6), 0.32, 0.3, skin, dark, thickness=0.065)
    arm(torso, -1, (-0.32, 0, 0.6), 0.32, 0.3, skin, dark, thickness=0.065, hand=held("Axe", axe(iron, dark)))
    biped_legs(body, 0.13, 0.45, 0.45, dark, dark, thickness=0.09, toes=False, foot=dark)


def goblin():
    """Small, quick goblin with big ears, a hood and a curved dagger."""
    skin, dark, glow = skins("Goblin", "#8aa03a", "#4a3a2a", "#ffe02a")
    body = start(0.55)
    torso = humanoid_torso(body, skin, dark, 0.17, 0.45, 25, belly=dark)
    head = joint("Head", torso, (0, -0.06, 0.5))
    sphere("Skull", 0.15, skin, head, scale=(1.1, 1, 0.9))
    cylinder("Nose", 0.03, 0.12, skin, head, (0, -0.13, 0), rotation=(80, 0, 0), top=0.005, sides=6)
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.06, 0.28, skin, head, (side * 0.13, 0.02, 0.05), rotation=(0, side * -75, 0),
                 top=0.0, sides=6)
    sphere("Hood", 0.16, dark, head, (0, 0.04, 0.05), scale=(1, 1, 0.9))
    eyes(head, 2, 0.03, glow, (0, -0.13, 0.04), 0.1)
    steel = material("Goblin Steel", "#a0a0a8", 0.3, 0.9)
    arm(torso, 1, (0.18, 0, 0.36), 0.2, 0.2, skin, dark, thickness=0.035,
        hand=claws(3, 0.08, dark))
    arm(torso, -1, (-0.18, 0, 0.36), 0.2, 0.2, skin, dark, thickness=0.035,
        hand=held("Dagger", lambda name, grip: blade(name + " Edge", grip, 0.3, 0.03, steel, curl=0.2)))
    biped_legs(body, 0.08, 0.28, 0.26, skin, dark, thickness=0.045)


def troll():
    """Huge, hunched cave troll with a long nose and a spiked club."""
    skin, dark, glow = skins("Troll", "#6a7a8a", "#3a4048", "#ffaa2a", roughness=0.9)
    wood = material("Troll Wood", "#5a3a20", 0.8)
    body = start(1.1)
    torso = humanoid_torso(body, skin, dark, 0.48, 1.1, 30)
    sphere("Hump", 0.4, skin, torso, (0, 0.25, 0.85))
    spikes(torso, 4, (0, 0.4, 0.5), (0, 0.04, 0.15), 0.18, dark, tilt=-50)
    head = joint("Head", torso, (0, -0.2, 1.05))
    sphere("Skull", 0.2, skin, head, scale=(1, 1.1, 0.9))
    cylinder("Nose", 0.07, 0.25, skin, head, (0, -0.18, 0), rotation=(70, 0, 0), top=0.03, sides=8)
    sphere("Brow", 0.18, dark, head, (0, -0.06, 0.1), scale=(1.1, 0.6, 0.4))
    eyes(head, 2, 0.03, glow, (0, -0.17, 0.05), 0.14)
    arm(torso, 1, (0.5, 0, 0.8), 0.55, 0.5, skin, dark, thickness=0.12, hand=claws(3, 0.12, dark, spread=0.09))
    arm(torso, -1, (-0.5, 0, 0.8), 0.55, 0.5, skin, dark, thickness=0.12, hand=held("Club", club(wood, dark)))
    biped_legs(body, 0.25, 0.55, 0.5, skin, dark, thickness=0.15)


def ogre():
    """Fat ogre with a belly, gold earrings and two great fists."""
    skin, dark, glow = skins("Ogre", "#b08a5a", "#5a3a2a", "#ff3030")
    gold = material("Ogre Gold", "#e0b040", 0.3, 1.0)
    body = start(1.0)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(8), 0, 0)
    sphere("Belly", 0.5, skin, torso, (0, -0.05, 0.4), scale=(1, 0.9, 1))
    box("Loincloth", (0.6, 0.5, 0.3), dark, torso, (0, 0, 0.0))
    sphere("Chest", 0.42, skin, torso, (0, 0.05, 0.95), scale=(1.3, 0.85, 0.7))
    head = joint("Head", torso, (0, -0.05, 1.3))
    sphere("Skull", 0.2, skin, head)
    sphere("Chin", 0.14, skin, head, (0, -0.1, -0.1), scale=(1.2, 0.8, 0.7))
    for side in (1, -1):
        sphere(f"Ear {side}", 0.07, skin, head, (side * 0.2, 0, 0), scale=(0.4, 1, 1.3))
        cylinder(f"Earring {side}", 0.04, 0.01, gold, head, (side * 0.22, 0, -0.1), rotation=(0, 90, 0), sides=10)
    eyes(head, 2, 0.03, glow, (0, -0.18, 0.05), 0.12)
    arm(torso, 1, (0.55, 0, 1.0), 0.45, 0.45, skin, dark, thickness=0.14)
    arm(torso, -1, (-0.55, 0, 1.0), 0.45, 0.45, skin, dark, thickness=0.14)
    biped_legs(body, 0.28, 0.5, 0.45, skin, dark, thickness=0.16, toes=False)


def warg():
    """Great black wolf with glowing eyes; it bites."""
    skin, dark, glow = skins("Warg", "#2a2a30", "#14141a", "#ffd02a", roughness=0.95)
    body = start(0.8)
    sphere("Chest", 0.35, skin, body, (0, -0.35, 0.1), scale=(0.9, 1.1, 1))
    sphere("Belly", 0.3, skin, body, (0, 0.3, 0.05), scale=(0.85, 1.4, 0.9))
    spikes(body, 5, (0, -0.3, 0.38), (0, 0.15, -0.02), 0.15, dark, tilt=-60)
    head = joint("Head", body, (0, -0.65, 0.3))
    sphere("Skull", 0.18, skin, head, scale=(0.9, 1, 0.9))
    cylinder("Snout", 0.1, 0.3, skin, head, (0, -0.1, -0.03), rotation=(90, 0, 0), top=0.06, sides=8)
    sphere("Nose", 0.04, dark, head, (0, -0.4, -0.02))
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.05, 0.15, skin, head, (side * 0.1, 0.05, 0.15), top=0.0, sides=4)
        blade(f"Fang {side}", head, 0.08, 0.015, material("Fang", "#f0e8d0", 0.4), curl=0,
              location=(side * 0.05, -0.36, -0.08))
    eyes(head, 2, 0.03, glow, (0, -0.16, 0.06), 0.12)
    quadruped_legs(body, 0.9, 0.18, 0.75, skin, dark, thickness=0.08)
    tail(body, (0, 0.6, 0.15), 4, 0.6, 0.08, skin, dark, rise=-0.06)


def spider():
    """Giant cave spider, eight legs, two fangs and a glowing back mark."""
    skin, dark, glow = skins("Spider", "#3a2a1e", "#1a120a", "#7aff3a")
    body = start(0.7)
    sphere("Head", 0.3, dark, body, scale=(1.0, 1.1, 0.7))
    sphere("Abdomen", 0.5, skin, body, (0, 0.65, 0.15), scale=(1.0, 1.2, 0.85))
    sphere("Mark", 0.13, glow, body, (0, 0.6, 0.57), scale=(1.0, 1.5, 0.3))
    insect_legs(body, 4, 1.2, 0.7, skin, dark, spread=0.18, thickness=0.045)
    head = joint("Head", body, (0, -0.32, 0.05))
    eyes(head, 4, 0.03, glow, (0, -0.02, 0.12), 0.07)
    for side in (1, -1):
        arm(body, side, (side * 0.12, -0.35, 0.0), 0.2, 0.2, skin, dark, thickness=0.04, elbow=-80,
            hand=claws(1, 0.18, dark))


def skeleton():
    """Skeleton warrior with a rusty sword and a round shield."""
    bone, dark, glow = skins("Skeleton", "#e0d8c0", "#5a4a3a", "#3ac8ff", roughness=0.7)
    rust = material("Rusty Iron", "#7a5a40", 0.6, 0.6)
    body = start(1.0)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(5), 0, 0)
    cylinder("Spine", 0.03, 0.6, bone, torso, sides=6)
    for index in range(5):
        box(f"Rib {index}", (0.36 - 0.03 * index, 0.22, 0.03), bone, torso, (0, -0.02, 0.6 - 0.08 * index),
            bevel=0.01)
    box("Pelvis", (0.3, 0.15, 0.1), bone, torso, (0, 0, 0.0), bevel=0.03)
    head = joint("Head", torso, (0, 0, 0.82))
    sphere("Skull", 0.13, bone, head)
    box("Jaw", (0.14, 0.1, 0.06), bone, head, (0, -0.06, -0.1), bevel=0.02)
    eyes(head, 2, 0.03, glow, (0, -0.11, 0.02), 0.08)
    cylinder("Helmet", 0.14, 0.1, rust, head, (0, 0, 0.04), top=0.11, sides=10)
    arm(torso, 1, (0.22, 0, 0.6), 0.3, 0.28, bone, bone, thickness=0.03,
        hand=lambda n, w: cylinder(n + " Shield", 0.25, 0.04, rust, w, (0.05, -0.05, 0), rotation=(0, 90, 0), sides=14))
    arm(torso, -1, (-0.22, 0, 0.6), 0.3, 0.28, bone, bone, thickness=0.03,
        hand=held("Sword", sword(rust, dark)))
    biped_legs(body, 0.1, 0.48, 0.48, bone, bone, thickness=0.035, toes=False, foot=bone)


def minotaur():
    """Bull-headed minotaur with great horns and a double axe."""
    skin, dark, glow = skins("Minotaur", "#6a3a22", "#2a1a10", "#ff4a1a", roughness=0.9)
    horn = material("Horn", "#e8dcc0", 0.5)
    iron = material("Minotaur Iron", "#6a6a70", 0.35, 0.9)
    body = start(1.1)
    torso = humanoid_torso(body, skin, dark, 0.42, 1.0, 15)
    sphere("Hump", 0.3, skin, torso, (0, 0.15, 1.0))
    head = joint("Head", torso, (0, -0.15, 1.1))
    sphere("Skull", 0.2, skin, head, scale=(0.9, 1.1, 0.9))
    cylinder("Muzzle", 0.13, 0.22, skin, head, (0, -0.12, -0.05), rotation=(80, 0, 0), top=0.1, sides=10)
    cylinder("Nose Ring", 0.04, 0.01, material("Ring Gold", "#e0b040", 0.3, 1.0), head, (0, -0.33, -0.12),
             rotation=(90, 0, 0), sides=12)
    horns(head, horn, 0.15, 0.4, curl=0.5, rise=95, location=(0, 0, 0.1))
    eyes(head, 2, 0.03, glow, (0, -0.17, 0.05), 0.16)
    def double_axe(name, grip):
        cylinder(name + " Haft", 0.03, 1.1, dark, grip, (0, 0, -0.9), sides=6)
        for side in (1, -1):
            box(f"{name} Bit {side}", (0.04, 0.3, 0.3), iron, grip, (0, side * 0.15, -0.8), bevel=0.04)
    arm(torso, 1, (0.45, 0, 0.75), 0.45, 0.42, skin, dark, thickness=0.11)
    arm(torso, -1, (-0.45, 0, 0.75), 0.45, 0.42, skin, dark, thickness=0.11, hand=held("Axe", double_axe))
    biped_legs(body, 0.22, 0.55, 0.5, skin, dark, thickness=0.13, digitigrade=True, toes=False)


def wraith():
    """Floating wraith: a tattered hooded shadow with long ghostly claws."""
    cloth, dark, glow = skins("Wraith", "#2a2a3a", "#0a0a14", "#7affe0")
    ghost = material("Ghost Light", "#9affea", emission=2.0)
    body = start(1.2)
    joint("Hover", body)
    cylinder("Robe", 0.4, 1.0, cloth, body, (0, 0, -0.95), top=0.25, sides=12)
    for index in range(6):
        a = 2 * math.pi * index / 6
        cylinder(f"Tatter {index}", 0.1, 0.4, dark, body, (0.3 * math.cos(a), 0.3 * math.sin(a), -1.1),
                 top=0.0, rotation=(180, 0, 0), sides=4)
    sphere("Shoulders", 0.3, cloth, body, (0, 0, 0.2), scale=(1.2, 0.8, 0.6))
    head = joint("Head", body, (0, -0.05, 0.45))
    sphere("Hood", 0.2, cloth, head, (0, 0.03, 0), scale=(1, 1.1, 1.2))
    sphere("Void", 0.15, dark, head, (0, -0.07, -0.02))
    eyes(head, 2, 0.035, glow, (0, -0.18, 0.0), 0.1)
    tail(body, (0, 0.2, -0.3), 3, 0.6, 0.08, cloth, dark, rise=-0.12)  # a trailing shred of robe
    for side in (1, -1):
        arm(body, side, (side * 0.35, 0, 0.2), 0.35, 0.35, cloth, ghost, thickness=0.04, fist=ghost,
            hand=claws(4, 0.25, ghost, glow, spread=0.04, width=0.02))


def golem():
    """Stone golem of the hills, runes burning in its cracks."""
    stone, dark, glow = skins("Golem", "#8a8478", "#5a564e", "#ff8a2a", roughness=0.95)
    body = start(1.1)
    torso = joint("Torso", body)
    box("Hips", (0.6, 0.4, 0.3), stone, torso, bevel=0.06)
    box("Chest", (0.95, 0.6, 0.7), stone, torso, (0, 0, 0.65), bevel=0.1)
    box("Rune", (0.2, 0.02, 0.2), glow, torso, (0, -0.31, 0.7), rotation=(0, 45, 0))
    for side in (1, -1):
        box(f"Crack {side}", (0.03, 0.02, 0.4), glow, torso, (side * 0.25, -0.31, 0.6), rotation=(0, side * 20, 0))
    head = joint("Head", torso, (0, -0.1, 1.05))
    box("Skull", (0.3, 0.3, 0.28), stone, head, bevel=0.06)
    box("Visor", (0.22, 0.02, 0.05), glow, head, (0, -0.16, 0.03))
    for side in (1, -1):
        name = "ArmL" if side > 0 else "ArmR"
        shoulder = joint(name, torso, (side * 0.6, 0, 0.8))
        shoulder.rotation_euler = (math.radians(-20), 0, 0)
        box(f"{name} Boulder", (0.35, 0.35, 0.35), dark, shoulder, bevel=0.08)
        box(f"{name} Upper", (0.25, 0.25, 0.5), stone, shoulder, (0, 0, -0.4), bevel=0.05)
        box(f"{name} Fist", (0.35, 0.35, 0.4), dark, shoulder, (0, -0.05, -0.85), bevel=0.08)
    biped_legs(body, 0.22, 0.5, 0.5, stone, dark, thickness=0.16, toes=False)
