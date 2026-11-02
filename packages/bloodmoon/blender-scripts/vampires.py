"""The vampires and their minions haunting the castle, each exported as a
model by its own project (blender-scripts/gothic-<enemy>), built from the jointed
parts of creatures.py (see there for the joints the game animates)."""

import math

from creatures import (arm, biped_legs, blade, claws, eyes, held, horns, quadruped_legs,
                       skins, spikes, start, tail, wings)
from shooter import box, cylinder, joint, material, mesh_from, new_object, sphere, tube


def humanoid_torso(body, skin, dark, width, height, lean, belly=None):
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(lean), 0, 0)
    cylinder("Waist", width * 0.8, height * 0.45, belly or dark, torso, top=width * 0.9,
             scale=(1, 0.75, 1))
    sphere("Chest", width, skin, torso, (0, 0, height * 0.65), scale=(1.15, 0.8, 0.8))
    return torso


def cape(parent, location, width, length, outer, inner, flare=0.3):
    """A cape hanging behind from the shoulders: two sheets (black outside,
    red inside) flaring out towards the hem."""
    def sheet(mat, offset, name):
        def build(bm):
            columns = 7
            rows = 5
            grid = []
            for r in range(rows):
                t = r / (rows - 1)
                half = width / 2 * (1 + flare * t * 2)
                row = []
                for c in range(columns):
                    u = c / (columns - 1) * 2 - 1
                    x = u * half
                    y = offset + 0.05 + t * flare * 0.6 + 0.06 * math.cos(u * math.pi * 1.5) * t
                    row.append(bm.verts.new((x, y, -t * length)))
                grid.append(row)
            for r in range(rows - 1):
                for c in range(columns - 1):
                    bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
        holder = joint(name + " Holder", parent, location)
        new_object(name, mesh_from(name, build, True), holder, mat=mat)
    sheet(outer, 0.01, "Cape Outer")
    sheet(inner, 0.0, "Cape Inner")
    for side in (1, -1):
        blade(f"Collar {side}", parent, 0.3, 0.12, outer, curl=-0.3,
              location=(location[0] + side * width * 0.4, location[1] + 0.02, location[2]),
              rotation=(180, side * 20, 0))


def fangs(head, mat, location, spread=0.03, length=0.04):
    for side in (1, -1):
        blade(f"Fang {side}", head, length, 0.01, mat, curl=0.0,
              location=(location[0] + side * spread, location[1], location[2]))


def vampire():
    """The vampire lord: tall, pale, in a black tailcoat and a high-collared
    cape lined with red, slicked hair, long nails."""
    skin, dark, glow = skins("Vampire", "#d8d0d8", "#14101a", "#ff1a2a")
    red = material("Vampire Red", "#7a0a14", 0.8)
    white = material("Shirt", "#e8e4e0", 0.8)
    fang = material("Vampire Fang", "#ffffff", 0.3)
    gold = material("Medallion", "#c8a040", 0.3, 1.0)
    body = start(1.0)
    torso = humanoid_torso(body, dark, dark, 0.22, 0.8, 4)
    box("Shirt Front", (0.12, 0.04, 0.35), white, torso, (0, -0.17, 0.6))
    box("Waistcoat", (0.26, 0.05, 0.3), red, torso, (0, -0.15, 0.45))
    sphere("Medallion", 0.04, gold, torso, (0, -0.2, 0.62), scale=(1, 0.4, 1))
    cape(torso, (0, 0.12, 0.78), 0.55, 1.65, dark, red)
    head = joint("Head", torso, (0, -0.02, 0.95))
    sphere("Skull", 0.12, skin, head, scale=(0.9, 1, 1.15))
    sphere("Hair", 0.125, dark, head, (0, 0.03, 0.05), scale=(0.95, 1, 1.05))
    cylinder("Widow Peak", 0.03, 0.06, dark, head, (0, -0.11, 0.1), rotation=(170, 0, 0), top=0.0, sides=4)
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.025, 0.08, skin, head, (side * 0.1, 0.01, 0.03), rotation=(0, side * -70, 0),
                 top=0.0, sides=5)
    eyes(head, 2, 0.02, glow, (0, -0.11, 0.03), 0.08)
    fangs(head, fang, (0, -0.11, -0.07), 0.02)
    hand = claws(4, 0.08, skin, spread=0.03, width=0.012)
    arm(torso, 1, (0.26, 0, 0.7), 0.32, 0.3, dark, dark, thickness=0.045, fist=skin, hand=hand)
    arm(torso, -1, (-0.26, 0, 0.7), 0.32, 0.3, dark, dark, thickness=0.045, fist=skin, hand=hand)
    biped_legs(body, 0.1, 0.48, 0.48, dark, dark, thickness=0.06, toes=False, foot=dark)


