"""Layout of the vampire castle, written to src/res/gothic-map.txt by
exportmap.py for the game, which builds the walls, floors and ceilings from
it and puts the models (blender-scripts/gothic-<name>) where the props list says.
It has three sections: the crypt, the corridor with its bedchambers and
the ballroom.

Cell (x, y) is a 1x1 m square of the floor: x runs along the castle from
the crypt (x = 0) to the ballroom, y across it. The game puts its center
at (x + 0.5, y + 0.5) on the floor.

Cell characters:
    #  wall                  W  wall with a gothic window
    e  crypt floor           h  corridor floor       r  bedchamber floor
    c  ballroom floor        d  doorway (low arch above)
    (space) outside the castle

Prop lines: "<model> <x> <y> <angle> <blocked>". The model stands on the
center of the cell (or between cells with .5 coordinates), turned by angle
degrees counterclockwise from facing -y; blocked is the "x0,y0,x1,y1" box
of cells it fills (inclusive), or "-" when it can be walked through.
Marks: "player <x> <y> <angle>" and "monster <n> <x> <y>".
"""

WIDTH = 84
HEIGHT = 21

FLOORS = "ehrcd"
CEILING = {"e": 7.0, "h": 3.0, "r": 3.0, "c": 4.5, "d": 2.4}

CRYPT = (1, 1, 22, 19)  # interior x0, y0, x1, y1
HALL = (24, 9, 62, 11)
CHAMBERS = 10  # on each side of the hallway
CHAMBER_W = 3  # interior, plus one wall
CHAMBER_DEPTH = 4
BALLROOM = (64, 2, 81, 18)


