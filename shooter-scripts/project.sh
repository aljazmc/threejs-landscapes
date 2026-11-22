#!/bin/bash

## Regenerates the files of a shooter's src/res on the host. Each shooter's
## own project.sh runs it from its package directory with:
##   THEME    the prefix of its projects and files (gothic, elven, shooter)
##   MAP      the module of its blender-scripts with the level's layout()
##   EFFECTS  the formats of its sound effects (default wav; bloodmoon: ogg wav)
## and the command: graphics | audio | font <font.fnt>

SHARED=$(dirname "$(readlink -f "$0")")
PACKAGE=$(basename "$PWD")

# no __pycache__ in the scripts' directories
export PYTHONDONTWRITEBYTECODE=1

if [[ -z "$THEME" || -z "$MAP" ]]; then
    echo "THEME and MAP are not set: run the package's own ./project.sh"
    exit 1
fi

require() {

    for bin in "$@"; do
        if ! command -v "$bin" > /dev/null 2>&1; then
            echo "$bin is required. Exiting..."
            exit 1
        fi
    done

}

require_module() {

    if ! python3 -c "import $1" > /dev/null 2>&1; then
        echo "python3 with $2 is required. Exiting..."
        exit 1
    fi

}

# the projects in a scripts directory: its <theme>-<name> subdirectories
projects() {

    find "$1" -mindepth 1 -maxdepth 1 -type d -name "$THEME-*" -printf '%f\n' | sort

}

graphics() {

    ## Writes src/res/<theme>-map.txt from blender-scripts/<MAP>.py and renders
    ## blender-scripts/<theme>-<name>/<name>.py with Blender into
    ## src/res/<theme>-<name>.png or, for projects declaring EXPORT = "glb",
    ## into the model src/res/<theme>-<name>.glb
    require blender python3

    echo "Writing src/res/$THEME-map.txt"
    python3 "$SHARED/blender/exportmap.py" "$MAP" "$THEME" || exit 1

    for project in $(projects blender-scripts); do
        format=png
        grep -qs '^EXPORT = "glb"' "blender-scripts/$project/${project##*-}.py" && format=glb
        echo "Rendering src/res/$project.$format"
        blender -b --python-exit-code 1 -P "$SHARED/blender/export$format.py" -- "$project" > /dev/null || exit 1
    done

}

audio() {

    ## Writes fluidsynth-scripts/<theme>-<name>/<name>.py into src/res: sound
    ## effects synthesized with numpy as <theme>-<name>.<EFFECTS>, or, for
    ## projects returning a Song, music played by FluidSynth with a GM
    ## soundfont as <theme>-<name>.ogg and .mp3 (for Safari, which decodes no
    ## Ogg Vorbis)
    require python3 fluidsynth ffmpeg
    require_module numpy numpy
    local effects=${EFFECTS:-wav}

    for project in $(projects fluidsynth-scripts); do
        if grep -qs 'Song(' "fluidsynth-scripts/$project/${project##*-}.py"; then
            echo "Writing src/res/$project.ogg and .mp3"
            python3 "$SHARED/fluidsynth/export.py" "$project" || exit 1
            ffmpeg -hide_banner -loglevel error -y -i "src/res/$project.ogg" \
                -c:a libmp3lame -q:a 4 "src/res/$project.mp3" || exit 1
        else
            echo "Writing src/res/$project.${effects// / and .}"
            # shellcheck disable=SC2086 # one argument per format
            python3 "$SHARED/fluidsynth/export.py" "$project" $effects || exit 1
        fi
    done

}

font() {

    ## Writes src/res/<theme>-font.fnt and .png with the package's
    ## pillow-scripts/font.py (hullbreach: the Pixel Operator pixel font with
    ## the Polish and Slovenian letters it lacks)
    if [[ ! -f pillow-scripts/font.py ]]; then
        echo "$PACKAGE has no pillow-scripts/font.py"
        exit 1
    fi
    require python3
    require_module PIL Pillow
    if [[ ! -f "$1" || ! -f "${1%.fnt}.png" ]]; then
        echo "usage: ./project.sh font <font.fnt, with its .png beside it>"
        exit 1
    fi

    echo "Writing src/res/$THEME-font.fnt"
    python3 pillow-scripts/font.py "$1" "$THEME" || exit 1

}

usage() {

    local commands="graphics | audio"
    [[ -f pillow-scripts/font.py ]] && commands="$commands | font <font.fnt>"
    echo "usage: ./project.sh $commands"
    exit 1

}

case "$1" in
    graphics) graphics ;;
    audio) audio ;;
    font) font "$2" ;;
    *) usage ;;
esac
