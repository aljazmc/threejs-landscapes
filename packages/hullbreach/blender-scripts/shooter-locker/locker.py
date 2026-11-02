from shooter import box, button_grid, clear_scene, ship_materials

EXPORT = "glb"

# Crew locker, 0.9 m wide, door facing -Y, with a keypad and a neon stripe.


def locker():
    clear_scene()
    m = ship_materials()
    box("Body", (0.86, 0.6, 2.1), m["hull"], location=(0, 0.1, 1.05), bevel=0.02)
    for index, x in enumerate((-0.21, 0.21)):
        box(f"Door {index}", (0.4, 0.03, 1.9), m["light"], location=(x, -0.21, 1.05), bevel=0.01)
        for z in (1.75, 1.7, 1.65):
            box(f"Vent {index} {z}", (0.28, 0.01, 0.02), m["dark"], location=(x, -0.23, z))
        box(f"Handle {index}", (0.03, 0.03, 0.2), m["black"], location=(x - 0.15 * (1 if index else -1), -0.24, 1.05))
    button_grid("Keypad", 3, 4, 0.03, 0.022, [m["green"], m["dark"], m["dark"]], None,
                (0.21, -0.23, 1.35), rotation=(90, 0, 0))
    box("Stripe", (0.025, 0.02, 1.9), m["magenta"], location=(0, -0.235, 1.05))
    box("Name Plate", (0.2, 0.01, 0.06), m["cyan"], location=(-0.21, -0.23, 1.5))