def layout():
    """The rows of cell characters and the prop lines."""
    grid = [[" "] * WIDTH for _ in range(HEIGHT)]

    def fill(x0, y0, x1, y1, char):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                grid[y][x] = char

    def room(area, char):
        x0, y0, x1, y1 = area
        fill(x0 - 1, y0 - 1, x1 + 1, y1 + 1, "#")
        fill(x0, y0, x1, y1, char)

    room(CRYPT, "e")
    room(BALLROOM, "c")
    room(HALL, "h")
    for x in range(BALLROOM[2] + 1, BALLROOM[2] + 2):
        for y in range(BALLROOM[1] + 3, BALLROOM[3] - 2):
            grid[y][x] = "W"

    props = []
    for side in (-1, 1):  # north chambers (y < hallway) and south ones
        for index in range(CHAMBERS):
            x0 = HALL[0] + index * (CHAMBER_W + 1)
            if side < 0:
                y0, y1 = HALL[1] - 1 - CHAMBER_DEPTH, HALL[1] - 2
                door = HALL[1] - 1
            else:
                y0, y1 = HALL[3] + 2, HALL[3] + 1 + CHAMBER_DEPTH
                door = HALL[3] + 1
            room((x0, y0, x0 + CHAMBER_W - 1, y1), "r")
            grid[door][x0 + 1] = "d"
            # the bed along the outer wall, a wardrobe and a dresser beside the door
            far = y0 if side < 0 else y1
            face = 180 if side < 0 else 0  # beds face the door
            props.append(("bed", x0 + 1.5, far + 0.5, face,
                          (x0, far, x0 + 2, far)))
            near = y1 if side < 0 else y0
            props.append(("wardrobe", x0 + 0.5, near + 0.5, face + 180,
                          (x0, near, x0, near)))
            props.append(("dresser", x0 + 2.5, near + 0.5, face + 180,
                          (x0 + 2, near, x0 + 2, near)))

    # doorways between the sections, as wide as the hallway
    for y in range(HALL[1], HALL[3] + 1):
        grid[y][HALL[0] - 1] = "d"
        grid[y][HALL[2] + 1] = "d"

    # ballroom: the pipe organ under the windows facing the room, chairs and
    # dining tables, bookcases along the walls, suits of armor and the piano
    cx0, cy0, cx1, cy1 = BALLROOM
    mid = (cy0 + cy1 + 1) / 2
    props.append(("organ", cx1 - 2.0, mid, 270, (cx1 - 3, int(mid) - 1, cx1 - 1, int(mid) + 1)))
    for y in (int(mid) - 4, int(mid) + 3):
        props.append(("chair", cx1 - 4.5, y + 0.5, 90, None))
        props.append(("table", cx1 - 3.0, y + 0.5, 90, (cx1 - 4, y, cx1 - 2, y)))
    props.append(("piano", cx0 + 7.0, mid, 0, (cx0 + 6, int(mid) - 1, cx0 + 7, int(mid) + 1)))
    for x in range(cx0 + 1, cx1 - 2, 2):
        props.append(("bookcase", x + 1.0, cy0 + 0.5, 180, (x, cy0, x + 1, cy0)))
        props.append(("bookcase", x + 1.0, cy1 + 0.5, 0, (x, cy1, x + 1, cy1)))
    for y in (cy0 + 3, cy1 - 3):
        props.append(("table", cx0 + 3.0, y + 0.5, 270, (cx0 + 2, y, cx0 + 3, y)))
        props.append(("table", cx0 + 11.0, y + 0.5, 90, (cx0 + 10, y, cx0 + 11, y)))
    props.append(("armor", cx0 + 1.0, cy0 + 2.0, 0, (cx0, cy0 + 1, cx0 + 1, cy0 + 2)))
    props.append(("armor", cx0 + 1.0, cy1 - 1.0, 0, (cx0, cy1 - 2, cx0 + 1, cy1 - 1)))

    # crypt: the blood altar in the middle, tombs and gargoyles around it,
    # candle shelves on the walls and the vampires' coffins in the far corner
    ex0, ey0, ex1, ey1 = CRYPT
    props.append(("altar", ex0 + 12.0, ey0 + 9.5, 0, (ex0 + 10, ey0 + 7, ex0 + 13, ey0 + 11)))
    for x in (ex0 + 6, ex0 + 18):
        props.append(("tomb", x + 0.0, ey0 + 3.0, 180, (x - 2, ey0 + 1, x + 1, ey0 + 4)))
        props.append(("tomb", x + 0.0, ey1 - 2.0, 0, (x - 2, ey1 - 4, x + 1, ey1 - 1)))
    for y in (ey0 + 7, ey0 + 11):
        props.append(("gargoyle", ex0 + 16.0, y + 0.5, 90, (ex0 + 15, y, ex0 + 16, y)))
        props.append(("gargoyle", ex0 + 8.0, y + 0.5, 270, (ex0 + 7, y, ex0 + 8, y)))
    for x in range(ex0 + 9, ex1 - 1, 3):
        props.append(("candles", x + 0.5, ey0 + 0.5, 180, (x, ey0, x + 1, ey0)))
    for y in (ey1 - 1, ey1 - 4, ey1 - 7):
        props.append(("coffin", ex0 + 1.0, y + 0.5, 90, (ex0, y - 1, ex0 + 1, y + 1)))
    props.append(("coffin", ex0 + 4.5, ey1, 0, (ex0 + 3, ey1 - 1, ex0 + 5, ey1)))

    marks = [("player", cx1 - 7.5, mid, 270)]  # facing the corridor
    monsters = [(ex0 + 2.5, ey0 + 5.5), (ex0 + 17.5, ey0 + 9.5), (ex0 + 11.5, ey1 - 1.5),
              (ex0 + 3.5, ey0 + 10.5), (HALL[0] + 6.5, HALL[1] + 1.5),
              (HALL[0] + 21.5, HALL[1] + 0.5), (HALL[0] + 9.5, HALL[1] - 3.5),
              (HALL[0] + 29.5, HALL[3] + 3.5), (cx0 + 3.5, cy0 + 1.5),
              (cx0 + 4.5, cy1 - 1.5)]
    for index, (x, y) in enumerate(monsters):
        marks.append(("monster", index + 1, x, y))

    lines = ["".join(row) for row in grid]
    for name, x, y, angle, blocked in props:
        cells = "-" if blocked is None else ",".join(str(int(v)) for v in blocked)
        lines.append(f"{name} {x:g} {y:g} {angle % 360:g} {cells}")
    for mark in marks:
        lines.append(" ".join(f"{v:g}" if isinstance(v, float) else str(v)
                              for v in mark))
    return lines
