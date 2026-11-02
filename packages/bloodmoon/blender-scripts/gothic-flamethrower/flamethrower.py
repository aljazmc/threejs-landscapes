import math

from gothic import gothic_materials
from shooter import box, clear_scene, cylinder, joint, sphere, torus, tube

EXPORT = "glb"

# The hunter's steampunk flamethrower in first person, its nozzle along -Y:
# a brass fuel tank under the arm with a pressure gauge, copper coils, a
# riveted barrel ending in a flared nozzle with a pilot light, and valve
# wheels. The pilot flames ("Flame n") flicker in the game, "Spin" valve
# wheels turn while it fires and "Muzzle" is where the fire comes out.


def flamethrower():
    clear_scene()
    m = gothic_materials()
    brass, copper, iron = m["brass"], m["copper"], m["iron"]
    cylinder("Tank", 0.07, 0.38, brass, location=(0.0, 0.17, -0.07), rotation=(90, 0, 0), sides=16)
    for y in (-0.21, 0.17):
        sphere(f"Tank End {y}", 0.07, brass, location=(0.0, y, -0.07), scale=(1, 0.5, 1))
    for y in (-0.15, 0.0, 0.12):
        torus(f"Tank Band {y}", 0.072, 0.006, iron, location=(0.0, y, -0.07), rotation=(90, 0, 0),
              segments=16, sides=4)
    cylinder("Gauge", 0.03, 0.02, brass, location=(0.075, 0.05, -0.04), rotation=(0, 90, 0), sides=16)
    cylinder("Gauge Face", 0.025, 0.004, m["ivory"], location=(0.095, 0.05, -0.04), rotation=(0, 90, 0), sides=16)
    box("Gauge Needle", (0.002, 0.003, 0.02), m["velvet"], location=(0.1, 0.05, -0.035), rotation=(30, 0, 0))
    cylinder("Barrel", 0.025, 0.4, iron, location=(0, -0.05, 0.05), rotation=(90, 0, 0), sides=12)
    for k in range(5):
        torus(f"Rivet Band {k}", 0.026, 0.004, brass, location=(0, -0.08 - 0.07 * k, 0.05), rotation=(90, 0, 0),
              segments=12, sides=4)
    cylinder("Nozzle", 0.025, 0.08, brass, location=(0, -0.45, 0.05), rotation=(90, 0, 0), top=0.045, sides=12)
    torus("Nozzle Lip", 0.045, 0.006, copper, location=(0, -0.53, 0.05), rotation=(90, 0, 0), segments=16,
          sides=4)
    # copper coil from the tank around the barrel
    coil = [(0.035 * math.cos(t * 0.9), -0.02 - 0.03 * t, 0.05 + 0.035 * math.sin(t * 0.9)) for t in range(12)]
    tube("Coil", [(0.04, 0.0, -0.02)] + coil, 0.006, copper, sides=5)
    tube("Hose", [(-0.05, 0.1, -0.05), (-0.06, 0.0, 0.0), (-0.03, -0.1, 0.04), (-0.02, -0.25, 0.05)], 0.01,
         m["leather"], sides=6)
    cylinder("Pilot Pipe", 0.006, 0.12, copper, location=(0, -0.42, 0.01), rotation=(90, 0, 0), sides=6)
    for index, (x, h) in enumerate(((0.0, 0.025), (0.008, 0.018))):
        flame = joint(f"Flame {index}", location=(x, -0.545, 0.012))
        sphere(f"Pilot {index}", 0.008, m["fire"], flame, (0, 0, h / 2), scale=(1, 1, h / 0.008))
    valve = joint("Spin+ Valve", location=(0.04, -0.02, 0.09))
    valve.rotation_euler = (0, math.radians(90), 0)
    torus("Valve Wheel", 0.025, 0.004, m["velvet"], valve, segments=14, sides=4)
    for k in range(3):
        box(f"Spoke {k}", (0.05, 0.004, 0.004), m["velvet"], valve, rotation=(0, 0, 60 * k))
    box("Grip", (0.025, 0.035, 0.1), m["oak"], location=(0, 0.06, -0.01), rotation=(-15, 0, 0), bevel=0.008)
    box("Fore Grip", (0.025, 0.03, 0.08), m["oak"], location=(0, -0.25, 0.0), rotation=(10, 0, 0), bevel=0.008)
    box("Trigger", (0.006, 0.008, 0.025), iron, location=(0, 0.02, 0.01), rotation=(15, 0, 0))
    joint("Muzzle", location=(0, -0.55, 0.05))
