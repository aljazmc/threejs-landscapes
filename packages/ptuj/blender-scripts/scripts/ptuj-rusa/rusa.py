import math

from lowpoly import Builder, clear_scene, empty, setup_scene

# Rusa, the carnival beast of the Ptuj countryside that walks with the
# kurents: two lads under a long blanket hung with ribbons, the one in front
# carrying the wooden head on a pole, with its horns, a snapping jaw, a red
# tongue and a bell under the neck. Its four trousered legs walk in two
# pairs, baked into a looping clip like the kurent's hop. It faces -Y.
FPS = 30
FRAMES = 61  # frame 60 repeats frame 0, so the clip loops seamlessly
STEPS = 2
RIBBONS = ("red", "yellow", "green", "blue", "pink", "red", "yellow")
HIPS = 1.0
LADS = (-0.65, 0.65)  # where the two lads walk under the blanket


def body_mesh():
    b = Builder("Body", seed=3)
    # the blanket over the lads' backs, falling to their knees
    b.ico((0, 0, 1.45), 0.9, "red", 2, scale=(0.75, 1.75, 0.6), jitter=0.04)
    b.box((0, 0, 0.75), (1.25, 2.9, 0.75), "red")
    b.box((0, 0, 0.6), (1.3, 2.95, 0.18), "yellow")
    for side in (-1, 1):
        for i in range(7):
            y = -1.2 + i * 0.4
            b.box((side * 0.66, y, 0.85), (0.05, 0.2, 0.35),
                  ("white", "green")[i % 2])
    # ribbons over the back and a tail
    for i, ribbon in enumerate(RIBBONS):
        y = -0.9 + i * 0.3
        b.box((0, y, 1.92), (1.4, 0.08, 0.05), ribbon, (0.0, 0.2, 0))
    b.cylinder((0, 1.5, 1.4), 0.07, 0.8, "fur", 6, 0.02,
               rotation=(-2.3, 0, 0))
    return b.finish()


def head_mesh(parent):
    """Wooden head on its pole, pivoting at the neck."""
    b = Builder("Head", seed=4)
    b.cylinder((0, 0, -0.5), 0.07, 0.7, "wood_dark", 6)
    b.box((0, -0.25, -0.05), (0.5, 0.75, 0.42), "wood")
    b.box((0, -0.45, 0.17), (0.42, 0.55, 0.12), "wood_dark")
    for x in (-0.18, 0.18):
        b.ico((x, -0.25, 0.32), 0.09, "white", 1)
        b.ico((x, -0.31, 0.33), 0.045, "black", 1)
        # horns with ribbons
        b.cone((x, 0.0, 0.2), 0.08, 0.55, "horn", 6,
               rotation=(0.3, x * 2.5, 0))
        b.box((x * 1.6, 0.05, 0.45), (0.05, 0.05, 0.6), ("red", "blue")[
            x > 0], (0.2, 0, 0))
    for x in (-0.1, 0.1):
        b.box((x, -0.62, 0.0), (0.06, 0.06, 0.08), "white")
    b.cylinder((0, 0.1, -0.55), 0.17, 0.25, "brass", 8, 0.08)
    return b.finish(parent, (0, LADS[0] - 0.85, 1.75))


def jaw_mesh(parent):
    b = Builder("Jaw")
    b.box((0, -0.32, -0.12), (0.44, 0.65, 0.12), "wood")
    b.box((0, -0.4, -0.02), (0.18, 0.5, 0.04), "red")
    for x in (-0.1, 0.1):
        b.box((x, -0.6, -0.02), (0.06, 0.06, 0.08), "white")
    return b.finish(parent, (0, 0.02, -0.05))


def leg(name, side, y, parent):
    b = Builder(name)
    b.cylinder((0, 0, -0.9), 0.12, 0.9, "blue", 6, 0.14)
    b.box((0, -0.07, -0.98), (0.22, 0.36, 0.15), "black")
    return b.finish(parent, (side * 0.22, y, HIPS))


def rusa():
    clear_scene()
    setup_scene(FPS, FRAMES)
    root = empty("Rusa")
    body = body_mesh()
    body.parent = root
    head = head_mesh(body)
    jaw = jaw_mesh(head)
    legs = [(leg(f"Leg{i}{side}", side, y, body), i, side)
            for i, y in enumerate(LADS) for side in (-1, 1)]
    for frame in range(FRAMES):
        t = frame / (FRAMES - 1)
        phase = 2 * math.pi * t * STEPS
        body.location.z = 0.05 * abs(math.sin(phase))
        body.rotation_euler = (0.03 * math.sin(phase), 0,
                               0.04 * math.sin(phase / 2))
        body.keyframe_insert("location", frame=frame)
        body.keyframe_insert("rotation_euler", frame=frame)
        head.rotation_euler = (0.15 * math.sin(phase + 1), 0,
                               0.25 * math.sin(phase / 2))
        head.keyframe_insert("rotation_euler", frame=frame)
        jaw.rotation_euler.x = -0.25 * max(0.0, math.sin(2 * phase))
        jaw.keyframe_insert("rotation_euler", frame=frame)
        # the lads walk out of step with each other
        for part, lad, side in legs:
            swing = math.sin(phase + lad * math.pi / 2)
            part.rotation_euler.x = 0.45 * side * swing
            part.keyframe_insert("rotation_euler", frame=frame)
