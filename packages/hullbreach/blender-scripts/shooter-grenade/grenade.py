from shooter import clear_scene, cylinder, material, ship_materials, sphere, torus

EXPORT = "glb"

# The grenade in flight: a 40 mm shell with a glowing tip and band, flying
# along -Y.


def grenade():
    clear_scene()
    m = ship_materials()
    shell = material("Shell", "#5a5f3a", 0.5, 0.5)
    cylinder("Case", 0.025, 0.06, shell, location=(0, 0.0, 0), rotation=(90, 0, 0), sides=10)
    sphere("Nose", 0.025, m["magenta"], location=(0, -0.06, 0), scale=(1, 1.4, 1),
        subdivisions=1)
    torus("Band", 0.026, 0.006, m["amber"], location=(0, -0.02, 0), rotation=(90, 0, 0),
       segments=12, sides=4)
