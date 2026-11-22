import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from shooter import render_sheet

sheet, output = load_project("src/res")

render_sheet(sheet, output + ".png")
