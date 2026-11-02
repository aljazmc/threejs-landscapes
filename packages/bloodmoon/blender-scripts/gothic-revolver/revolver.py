import math

from gothic import gothic_materials
from shooter import box, clear_scene, cylinder, joint, sphere, torus

EXPORT = "glb"

# The hunter's revolver in first person, the barrel along -Y: a long
# engraved Victorian six-shooter of blued steel and brass with a walnut
# grip, loaded with silver bullets. The game turns the "Drum" (the cylinder,
# around the barrel's axis) by a chamber after each shot and puts the
# muzzle flash at "Muzzle". The origin is at the grip.


def revolver():
    clear_scene()
    m = gothic_materials()
    steel = m["iron"]
    box("Frame", (0.03, 0.12, 0.06), steel, location=(0, -0.02, 0.05), bevel=0.008)
    box("Top Strap", (0.026, 0.09, 0.012), steel, location=(0, -0.03, 0.093), bevel=0.004)
    cylinder("Barrel", 0.012, 0.24, steel, location=(0, -0.08, 0.075), rotation=(90, 0, 0), sides=12)
    cylinder("Rib", 0.006, 0.24, steel, location=(0, -0.08, 0.088), rotation=(90, 0, 0), sides=6)
    cylinder("Ejector", 0.006, 0.17, steel, location=(0.012, -0.08, 0.06), rotation=(90, 0, 0), sides=6)
    torus("Muzzle Ring", 0.012, 0.003, m["brass"], location=(0, -0.32, 0.075), rotation=(90, 0, 0),
          segments=12, sides=4)
    box("Front Sight", (0.004, 0.015, 0.01), m["brass"], location=(0, -0.31, 0.093))
    drum = joint("Drum", location=(0, -0.02, 0.06))
    drum.rotation_euler = (math.radians(90), 0, 0)
    cylinder("Cylinder", 0.03, 0.06, steel, drum, (0, 0, -0.03), sides=12)
    for index in range(6):
        a = 2 * math.pi * index / 6
        cylinder(f"Flute {index}", 0.006, 0.05, m["marble"], drum,
                 (0.031 * math.cos(a + math.pi / 6), 0.031 * math.sin(a + math.pi / 6), -0.025), sides=6)
        sphere(f"Bullet {index}", 0.007, m["silver"], drum,
               (0.018 * math.cos(a), 0.018 * math.sin(a), 0.032), scale=(1, 1, 0.4), subdivisions=1)
    box("Hammer", (0.012, 0.025, 0.03), steel, location=(0, 0.045, 0.09), rotation=(-30, 0, 0), bevel=0.003)
    box("Trigger Guard", (0.008, 0.05, 0.005), m["brass"], location=(0, 0.0, 0.0))
    box("Trigger", (0.006, 0.006, 0.025), steel, location=(0, 0.0, 0.015), rotation=(15, 0, 0))
    grip = joint("Grip", location=(0, 0.05, 0.02))
    grip.rotation_euler = (math.radians(-20), 0, 0)
    box("Walnut", (0.032, 0.04, 0.11), m["oak"], grip, (0, 0.0, -0.055), bevel=0.01)
    box("Butt", (0.034, 0.045, 0.01), m["brass"], grip, (0, 0.0, -0.112), bevel=0.003)
    sphere("Medallion", 0.008, m["silver"], grip, (0.017, 0, -0.04), scale=(0.3, 1, 1))
    for k in range(3):
        box(f"Engraving {k}", (0.032, 0.02, 0.002), m["brass"], location=(0, -0.05 - 0.02 * k, 0.06),
            rotation=(0, 0, 0))
    joint("Muzzle", location=(0, -0.33, 0.075))
