import os
import sys
import tempfile

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from shooter import bake_palette, merge_model

# Projects declaring EXPORT = "glb" build a model instead of a sheet. It is
# written as binary glTF with Blender's axes (Z up, no conversion to glTF's
# Y up), its meshes merged per animated joint and its palette image
# embedded, so src/res/<theme>-<name>.glb is the whole model.
_, output = load_project("src/res")

with tempfile.TemporaryDirectory() as tmp:
    bake_palette(os.path.join(tmp, "palette.png"))
    merge_model()
    for image in bpy.data.images:
        image.pack()
    bpy.ops.export_scene.gltf(
        filepath=output + ".glb",
        export_format='GLB',
        export_yup=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        use_selection=False,
    )
