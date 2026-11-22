import bpy
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project

sheet, output = load_project("blend")

# the scene as it is posed for the first cell of the sheet (models have none)
if sheet is not None:
    sheet.rows[0][0]()
bpy.ops.wm.save_as_mainfile(filepath=output + ".blend")
