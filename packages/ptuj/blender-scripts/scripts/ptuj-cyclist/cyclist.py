import math

from lowpoly import Builder, clear_scene, empty, setup_scene

# A "professional" road cyclist in fluorescent kit on a pink racing bike
# with disc wheels. Its clip holds four loops one after the other, which
# the app cuts apart: pedalling hard (PEDALLING), walking beside the bike
# (WALKING), swimming the crawl (CRAWL) and swimming with one arm while the
# other tows the bike (TOWING). The bike and the rider are separate nodes,
# Bike and Rider, that the clip leaves alone (it only turns the wheels, the
# crank, the arms and the legs), so the app can send them flying on their
# own. His upper body, Torso, bends at the hips: crouched over the bar
# when riding, upright when walking and stretched out straight in the
# water. It faces -Y.
FPS = 30
# first and last frame of each loop, the last repeating the first
PEDALLING = (0, 30)
WALKING = (40, 70)
CRAWL = (80, 110)
TOWING = (120, 150)
SHOULDER = (0.2, -0.15, 1.42)
ARM = 2.5  # the arms' slope down to the handlebar, from straight up
SPINE = 1.0  # how far the riding crouch bends the back forward
WHEEL = 0.36
BASE = 0.5  # half the wheelbase
HIP = (0, 0.32, 1.12)
CRANK = (0, 0.02, WHEEL)
PEDAL_ARM = 0.17


def wheel(name, y, parent):
    b = Builder(name)
    axis = (0, math.pi / 2, 0)
    b.cylinder((-0.03, 0, 0), WHEEL, 0.06, "black", 16, rotation=axis)
    b.cylinder((-0.035, 0, 0), WHEEL - 0.05, 0.07, "stone_dark", 16,
               rotation=axis)
    b.cylinder((-0.05, 0, 0), 0.05, 0.1, "fluo_yellow", 8, rotation=axis)
    return b.finish(parent, (0, y, WHEEL))


def bike_mesh(parent):
    b = Builder("Bike")
    pink = "fluo_pink"
    seat = (0, 0.3, 0.98)
    head = (0, -0.38, 0.92)

    def tube(a, c, radius=0.035, mat=pink):
        dx, dy, dz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        length = math.sqrt(dx * dx + dy * dy + dz * dz)
        tilt = math.acos(dz / length)
        heading = math.atan2(dx, -dy)
        b.cylinder(a, radius, length, mat, 6, rotation=(tilt, 0, heading))

    rear = (0, BASE, WHEEL)
    front = (0, -BASE, WHEEL)
    tube(CRANK, seat)
    tube(seat, head)
    tube(CRANK, head, 0.04)
    tube(CRANK, rear, 0.025)
    tube(seat, rear, 0.025)
    tube(head, front, 0.03, "stone_dark")
    b.box((0, 0.32, 0.98), (0.12, 0.3, 0.05), "black")
    # dropped handlebar
    b.box((0, -0.42, 0.95), (0.42, 0.05, 0.05), "black")
    for x in (-0.2, 0.2):
        b.box((x, -0.48, 0.82), (0.04, 0.06, 0.15), "black")
    b.cylinder((0, 0.05, 0.62), 0.04, 0.25, "white", 6, rotation=(0.3, 0, 0))
    return b.finish(parent)


def crank_mesh(parent):
    b = Builder("Crank")
    b.cylinder((-0.06, 0, 0), 0.1, 0.03, "stone_dark", 10,
               rotation=(0, math.pi / 2, 0))
    for x, sign in ((-0.1, 1), (0.1, -1)):
        b.box((x, 0, -0.02 if sign > 0 else -PEDAL_ARM + 0.02),
              (0.03, 0.03, PEDAL_ARM), "stone_dark")
    return b.finish(parent, CRANK)


def rider_mesh(parent):
    """The hips in their shorts; the legs and the torso hang from them."""
    b = Builder("Rider", seed=7)
    b.ico((0, 0.3, 1.12), 0.2, "black", 1, scale=(1.3, 1.1, 0.8))
    return b.finish(parent)