def bride():
    """Vampire bride floating in a tattered white gown, long black hair."""
    gown, dark, glow = skins("Bride", "#e0dcd8", "#1a1018", "#ff3a5a")
    skin = material("Bride Skin", "#e8dce0", 0.5)
    hair = material("Bride Hair", "#0e0a0e", 0.7)
    fang = material("Bride Fang", "#ffffff", 0.3)
    blood = material("Bride Blood", "#7a0008", 0.2, emission=0.4)
    body = start(1.05)
    joint("Hover", body)
    cylinder("Gown", 0.42, 1.0, gown, body, (0, 0, -1.0), top=0.16, sides=14)
    for index in range(7):
        a = 2 * math.pi * index / 7
        cylinder(f"Tatter {index}", 0.11, 0.35, gown, body, (0.36 * math.cos(a), 0.36 * math.sin(a), -1.0),
                 top=0.0, rotation=(180, 0, 0), sides=4)
    box("Blood Stain", (0.12, 0.02, 0.25), blood, body, (0.05, -0.19, -0.1))
    sphere("Bodice", 0.17, gown, body, (0, 0, 0.15), scale=(1, 0.75, 1.2))
    head = joint("Head", body, (0, -0.02, 0.48))
    sphere("Skull", 0.11, skin, head, scale=(0.9, 1, 1.1))
    sphere("Hair", 0.12, hair, head, (0, 0.03, 0.03))
    tube("Hair Fall", [(0, 0.08, 0.0), (0, 0.15, -0.3), (0, 0.13, -0.6)], lambda t: 0.1 * (1 - t) + 0.05, hair, head)
    eyes(head, 2, 0.02, glow, (0, -0.1, 0.03), 0.07)
    fangs(head, fang, (0, -0.1, -0.06), 0.018, 0.035)
    tail(body, (0, 0.2, -0.4), 3, 0.6, 0.12, gown, gown, rise=-0.1)  # the trailing veil of her gown
    for side in (1, -1):
        arm(body, side, (side * 0.2, 0, 0.25), 0.3, 0.3, skin, gown, thickness=0.035,
            hand=claws(4, 0.1, skin, spread=0.03, width=0.012))


def nosferatu():
    """Bald, rat-faced nosferatu: hunched, a long black coat, pointed ears,
    two front fangs and enormous clawed fingers."""
    skin, dark, glow = skins("Nosferatu", "#c8ccb8", "#141414", "#ffe03a")
    fang = material("Rat Fang", "#f0e8c8", 0.3)
    body = start(1.0)
    torso = humanoid_torso(body, dark, dark, 0.2, 0.85, 22)
    cylinder("Coat", 0.28, 1.0, dark, body, (0, 0.02, -0.95), top=0.2, sides=10)
    head = joint("Head", torso, (0, -0.1, 0.95))
    sphere("Skull", 0.13, skin, head, scale=(0.85, 1, 1.35))
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.04, 0.18, skin, head, (side * 0.1, 0.02, 0.06), rotation=(0, side * -60, 0),
                 top=0.0, sides=5)
        blade(f"Fang {side}", head, 0.06, 0.012, fang, curl=0.0, location=(side * 0.012, -0.12, -0.1))
    cylinder("Nose", 0.025, 0.08, skin, head, (0, -0.12, -0.02), rotation=(60, 0, 0), top=0.008, sides=6)
    eyes(head, 2, 0.022, glow, (0, -0.11, 0.05), 0.08)
    hand = claws(4, 0.2, skin, spread=0.035, width=0.012)
    arm(torso, 1, (0.24, 0, 0.7), 0.35, 0.33, dark, dark, thickness=0.04, fist=skin, hand=hand)
    arm(torso, -1, (-0.24, 0, 0.7), 0.35, 0.33, dark, dark, thickness=0.04, fist=skin, hand=hand)
    biped_legs(body, 0.09, 0.48, 0.48, dark, dark, thickness=0.05, toes=False, foot=dark)


