import importlib
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import root_dir

# usage: python3 exportmap.py <module> <theme>
#
# Writes the level's layout for the game, src/res/<theme>-map.txt, from
# layout() of the package's blender-scripts/<module>.py: one line per row of
# cells, then the props and the start positions.
if len(sys.argv) != 3:
    sys.exit("usage: python3 exportmap.py <module> <theme>")
module, theme = sys.argv[1:]
layout = importlib.import_module(module).layout
os.makedirs(os.path.join(root_dir, "src", "res"), exist_ok=True)
with open(os.path.join(root_dir, "src", "res", f"{theme}-map.txt"), "w") as file:
    file.write("\n".join(layout()) + "\n")
