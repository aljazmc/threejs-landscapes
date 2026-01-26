import math

from lowpoly import Builder, clear_scene, empty, setup_scene

# Kurent, the shaggy carnival figure of Ptuj that chases winter away: a
# sheepskin coat, a leather mask with horns, a long red tongue and colorful
# ribbons, a belt of big bells, green socks and the ježevka, a stick with a
# hedgehog skin. It hops from foot to foot so its bells ring; the hop is
# baked into a looping clip that the app plays while it walks the kurents
# along the parade path. It faces -Y and the app tints its "fur" material.
FPS = 30
FRAMES = 61  # frame 60 repeats frame 0, so the clip loops seamlessly
HOPS = 2
RIBBONS = ("red", "yellow", "green", "blue", "pink", "red", "yellow", "blue",
           "green")


def body_mesh():
    b = Builder("Body", seed=1)
    b.ico((0, 0, 1.2), 0.62, "fur", 2, scale=(1, 0.85, 1.3), jitter=0.08)
    b.ico((0, 0, 2.0), 0.46, "fur", 2, jitter=0.1)
    # mask
    b.ico((0, -0.3, 1.97), 0.36, "leather", 1, scale=(1, 0.5, 1.1))
    for x in (-0.15, 0.15):
        b.cylinder((x, -0.44, 2.07), 0.11, 0.06, "red", 8,
                   rotation=(math.pi / 2, 0, 0))
        b.ico((x, -0.5, 2.07), 0.07, "white", 1)
        b.ico((x, -0.56, 2.07), 0.035, "black", 1)
    b.cone((0, -0.44, 1.94), 0.09, 0.35, "leather", 6,
           rotation=(math.pi / 2, 0, 0))
    b.box((0, -0.47, 1.76), (0.26, 0.08, 0.08), "black")
    for x in (-0.08, 0.0, 0.08):
        b.box((x, -0.52, 1.8), (0.05, 0.03, 0.05), "white")
    b.box((0, -0.53, 1.1), (0.14, 0.05, 0.68), "red", (-0.15, 0, 0))
    # horns, curving out and up
    for side in (-1, 1):
        b.cone((side * 0.32, -0.05, 2.22), 0.1, 0.55, "wall_cream", 6,
               rotation=(0, side * 1.0, 0))
        b.cone((side * 0.72, -0.05, 2.5), 0.05, 0.3, "wall_cream", 6,
               rotation=(0, side * 0.2, 0))
    # ribbons falling down the back
    for i, ribbon in enumerate(RIBBONS):
        x = (i - len(RIBBONS) / 2 + 0.5) * 0.1
        b.box((x, 0.4, 1.35), (0.08, 0.03, 1.0), ribbon, (0.3, 0, x * 0.4))
    # belt with bells
    b.cylinder((0, 0, 0.82), 0.66, 0.12, "leather", 12)
    for i in range(5):
        a = math.pi * (1 + i / 4)
        x, y = 0.72 * math.cos(a), 0.43 * math.sin(a)
        b.cylinder((x, y, 0.55), 0.17, 0.25, "brass", 8, 0.08)
        b.ico((x, y, 0.53), 0.05, "black", 1)
    return b.finish()


def leg(name, side, parent):
    b = Builder(name)
    b.cylinder((0, 0, -0.72), 0.12, 0.7, "green", 6)
    b.box((0, -0.06, -0.82), (0.24, 0.38, 0.16), "black")
    return b.finish(parent, (side * 0.24, 0, 0.82))


def arm(name, side, parent, stick=False):
    b = Builder(name, seed=2 + side)
    b.cylinder((0, 0, -0.72), 0.14, 0.72, "fur", 6, 0.16)
    b.ico((0, 0, -0.8), 0.12, "leather", 1)
    if stick:
        # the ježevka, leaning forward
        lean = 0.5
        b.cylinder((0.25, 0.15, -1.15), 0.05, 1.6, "wood", 6,
                   rotation=(lean, 0, 0))
        head = (0.25, 0.15 - 1.6 * math.sin(lean),
                -1.15 + 1.6 * math.cos(lean))
        b.ico(head, 0.16, "stone_dark", 1, jitter=0.2)
        for i in range(8):
            a = 2 * math.pi * i / 8
            b.cone(head, 0.04, 0.3, "stone_dark", 4,
                   rotation=(math.cos(a) * 1.4, math.sin(a) * 1.4, 0))
    return b.finish(parent, (side * 0.62, 0, 1.55))


def kurent():
    clear_scene()
    setup_scene(FPS, FRAMES)
    root = empty("Kurent")
    body = body_mesh()
    body.parent = root
    legs = [leg("LegL", -1, body), leg("LegR", 1, body)]
    arms = [arm("ArmL", -1, body), arm("ArmR", 1, body, stick=True)]
    for frame in range(FRAMES):
        t = frame / (FRAMES - 1)
        swing = math.sin(2 * math.pi * t * HOPS / 2)
        body.location.z = 0.22 * abs(math.sin(math.pi * t * HOPS))
        body.rotation_euler = (0.05 * abs(swing), 0.12 * swing, 0.08 * swing)
        body.keyframe_insert("location", frame=frame)
        body.keyframe_insert("rotation_euler", frame=frame)
        for part, sign in zip(legs, (1, -1)):
            part.rotation_euler.x = 0.4 * sign * swing
            part.keyframe_insert("rotation_euler", frame=frame)
        for part, sign in zip(arms, (-1, 1)):
            part.rotation_euler.x = 0.5 * sign * swing
            part.rotation_euler.y = sign * 0.15
            part.keyframe_insert("rotation_euler", frame=frame)
