#!/bin/bash

## Regenerates the files of src/res on the host with the shared
## shooter-scripts/project.sh: ./project.sh graphics | audio

cd "$(dirname "$(readlink -f "$0")")" || exit 1

export THEME=gothic MAP=castlemap EFFECTS="ogg wav"
exec ../../shooter-scripts/project.sh "$@"