def ghoul():
    """Grey, starved ghoul crawling on all fours, ribs showing, long claws."""
    skin, dark, glow = skins("Ghoul", "#7a8070", "#3a3a30", "#c8ff3a", roughness=0.8)
    bone = material("Ghoul Bone", "#d8d0b0", 0.6)
    body = start(0.7)
    torso = joint("Torso", body)
    torso.rotation_euler = (math.radians(70), 0, 0)
    sphere("Chest", 0.2, skin, torso, (0, 0, 0.35), scale=(1.1, 0.8, 1.3))
    for index in range(4):
        box(f"Rib {index}", (0.34, 0.02, 0.02), bone, torso, (0, -0.15, 0.2 + 0.08 * index))
    cylinder("Waist", 0.13, 0.25, skin, torso, top=0.17, sides=8)
    head = joint("Head", torso, (0, -0.05, 0.62))
    head.rotation_euler = (math.radians(-60), 0, 0)
    sphere("Skull", 0.12, skin, head, scale=(0.9, 1.1, 1.0))
    box("Jaw", (0.14, 0.12, 0.05), dark, head, (0, -0.08, -0.08), bevel=0.02)
    for k in range(4):
        blade(f"Tooth {k}", head, 0.04, 0.01, bone, curl=0, location=(-0.045 + 0.03 * k, -0.13, -0.05))
    eyes(head, 2, 0.022, glow, (0, -0.11, 0.03), 0.07)
    spikes(torso, 5, (0, 0.17, 0.05), (0, 0, 0.12), 0.06, bone, tilt=-80)
    hand = claws(3, 0.15, dark, spread=0.04, width=0.015)
    arm(torso, 1, (0.2, 0, 0.45), 0.32, 0.32, skin, dark, thickness=0.04, hand=hand)
    arm(torso, -1, (-0.2, 0, 0.45), 0.32, 0.32, skin, dark, thickness=0.04, hand=hand)
    biped_legs(body, 0.12, 0.4, 0.4, skin, dark, thickness=0.05, digitigrade=True)


def zombie():
    """Shambling zombie servant in a torn butler's livery, one arm reaching."""
    skin, dark, glow = skins("Zombie", "#7a9070", "#2a2a24", "#e0e0a0", roughness=0.85)
    livery = material("Livery", "#2a1e3a", 0.85)
    shirt = material("Rotten Shirt", "#a09a80", 0.9)
    blood = material("Zombie Blood", "#5a0a08", 0.3)
    body = start(0.95)
    torso = humanoid_torso(body, livery, livery, 0.24, 0.8, 10)
    box("Shirt", (0.14, 0.04, 0.4), shirt, torso, (0, -0.18, 0.55))
    box("Wound", (0.1, 0.02, 0.1), blood, torso, (0.08, -0.2, 0.4))
    head = joint("Head", torso, (0, -0.04, 0.92))
    head.rotation_euler = (0, math.radians(15), math.radians(10))
    sphere("Skull", 0.13, skin, head, scale=(0.95, 1, 1.05))
    box("Jaw", (0.12, 0.09, 0.05), skin, head, (0, -0.06, -0.12), rotation=(15, 0, 0), bevel=0.02)
    sphere("Bald", 0.12, dark, head, (0.03, 0.02, 0.06), scale=(0.9, 0.9, 0.6))
    eyes(head, 2, 0.022, glow, (0, -0.12, 0.03), 0.08)
    arm(torso, 1, (0.28, 0, 0.7), 0.32, 0.3, livery, dark, thickness=0.05, fist=skin, elbow=-15)
    arm(torso, -1, (-0.28, 0, 0.7), 0.32, 0.3, livery, dark, thickness=0.05, fist=skin)
    biped_legs(body, 0.11, 0.45, 0.45, livery, dark, thickness=0.06, toes=False, foot=dark)


