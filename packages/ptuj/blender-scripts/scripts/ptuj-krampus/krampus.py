import math

from lowpoly import Builder, clear_scene, empty, setup_scene

# Krampus, the devil in black fur who joins the carnival: a red mask with
# fangs and a long tongue, big goat horns sweeping back, a chain across the
# chest, a cow bell on the back, hooves and a bundle of birch twigs. It
# stomps along with a shaking head, baked into a looping clip like the
# kurent's hop. It faces -Y.
FPS = 30
FRAMES = 61  # frame 60 repeats frame 0, so the clip loops seamlessly
STOMPS = 2


def horn(b, side):
    """A horn of tapering cones, curling out, back and up."""
    x, y, z = side * 0.2, -0.05, 2.2
    radius = 0.12
    for i in range(4):
        pitch = -0.4 - 0.45 * i
        roll = side * (0.6 - 0.15 * i)
        length = 0.32
        b.cylinder((x, y, z), radius, length, "horn", 6, radius * 0.75,
                   rotation=(pitch, roll, 0))
        x += length * math.cos(pitch) * math.sin(roll)
        y -= length * math.sin(pitch)
        z += length * math.cos(pitch) * math.cos(roll)
        radius *= 0.75


def body_mesh():
    b = Builder("Body", seed=5)
    b.ico((0, 0, 1.2), 0.58, "fur_dark", 2, scale=(1, 0.85, 1.35),
          jitter=0.12)
    b.ico((0, 0, 1.98), 0.42, "fur_dark", 2, jitter=0.12)
    # mask
    b.ico((0, -0.27, 2.0), 0.33, "red", 1, scale=(1, 0.55, 1.15))
    for x in (-0.13, 0.13):
        b.ico((x, -0.45, 2.1), 0.07, "yellow", 1)
        b.ico((x, -0.5, 2.1), 0.035, "black", 1)
        b.box((x, -0.43, 2.2), (0.16, 0.05, 0.04), "black",
              (0, 0.4 if x < 0 else -0.4, 0))
        b.cone((x * 0.8, -0.47, 1.88), 0.035, 0.12, "white", 4,
               rotation=(math.pi, 0, 0))
    b.cone((0, -0.45, 1.98), 0.06, 0.18, "red", 6,
           rotation=(math.pi / 2, 0, 0))
    b.box((0, -0.5, 1.15), (0.12, 0.05, 0.75), "red", (-0.2, 0, 0))
    for side in (-1, 1):
        horn(b, side)
        b.cone((side * 0.4, 0.0, 2.05), 0.1, 0.2, "fur_dark", 4,
               rotation=(0, side * 1.5, 0))
    # chain across the chest and the cow bell on the back
    for i in range(9):
        t = i / 8
        b.cylinder((-0.45 + 0.9 * t, -0.45 + 0.08 * math.sin(math.pi * t),
                    1.55 - 0.6 * t), 0.06, 0.04, "stone_dark", 6,
                   rotation=(math.pi / 2, (i % 2) * math.pi / 2, 0))
    b.cylinder((0, 0.55, 1.0), 0.22, 0.35, "brass", 6, 0.14)
    b.cylinder((0, 0, 0.82), 0.6, 0.1, "leather", 10)
    return b.finish()


def leg(name, side, parent):
    b = Builder(name, seed=6 + side)
    b.cylinder((0, 0, -0.72), 0.16, 0.72, "fur_dark", 6, 0.2)
    b.cylinder((0, -0.04, -0.82), 0.15, 0.14, "black", 6, 0.12)
    return b.finish(parent, (side * 0.24, 0, 0.82))


def arm(name, side, parent, twigs=False):
    b = Builder(name, seed=8 + side)
    b.cylinder((0, 0, -0.72), 0.14, 0.72, "fur_dark", 6, 0.17)
    b.ico((0, 0, -0.8), 0.12, "black", 1)
    if twigs:
        # the bundle of birch twigs, tied with a ribbon
        for i in range(5):
            spread = (i - 2) * 0.06
            b.cylinder((0.0, -0.05, -0.95), 0.025, 1.3, "wood",
                       4, 0.01, rotation=(0.6 + spread, spread, 0))
        b.cylinder((0.0, -0.2, -0.75), 0.07, 0.1, "red", 6,
                   rotation=(0.6, 0, 0))
    else:
        # the end of the chain
        for i in range(5):
            b.cylinder((0.05, 0, -0.95 - i * 0.12), 0.06, 0.04,
                       "stone_dark", 6,
                       rotation=(math.pi / 2, (i % 2) * math.pi / 2, 0))
    return b.finish(parent, (side * 0.6, 0, 1.55))


def krampus():
    clear_scene()
    setup_scene(FPS, FRAMES)
    root = empty("Krampus")
    body = body_mesh()
    body.parent = root
    legs = [leg("LegL", -1, body), leg("LegR", 1, body)]
    arms = [arm("ArmL", -1, body), arm("ArmR", 1, body, twigs=True)]
    for frame in range(FRAMES):
        t = frame / (FRAMES - 1)
        swing = math.sin(2 * math.pi * t * STOMPS / 2)
        body.location.z = 0.12 * abs(math.sin(math.pi * t * STOMPS))
        body.rotation_euler = (0.1 + 0.05 * abs(swing), 0.08 * swing,
                               0.25 * math.sin(4 * math.pi * t * STOMPS))
        body.keyframe_insert("location", frame=frame)
        body.keyframe_insert("rotation_euler", frame=frame)
        for part, sign in zip(legs, (1, -1)):
            part.rotation_euler.x = 0.45 * sign * swing
            part.keyframe_insert("rotation_euler", frame=frame)
        for part, sign in zip(arms, (-1, 1)):
            part.rotation_euler.x = 0.6 * sign * swing - 0.3
            part.rotation_euler.y = sign * 0.2
            part.keyframe_insert("rotation_euler", frame=frame)
