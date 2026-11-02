from shooter import box, clear_scene, cylinder, ship_materials, torus, tube

EXPORT = "glb"

# Bundle of pipes, valves and a pressure tank against the wall (+Y), 2 m
# wide and up to the engine room's ceiling.


def pipes():
    clear_scene()
    m = ship_materials()
    for index, (x, radius, mat) in enumerate(((-0.7, 0.12, "brass"), (-0.35, 0.08, "rust"),
                                               (0.0, 0.15, "hull"), (0.4, 0.1, "brass"),
                                               (0.75, 0.07, "light"))):
        cylinder(f"Pipe {index}", radius, 7.0, m[mat], location=(x, 0.25, 0), sides=10)
        for z in (1.0, 3.0, 5.0):
            torus(f"Flange {index} {z}", radius + 0.02, 0.025, m["dark"],
                  location=(x, 0.25, z), segments=12, sides=4)
    tube("Bend", [(-0.7, 0.25, 2.2), (-0.7, -0.15, 2.2), (0.4, -0.15, 2.2), (0.4, 0.25, 2.2)],
         0.08, m["brass"], sides=8)
    cylinder("Tank", 0.35, 1.2, m["hull"], location=(0.1, -0.15, 0.1), sides=16)
    torus("Tank Neon", 0.36, 0.02, m["cyan"], location=(0.1, -0.15, 0.9), sides=4)
    for index, (x, z) in enumerate(((-0.7, 1.5), (0.4, 1.5), (0.0, 4.0))):
        cylinder(f"Valve Stem {index}", 0.03, 0.25, m["dark"], None, (x, 0.0, z),
                 rotation=(90, 0, 0))
        torus(f"Valve Wheel {index}", 0.12, 0.02, m["red"], None, (x, -0.25, z),
              rotation=(90, 0, 0), segments=12, sides=4)
    box("Gauge Box", (0.25, 0.1, 0.25), m["dark"], location=(-0.35, 0.1, 1.6))
    box("Gauge Light", (0.15, 0.02, 0.06), m["green"], location=(-0.35, 0.04, 1.65))
