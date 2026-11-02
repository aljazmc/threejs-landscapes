import os

from shipmap import layout

# Writes the ship layout for the game: one line per row of cells, then the
# props and the start positions.
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root_dir, "src", "res"), exist_ok=True)
with open(os.path.join(root_dir, "src", "res", "shooter-map.txt"), "w") as file:
    file.write("\n".join(layout()) + "\n")
