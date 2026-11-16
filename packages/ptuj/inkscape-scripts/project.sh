#!/bin/bash

## Makes the map of the Ptuj app from OpenStreetMap data, into
## ../src/map/ptuj.json, where it is committed, so the builds (and CI) only
## copy it into dist/map, e.g. ./project.sh all
##
## The preview records the app itself (a development build in ../dist, from
## yarn b:ptuj) in headless Firefox, close up over the old town, into the
## README's animated ../preview.gif.
##
## fetch also downloads the Employment Service of Slovenia's list of
## employers banned from employing foreigners; map marks the places it
## names (matched by address and name, see osm/bans.py).
##
## The height of the ground goes into ../src/map/terrain.json, also
## committed, from Mapzen's Terrain Tiles (EU-DEM, SRTM, GMTED2010).
##
## Map data © OpenStreetMap contributors, ODbL

cd "$(dirname "$0")" || exit 1

DATA=${OSM_DATA:-osm/data}
MAP=../src/map/ptuj.json
TERRAIN=../src/map/terrain.json

require() {

    local bin
    if bin=$(command -v "$1"); then
        echo "$1 found at: $bin"
    else
        echo "$1 is required but was not found" >&2
        exit 1
    fi

}

fetch() {

    require python3
    python3 osm/fetch.py "$DATA"

}

map() {

    require python3
    python3 osm/ptujmap.py "$DATA"

}

terrain() {

    require python3
    python3 -c "import PIL" || {
        echo "Pillow (python3-pil) is required but was not found" >&2
        exit 1
    }
    python3 osm/terrain.py "$DATA" "$MAP" "$TERRAIN"

}

preview() {

    require python3
    require firefox
    require ffmpeg
    python3 osm/record.py ../dist ../preview.gif

}

usage() {

    echo "You should use: $0 {fetch|map|terrain|preview|all|clean}" >&2
    echo "  fetch    downloads the OpenStreetMap data into $DATA" >&2
    echo "  map      makes $MAP from it" >&2
    echo "  terrain  makes $TERRAIN from elevation tiles" >&2
    echo "  preview  records the app into ../preview.gif with Firefox" >&2
    echo "  all      fetch, map and terrain" >&2
    echo "  clean    removes the downloaded data" >&2
    exit 1

}

case "$1" in
    fetch) fetch ;;
    map) map ;;
    terrain) terrain ;;
    preview) preview ;;
    all) fetch && map && terrain ;;
    clean) rm -rf "$DATA" build ;;
    *) usage ;;
esac
