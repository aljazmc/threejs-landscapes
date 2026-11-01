#!/bin/bash

## Makes the map of the Ptuj app from OpenStreetMap data, into
## ../src/map/ptuj.json, where it is committed, so the builds (and CI) only
## copy it into dist/map, e.g. ./project.sh all
##
## The landmark icons in ../src/icons are SVG drawn for Inkscape; the
## preview draws the map as SVG and has Inkscape export it as the README's
## picture.
##
## Map data © OpenStreetMap contributors, ODbL

cd "$(dirname "$0")" || exit 1

DATA=${OSM_DATA:-osm/data}
MAP=../src/map/ptuj.json

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

preview() {

    require python3
    require inkscape
    mkdir -p build
    python3 osm/preview.py "$MAP" build/preview.svg &&
        inkscape build/preview.svg --export-type=png \
            --export-filename=../screenshot.png

}

usage() {

    echo "You should use: $0 {fetch|map|preview|all|clean}" >&2
    echo "  fetch    downloads the OpenStreetMap data into $DATA" >&2
    echo "  map      makes $MAP from it" >&2
    echo "  preview  draws the map into ../screenshot.png with Inkscape" >&2
    echo "  all      fetch and map" >&2
    echo "  clean    removes the downloaded data and the preview" >&2
    exit 1

}

case "$1" in
    fetch) fetch ;;
    map) map ;;
    preview) preview ;;
    all) fetch && map ;;
    clean) rm -rf "$DATA" build ;;
    *) usage ;;
esac