def torso_mesh(parent):
    """The crouched upper body in the jersey with the head, bending at the
    hips."""
    b = Builder("Torso", seed=8)

    def at(x, y, z):
        return (x - HIP[0], y - HIP[1], z - HIP[2])

    b.ico(at(0, 0.12, 1.32), 0.3, "fluo_yellow", 1, scale=(1.0, 1.6, 0.75),
          rotation=(0.5, 0, 0))
    b.box(at(0, -0.05, 1.37), (0.3, 0.5, 0.06), "fluo_pink", (0.5, 0, 0))
    # head with an aero helmet and mirrored glasses
    b.ico(at(0, -0.28, 1.6), 0.15, "skin", 1)
    b.ico(at(0, -0.24, 1.68), 0.17, "fluo_green", 1,
          scale=(0.95, 1.5, 0.75))
    b.cone(at(0, -0.05, 1.69), 0.1, 0.25, "fluo_green", 6,
           rotation=(-1.8, 0, 0))
    b.box(at(0, -0.43, 1.6), (0.24, 0.04, 0.06), "blue")
    b.box(at(0.0, -0.06, 1.6), (0.08, 0.06, 0.05), "white")
    return b.finish(parent, HIP)


def arm(name, side, parent):
    """An arm reaching down to the handlebar, turning at the shoulder."""
    b = Builder(name)
    b.cylinder((0, 0, 0), 0.06, 0.52, "fluo_yellow", 6, rotation=(ARM, 0, 0))
    b.ico((0, -0.52 * math.sin(ARM), 0.52 * math.cos(ARM)), 0.06, "black", 1)
    x, y, z = SHOULDER
    return b.finish(parent, (side * x, y - HIP[1], z - HIP[2]))


def leg(name, side, parent):
    b = Builder(name)
    b.cylinder((0, 0, -0.42), 0.075, 0.42, "black", 6, 0.09)
    b.cylinder((0, -0.02, -0.82), 0.05, 0.42, "skin", 6, 0.07)
    b.box((0, -0.1, -0.88), (0.08, 0.24, 0.07), "white")
    return b.finish(parent, (side * 0.12, HIP[1], HIP[2]))


def cyclist():
    clear_scene()
    setup_scene(FPS, TOWING[1] + 1)
    root = empty("Cyclist")
    bike = bike_mesh(root)
    wheels = [wheel("WheelF", -BASE, bike), wheel("WheelR", BASE, bike)]
    crank = crank_mesh(bike)
    rider = rider_mesh(root)
    torso = torso_mesh(rider)
    legs = [leg("LegL", -1, rider), leg("LegR", 1, rider)]
    arms = [arm("ArmL", -1, torso), arm("ArmR", 1, torso)]
    still = [(0, 0, 0)] * 2

    def loop(frames, pose):
        """Keys the moving parts over a loop; pose gives the turns of the
        wheels, the crank, the back, the legs and the arms at a share of
        it."""
        first, last = frames
        for frame in range(first, last + 1):
            spin, pedals, back, thighs, shoulders = pose(
                2 * math.pi * (frame - first) / (last - first))
            for part in wheels:
                part.rotation_euler.x = spin
            crank.rotation_euler.x = pedals
            torso.rotation_euler.x = back
            for part, turn in zip(legs, thighs):
                part.rotation_euler.x = turn
            for part, turn in zip(arms, shoulders):
                part.rotation_euler = turn
            for part in wheels + [crank, torso] + legs + arms:
                part.keyframe_insert("rotation_euler", frame=frame)

    # crouched, the legs following the pedals round, half a turn apart
    loop(PEDALLING, lambda turn: (
        -turn, -turn, 0,
        [-0.38 + 0.3 * math.sin(turn + offset) for offset in (0, math.pi)],
        still))
    # nearly upright, two steps, the arms lowered to the bar again
    loop(WALKING, lambda turn: (
        0, 0, -0.85 * SPINE,
        [0.45 * math.sin(turn + offset) for offset in (0, math.pi)],
        [(0.65, 0, 0)] * 2))
    # stretched out straight, face down: the arms reach past his head and
    # pull down under him, half a turn apart, while the legs flutter
    flutter = [lambda turn, offset=offset: 0.2 * math.sin(3 * turn + offset)
               for offset in (0, math.pi)]
    loop(CRAWL, lambda turn: (
        0, 0, -SPINE, [kick(turn) for kick in flutter],
        [(turn, 0, 0), (turn + math.pi, 0, 0)]))
    # the right hand holds the bike along his side, the left one swims
    along = SPINE + math.pi - ARM
    loop(TOWING, lambda turn: (
        0, 0, -SPINE, [kick(turn) for kick in flutter],
        [(turn, 0, 0), (along + 0.1 * math.sin(turn), -0.3, 0)]))