def werewolf():
    """Huge werewolf on its hind legs, shaggy brown fur, wolf head, claws."""
    fur, dark, glow = skins("Werewolf", "#5a4030", "#2a1e16", "#ffc81a", roughness=0.95)
    fang = material("Wolf Fang", "#f0e8d0", 0.4)
    body = start(1.1)
    torso = humanoid_torso(body, fur, dark, 0.4, 1.0, 25)
    sphere("Mane", 0.38, dark, torso, (0, 0.12, 0.85), scale=(1.1, 0.9, 0.8))
    spikes(torso, 4, (0, 0.38, 0.5), (0, 0.03, 0.12), 0.18, dark, tilt=-50)
    head = joint("Head", torso, (0, -0.2, 1.05))
    sphere("Skull", 0.18, fur, head, scale=(0.9, 1, 0.9))
    cylinder("Snout", 0.1, 0.3, fur, head, (0, -0.12, -0.04), rotation=(90, 0, 0), top=0.06, sides=8)
    sphere("Nose", 0.04, dark, head, (0, -0.42, -0.03))
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.05, 0.16, fur, head, (side * 0.1, 0.05, 0.15), top=0.0, sides=4)
        blade(f"Fang {side}", head, 0.08, 0.015, fang, curl=0, location=(side * 0.05, -0.38, -0.08))
    eyes(head, 2, 0.028, glow, (0, -0.16, 0.06), 0.12)
    hand = claws(4, 0.16, dark, spread=0.05, width=0.02)
    arm(torso, 1, (0.45, 0, 0.8), 0.5, 0.45, fur, dark, thickness=0.1, hand=hand)
    arm(torso, -1, (-0.45, 0, 0.8), 0.5, 0.45, fur, dark, thickness=0.1, hand=hand)
    biped_legs(body, 0.2, 0.55, 0.55, fur, dark, thickness=0.12, digitigrade=True)
    tail(body, (0, 0.3, 0.0), 4, 0.6, 0.09, fur, dark, rise=-0.08)


def bat():
    """Giant vampire bat with leathery wings, big ears and fangs, hovering."""
    skin, dark, glow = skins("Bat", "#3a2a2a", "#1a1214", "#ff2a2a", roughness=0.9)
    membrane = material("Bat Wing", "#4a2a2e", 0.8)
    fang = material("Bat Fang", "#ffffff", 0.3)
    body = start(1.5)
    joint("Hover", body)
    sphere("Body", 0.25, skin, body, scale=(0.9, 0.8, 1.2))
    head = joint("Head", body, (0, -0.1, 0.32))
    sphere("Skull", 0.15, skin, head)
    cylinder("Snout", 0.07, 0.1, skin, head, (0, -0.12, -0.02), rotation=(90, 0, 0), top=0.05, sides=8)
    sphere("Nose", 0.04, dark, head, (0, -0.23, 0.0), scale=(1.3, 0.6, 1))
    for side in (1, -1):
        cylinder(f"Ear {side}", 0.07, 0.28, skin, head, (side * 0.09, 0.0, 0.08), rotation=(0, side * -20, 0),
                 top=0.0, sides=5)
    fangs(head, fang, (0, -0.2, -0.07), 0.03, 0.05)
    eyes(head, 2, 0.03, glow, (0, -0.13, 0.05), 0.1)
    wings(body, (0.15, 0.05, 0.15), 1.1, membrane, dark)
    for side in (1, -1):
        name = "ArmL" if side > 0 else "ArmR"
        foot = joint(name, body, (side * 0.1, 0, -0.28))
        foot.rotation_euler = (math.radians(-25), 0, 0)
        limb(name + " Leg", 0.025, 0.25, dark, foot)
        claws(3, 0.08, dark, spread=0.03, width=0.012)(name, joint(name + " Foot", foot, (0, 0, -0.25)))


def limb(name, radius, length, mat, parent):
    cylinder(name, radius, length, mat, parent, (0, 0, -length), sides=6)


def rat():
    """A rat as big as a dog, mangy and red-eyed, its long tail swaying."""
    fur, dark, glow = skins("Rat", "#5a5048", "#2a2420", "#ff2a1a", roughness=0.95)
    pink = material("Rat Pink", "#c08a80", 0.6)
    tooth = material("Rat Tooth", "#f0d880", 0.4)
    body = start(0.42)
    sphere("Body", 0.3, fur, body, (0, 0.1, 0.05), scale=(0.75, 1.5, 0.75))
    head = joint("Head", body, (0, -0.35, 0.08))
    sphere("Skull", 0.13, fur, head, scale=(0.85, 1.1, 0.85))
    cylinder("Snout", 0.08, 0.2, fur, head, (0, -0.08, -0.02), rotation=(90, 0, 0), top=0.03, sides=8)
    sphere("Nose", 0.025, pink, head, (0, -0.28, -0.02))
    for side in (1, -1):
        sphere(f"Ear {side}", 0.06, pink, head, (side * 0.09, 0.03, 0.1), scale=(1, 0.3, 1))
        blade(f"Whisker {side}", head, 0.12, 0.005, dark, curl=0, location=(side * 0.05, -0.23, -0.02),
              rotation=(90, 0, side * 70))
    for side in (1, -1):
        box(f"Tooth {side}", (0.015, 0.01, 0.05), tooth, head, (side * 0.009, -0.27, -0.07))
    eyes(head, 2, 0.022, glow, (0, -0.1, 0.05), 0.11)
    quadruped_legs(body, 0.55, 0.15, 0.4, fur, pink, thickness=0.04)
    tail(body, (0, 0.5, 0.0), 6, 0.9, 0.035, pink, pink, rise=0.02)


