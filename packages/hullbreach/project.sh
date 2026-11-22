#!/bin/bash

## Regenerates the files of src/res on the host with the shared
## shooter-scripts/project.sh: ./project.sh graphics | audio | font <font.fnt>

cd "$(dirname "$(readlink -f "$0")")" || exit 1

export THEME=shooter MAP=shipmap
exec ../../shooter-scripts/project.sh "$@"
