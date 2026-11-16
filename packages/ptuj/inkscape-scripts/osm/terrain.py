"""Makes the terrain of the Ptuj app: the height of the ground on a grid of
points over the municipality, from the elevation tiles of Mapzen's Terrain
Tiles (Terrarium PNGs on AWS Open Data), into ../../src/map/terrain.json.

    python3 terrain.py <data directory> <map json> <terrain json>

The tiles are kept in <data directory>/terrain and fetched only once. The
grid runs in the map's meters east (x) and north (y) of the town hall, as
geo.project has them; it covers the outline of the map in <map json> and a
margin round it.

Elevation: Europe terrain data produced using Copernicus data and
information funded by the European Union - EU-DEM layers; SRTM and
GMTED2010 terrain data courtesy of the U.S. Geological Survey; Mapzen.
"""
import base64
import json
import math
import os
import struct
import sys
import time
import urllib.request

from PIL import Image

from geo import KX, KY, LAT0, LON0

AGENT = "threejs-landscapes (github.com/aljazmc/threejs-landscapes)"
TILES = ("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/"
         "{z}/{x}/{y}.png")
ZOOM = 13  # some 13 m a pixel at Ptuj, finer than the grid
STEP = 50  # meters between the points of the grid
MARGIN = 1000  # meters of ground round the outline
SOURCE = ("Mapzen Terrain Tiles; EU-DEM (Copernicus, European Union); "
          "SRTM and GMTED2010 (U.S. Geological Survey)")


def unproject(x, y):
    return (LON0 + x / KX, LAT0 + y / KY)


def pixel(lon, lat):
    """The place of a point in the pixels of the whole world at ZOOM."""
    n = 256 * 2 ** ZOOM
    s = math.sin(math.radians(lat))
    return ((lon + 180) / 360 * n,
            (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n)


def get(url):
    request = urllib.request.Request(url, None, {"User-Agent": AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except OSError as error:
            print(error, file=sys.stderr)
        time.sleep(2 * 2 ** attempt)
    raise RuntimeError(f"no tile from {url}")


class Tiles:
    """The elevation of the world's pixels at ZOOM, from the tiles."""

    def __init__(self, directory):
        self.directory = os.path.join(directory, "terrain")
        os.makedirs(self.directory, exist_ok=True)
        self.tiles = {}

    def tile(self, tx, ty):
        if (tx, ty) not in self.tiles:
            path = os.path.join(self.directory, f"{ZOOM}-{tx}-{ty}.png")
            if not os.path.exists(path):
                body = get(TILES.format(z=ZOOM, x=tx, y=ty))
                with open(path, "wb") as file:
                    file.write(body)
                print("fetched", os.path.basename(path))
            self.tiles[(tx, ty)] = Image.open(path).convert("RGB").load()
        return self.tiles[(tx, ty)]

    def at(self, px, py):
        """Meters above the sea at a whole pixel: Terrarium keeps them as
        red * 256 + green + blue / 256 - 32768."""
        r, g, b = self.tile(px // 256, py // 256)[px % 256, py % 256]
        return r * 256 + g + b / 256 - 32768

    def height(self, lon, lat):
        """Bilinear between the four pixels round a point."""
        fx, fy = pixel(lon, lat)
        fx, fy = fx - 0.5, fy - 0.5  # pixel centers
        x0, y0 = math.floor(fx), math.floor(fy)
        tx, ty = fx - x0, fy - y0
        top = (self.at(x0, y0) * (1 - tx) + self.at(x0 + 1, y0) * tx)
        bottom = (self.at(x0, y0 + 1) * (1 - tx)
                  + self.at(x0 + 1, y0 + 1) * tx)
        return top * (1 - ty) + bottom * ty


def main(directory, source, target):
    with open(source) as file:
        outline = json.load(file)["outline"]
    xs, ys = outline[0::2], outline[1::2]
    x0 = math.floor((min(xs) - MARGIN) / STEP) * STEP
    y0 = math.floor((min(ys) - MARGIN) / STEP) * STEP
    columns = math.ceil((max(xs) + MARGIN - x0) / STEP) + 1
    rows = math.ceil((max(ys) + MARGIN - y0) / STEP) + 1

    tiles = Tiles(directory)
    heights = [tiles.height(*unproject(x0 + c * STEP, y0 + r * STEP))
               for r in range(rows) for c in range(columns)]
    base = math.floor(min(heights))
    # decimeters above the lowest point, as little endian 16 bit integers
    packed = struct.pack(f"<{len(heights)}H",
                         *(round((h - base) * 10) for h in heights))
    terrain = {
        "source": SOURCE,
        "step": STEP,
        "x0": x0,
        "y0": y0,
        "columns": columns,
        "rows": rows,
        "base": base,
        "heights": base64.b64encode(packed).decode(),
    }
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w") as file:
        json.dump(terrain, file, indent=4)
        file.write("\n")
    print(f"wrote {target}: {columns} x {rows} points, "
          f"{base} to {max(heights):.0f} m")


if __name__ == "__main__":
    main(*sys.argv[1:])