def hunchback():
    """The castle's hunchbacked servant with a lantern and a meat cleaver."""
    skin, dark, glow = skins("Hunchback", "#b09a80", "#3a2a1e", "#ffa02a")
    rags = material("Rags", "#5a4a30", 0.95)
    steel = material("Cleaver", "#8a8a90", 0.35, 0.9)
    lamp = material("Lantern Light", "#ffb050", emission=6.0)
    body = start(0.8)
    torso = humanoid_torso(body, rags, rags, 0.28, 0.7, 30)
    sphere("Hump", 0.28, rags, torso, (0.08, 0.2, 0.6))
    head = joint("Head", torso, (0, -0.15, 0.7))
    sphere("Skull", 0.14, skin, head, scale=(1, 1, 0.9))
    sphere("Big Eye", 0.04, glow, head, (0.05, -0.12, 0.04))
    sphere("Small Eye", 0.02, glow, head, (-0.05, -0.12, 0.02))
    sphere("Lip", 0.06, skin, head, (0, -0.1, -0.07), scale=(1.2, 0.6, 0.6))
    def cleaver(name, grip):
        cylinder(name + " Handle", 0.02, 0.15, dark, grip, (0, 0, -0.15), sides=6)
        box(name + " Blade", (0.02, 0.2, 0.25), steel, grip, (0, 0.06, -0.28))
    def lantern(name, grip):
        cylinder(name + " Bail", 0.006, 0.15, dark, grip, (0, 0, -0.15), sides=4)
        cylinder(name + " Cage", 0.07, 0.18, dark, grip, (0, 0, -0.32), sides=6)
        sphere(name + " Light", 0.05, lamp, grip, (0, 0, -0.23))
    arm(torso, 1, (0.3, 0, 0.55), 0.3, 0.28, skin, rags, thickness=0.06, hand=held("Lantern", lantern))
    arm(torso, -1, (-0.3, 0, 0.55), 0.3, 0.28, skin, rags, thickness=0.06, hand=held("Cleaver", cleaver))
    biped_legs(body, 0.13, 0.4, 0.38, rags, dark, thickness=0.07, toes=False, foot=dark)


def fiend():
    """A winged demon of the pit summoned by the vampires: red skin, ram's
    horns, bat wings, a whip of a tail."""
    skin, dark, glow = skins("Fiend", "#8a1a14", "#2a0a0a", "#ffd02a")
    horn = material("Fiend Horn", "#2a2018", 0.5)
    body = start(1.05)
    torso = humanoid_torso(body, skin, dark, 0.3, 0.9, 12)
    head = joint("Head", torso, (0, -0.08, 0.95))
    sphere("Skull", 0.15, skin, head, scale=(0.9, 1, 1.05))
    sphere("Jaw", 0.1, skin, head, (0, -0.08, -0.09), scale=(1, 0.8, 0.7))
    horns(head, horn, 0.1, 0.35, curl=0.8, rise=80, location=(0, 0, 0.08))
    eyes(head, 2, 0.028, glow, (0, -0.13, 0.03), 0.1)
    wings(torso, (0.15, 0.15, 0.7), 1.1, dark, skin)
    hand = claws(3, 0.14, horn, spread=0.045, width=0.018)
    arm(torso, 1, (0.33, 0, 0.7), 0.38, 0.35, skin, dark, thickness=0.075, hand=hand)
    arm(torso, -1, (-0.33, 0, 0.7), 0.38, 0.35, skin, dark, thickness=0.075, hand=hand)
    biped_legs(body, 0.16, 0.5, 0.5, skin, dark, thickness=0.09, digitigrade=True)
    tail(body, (0, 0.2, -0.05), 6, 1.0, 0.05, skin, dark, rise=0.03,
         tip=lambda j, step: cylinder("Tail Barb", 0.06, 0.15, dark, j, (0, step, 0), rotation=(-90, 0, 0),
                                      top=0.0, sides=4))
