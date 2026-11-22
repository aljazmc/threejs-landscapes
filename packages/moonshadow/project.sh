#!/bin/bash

## Regenerates the files of src/res on the host with the shared
## shooter-scripts/project.sh: ./project.sh graphics | audio

cd "$(dirname "$(readlink -f "$0")")" || exit 1

export THEME=elven MAP=castlemap
exec ../../shooter-scripts/project.sh "$@"
