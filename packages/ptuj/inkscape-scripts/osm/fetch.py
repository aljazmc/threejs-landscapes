"""Downloads the OpenStreetMap data ptujmap.py reads into a directory: the
outline of the municipality from Nominatim and the rest from Overpass.

    python3 fetch.py <directory>

Map data © OpenStreetMap contributors, available under the Open Database
License (ODbL): https://www.openstreetmap.org/copyright
"""
import os
import sys
import time
import urllib.parse
import urllib.request

AGENT = "threejs-landscapes (github.com/aljazmc/threejs-landscapes)"
NOMINATIM = ("https://nominatim.openstreetmap.org/lookup?osm_ids=R1676350"
             "&format=geojson&polygon_geojson=1&polygon_threshold=0.0005")
OVERPASS = "https://overpass-api.de/api/interpreter"
BOX = "46.38,15.77,46.50,15.95"
QUERIES = {
    "sub.json": """[out:json][timeout:170];rel(1676350);map_to_area->.m;
        (rel(area.m)[boundary];node(area.m)[place];);out tags center;""",
    "lines.json": f"""[out:json][timeout:170][bbox:{BOX}];
        (way[railway=rail];
         way[highway~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link)$"];
         way[waterway~"river|stream|canal"];way[natural=water];
         rel[natural=water];node[railway~"station|halt"];);out geom;""",
    "town.json": """[out:json][timeout:170][bbox:46.405,15.845,46.435,15.90];
        (way[bridge=yes];nwr[historic];nwr[amenity=townhall];
         nwr[leisure~"stadium|park"];);out geom;""",
    "pois.json": """[out:json][timeout:170];rel(1676350);map_to_area->.m;
        (nwr(area.m)[amenity~"^(school|kindergarten|college|university|hospital|clinic|doctors|pharmacy|restaurant|bar|cafe|pub|fast_food|biergarten|police|fire_station|post_office|library|courthouse|theatre|cinema|townhall|community_centre|arts_centre)$"];
         nwr(area.m)[tourism=museum];
         nwr(area.m)[healthcare~"^(hospital|centre|clinic)$"];
         nwr(area.m)[office=government];);out center tags;""",
    "minor.json": f"""[out:json][timeout:170][bbox:{BOX}];
        (way[highway~"^(residential|unclassified|living_street|pedestrian)$"];
         way[place=square];way[leisure~"^(park|stadium)$"];
         way[landuse~"^(vineyard|forest|orchard)$"];way[natural=wood];);
        out geom;""",
}


def get(url, data=None):
    request = urllib.request.Request(url, data, {"User-Agent": AGENT,
                                                 "Accept": "*/*"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=200) as response:
                body = response.read()
            if body.lstrip()[:1] in (b"{", b"["):
                return body
        except OSError as error:
            print(error, file=sys.stderr)
        time.sleep(10 * 2 ** attempt)  # the public servers are often busy
    raise RuntimeError(f"no data from {url}")


def main(directory):
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, "muni.geojson"), "wb") as file:
        file.write(get(NOMINATIM))
    for name, query in QUERIES.items():
        body = urllib.parse.urlencode({"data": query}).encode()
        with open(os.path.join(directory, name), "wb") as file:
            file.write(get(OVERPASS, body))
        print("fetched", name)


if __name__ == "__main__":
    main(sys.argv[1])
