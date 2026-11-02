#!/bin/bash

## Regenerates the files of src/res on the host:
## ./project.sh graphics | audio | font <font.fnt>

cd "$(dirname "$(readlink -f "$0")")" || exit 1

require() {

    for bin in "$@"; do
        if ! command -v "$bin" > /dev/null 2>&1; then
            echo "$bin is required. Exiting..."
            exit 1
        fi
    done

}

graphics() {

    ## Writes src/res/shooter-map.txt and renders blender-scripts/<theme>-<name>/<name>.py
    ## with Blender into src/res/<theme>-<name>.png or, for projects declaring
    ## EXPORT = "glb", into the model src/res/<theme>-<name>.glb
    require blender python3

    echo "Writing src/res/shooter-map.txt"
    python3 blender-scripts/exportmap.py || exit 1

    for project in $(find blender-scripts -mindepth 1 -maxdepth 1 -type d ! -name __pycache__ ! -name '.*' -printf '%f\n' | sort); do
        format=png
        grep -qs '^EXPORT = "glb"' "blender-scripts/$project/${project##*-}.py" && format=glb
        echo "Rendering src/res/$project.$format"
        blender -b --python-exit-code 1 -P blender-scripts/export$format.py -- "$project" > /dev/null || exit 1
    done

}

audio() {

    ## Writes fluidsynth-scripts/<theme>-<name>/<name>.py into src/res/<theme>-<name>.wav
    ## (sound effects synthesized with numpy) or, for projects returning a Song,
    ## src/res/<theme>-<name>.ogg (music played by FluidSynth with a GM soundfont)
    require python3 fluidsynth
    if ! python3 -c "import numpy" > /dev/null 2>&1; then
        echo "python3-numpy is required. Exiting..."
        exit 1
    fi

    for project in $(find fluidsynth-scripts -mindepth 1 -maxdepth 1 -type d ! -name __pycache__ ! -name '.*' -printf '%f\n' | sort); do
        format=wav
        grep -qs 'Song(' "fluidsynth-scripts/$project/${project##*-}.py" && format=ogg
        echo "Writing src/res/$project.$format"
        python3 fluidsynth-scripts/export.py "$project" || exit 1
    done

}

font() {

    ## Writes src/res/shooter-font.fnt and .png: the Pixel Operator pixel font
    ## (12 px, an XML .fnt with its .png atlas beside it), with the Polish and
    ## Slovenian letters it lacks
    require python3
    if ! python3 -c "import PIL" > /dev/null 2>&1; then
        echo "python3 with Pillow is required. Exiting..."
        exit 1
    fi
    if [[ ! -f "$1" || ! -f "${1%.fnt}.png" ]]; then
        echo "usage: ./project.sh font <font.fnt, with its .png beside it>"
        exit 1
    fi

    echo "Writing src/res/shooter-font.fnt"
    python3 pillow-scripts/font.py "$1" shooter || exit 1

}

case "$1" in
    graphics) graphics ;;
    audio) audio ;;
    font) font "$2" ;;
    *) echo "usage: ./project.sh graphics | audio | font <font.fnt>" ;;
esac
