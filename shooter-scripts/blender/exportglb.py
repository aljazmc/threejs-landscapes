import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project  # isort: split

# after common, which puts the package's blender-scripts first on the path
import shooter

# Projects declaring EXPORT = "glb" build a model instead of a sheet. It is
# written as binary glTF, which the game engine imports with its materials;
# its meshes are first merged per animated joint. A package's own
# shooter.py may export its models its own way with export_glb(output), as
# hullbreach's does to bake their colors into a palette image.
_, output = load_project("src/res")

if hasattr(shooter, "export_glb"):
    shooter.export_glb(output)
else:
    shooter.merge_model()
    bpy.ops.export_scene.gltf(
        filepath=output + ".glb",
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
    )
