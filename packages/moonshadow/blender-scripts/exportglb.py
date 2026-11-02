import bpy
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from shooter import merge_model

# Projects declaring EXPORT = "glb" build a model instead of a sheet. As in
# blender-scripts' exportglb.py, it is written as binary glTF, which the game
# engine imports with its materials; its meshes are first merged per
# animated joint.
_, output = load_project("src/res")

merge_model()
bpy.ops.export_scene.gltf(
    filepath=output + ".glb",
    export_format="GLB",
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_yup=True,
)
