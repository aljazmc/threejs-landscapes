from shooter import box, button_grid, clear_scene, cylinder, gauge, joint, ship_materials

EXPORT = "glb"

# Instrument rack standing against a wall (its back at +Y), 2 m wide and
# 2.4 m tall: dials, oscilloscope screens, switch banks, levers and blinking
# indicator rows.


def rack():
    clear_scene()
    m = ship_materials()
    box("Cabinet", (1.96, 0.5, 2.4), m["hull"], location=(0, 0.2, 1.2), bevel=0.03)
    box("Plinth", (1.9, 0.45, 0.1), m["black"], location=(0, 0.17, 0.05))
    front = joint("Front", location=(0, -0.06, 0))
    front.rotation_euler = (1.5708, 0, 0)  # +Z of the panels now faces -Y
    for index, z in enumerate((2.05, 1.45)):
        for column, x in enumerate((-0.55, 0.0, 0.55)):
            box(f"Bay {index} {column}", (0.5, 0.5, 0.02), m["dark"], front, (x, z, 0))
    for column, x in enumerate((-0.55, 0.0, 0.55)):
        gauge(f"Dial {column}", 0.15, m["black"], m["red"], front, (x, 2.05, 0.015),
              angle=-40 + 35 * column)
        box(f"Scope {column}", (0.42, 0.3, 0.012), (m["screen2"], m["screen"], m["screen3"])[column],
            front, (x, 1.48, 0.015))
        for line in range(3):
            box(f"Trace {column} {line}", (0.34 - 0.08 * line, 0.012, 0.004),
                (m["green"], m["cyan"], m["magenta"])[(column + line) % 3], front,
                (x, 1.4 + 0.07 * line, 0.025), rotation=(0, 0, 8 * (line - 1)))
    button_grid("Switches", 12, 3, 0.13, 0.06,
                [m["amber"], m["dark"], m["green"], m["cyan"], m["red"]], front, (0, 0.95, 0.0))
    for index, x in enumerate((-0.7, -0.45, 0.45, 0.7)):
        lever = joint(f"Lever {index}", front, (x, 0.55, 0.0))
        lever.rotation_euler = (0.4 if index % 2 else -0.3, 0, 0)
        cylinder(f"Lever Rod {index}", 0.015, 0.22, m["light"], lever,
                 rotation=(0, 0, 0))
        box(f"Lever Knob {index}", (0.06, 0.06, 0.05), m["red" if index % 2 else "magenta"],
            lever, (0, 0, 0.23))
    button_grid("Indicators", 20, 2, 0.08, 0.035,
                [m["cyan"], m["magenta"], m["dark"], m["green"]], front, (0, 0.28, 0.0))
    box("Neon Top", (1.9, 0.03, 0.03), m["magenta"], location=(0, -0.06, 2.37))
