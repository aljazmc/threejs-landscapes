from shooter import box, clear_scene, cylinder, material, ship_materials

EXPORT = "glb"

# Two-level bunk bed, 2.6 m long (along X), against a wall at +Y, its open
# side towards -Y.


def bunk():
    clear_scene()
    m = ship_materials()
    blanket = material("Blanket", "#5a2a6a", 0.95)
    sheet = material("Sheet", "#c8ccd8", 0.9)
    for z in (0.35, 1.35):
        box("Frame", (2.6, 0.95, 0.12), m["hull"], location=(0, 0.05, z), bevel=0.02)
        box("Mattress", (2.45, 0.85, 0.14), sheet, location=(0, 0.05, z + 0.13), bevel=0.04)
        box("Blanket", (1.7, 0.88, 0.05), blanket, location=(0.35, 0.05, z + 0.2), bevel=0.02)
        box("Pillow", (0.4, 0.6, 0.12), sheet, location=(-1.0, 0.05, z + 0.24), bevel=0.05)
        box("Reading Light", (0.3, 0.04, 0.03), m["amber"], location=(-0.95, 0.47, z + 0.75))
    for x in (-1.28, 1.28):
        for y in (-0.42, 0.52):
            box("Post", (0.06, 0.06, 2.1), m["dark"], location=(x, y, 1.05))
    box("Ladder Left", (0.04, 0.04, 1.4), m["light"], location=(0.85, -0.45, 0.95))
    box("Ladder Right", (0.04, 0.04, 1.4), m["light"], location=(1.2, -0.45, 0.95))
    for z in (0.7, 1.0, 1.25, 1.55):
        box("Rung", (0.36, 0.03, 0.03), m["light"], location=(1.025, -0.45, z))
    box("Under Neon", (2.4, 0.02, 0.02), m["violet"], location=(0, -0.42, 0.27))
    cylinder("Rail", 0.02, 1.6, m["light"], location=(-0.8, -0.42, 1.75),
             rotation=(0, 90, 0))
