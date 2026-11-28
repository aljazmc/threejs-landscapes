#!/bin/bash

## Checks that the scripts refuse wrong and missing input: each row of the
## table runs a command from the root of the repository and expects its exit
## code and a part of what it prints. Nothing is built, fetched or rendered:
## the commands that would run a tool run with a PATH that has none
## ($BARE), and the root project.sh runs from a copy without node_modules
## ($WORK). Run it from anywhere: tests/sh/wrong-input.sh

cd "$(dirname "$(readlink -f "$0")")/../.." || exit 1

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export WORK BARE="env PATH=$WORK/bin"

# only what the scripts need before they look for their tools
mkdir "$WORK/bin"
for tool in basename bash dirname find id readlink sort; do
    ln -s "$(command -v "$tool")" "$WORK/bin/$tool"
done
cp project.sh "$WORK/project.sh"

# exit code | a part of the output | command
TABLE=$(cat << 'EOF'
1|usage: ./project.sh clean|./project.sh
1|usage: ./project.sh clean|./project.sh nosuch
1|usage: ./project.sh clean|./project.sh ls -la
1|playwright is not installed|cd "$WORK" && ./project.sh e2e --project=ptuj
1|usage: ./project.sh graphics | audio|packages/bloodmoon/project.sh
1|usage: ./project.sh graphics | audio|packages/bloodmoon/project.sh render
1|bloodmoon has no pillow-scripts/font.py|packages/bloodmoon/project.sh font x.fnt
1|usage: ./project.sh graphics | audio | font <font.fnt>|packages/hullbreach/project.sh
1|usage: ./project.sh font <font.fnt|packages/hullbreach/project.sh font
1|usage: ./project.sh font <font.fnt|packages/hullbreach/project.sh font missing.fnt
1|THEME and MAP are not set|env -u THEME -u MAP shooter-scripts/project.sh graphics
1|blender is required|$BARE packages/moonshadow/project.sh graphics
1|python3 is required|$BARE packages/moonshadow/project.sh audio
1|You should use:|packages/ptuj/inkscape-scripts/project.sh
1|You should use:|packages/ptuj/inkscape-scripts/project.sh nosuch
1|python3 is required but was not found|$BARE packages/ptuj/inkscape-scripts/project.sh fetch
1|python3 is required but was not found|$BARE packages/ptuj/inkscape-scripts/project.sh terrain
1|python3 is required but was not found|$BARE packages/ptuj/inkscape-scripts/project.sh preview
1|nosuch has no tests/py/unit|python3 pytests.py nosuch
1|0 of 2 packages passed|python3 pytests.py nosuch other
EOF
)

count=0 failed=0
while IFS='|' read -r status expected command; do
    # the "|" of the usage lines: the expected output is all but the last field
    while [[ "$command" == *"|"* ]]; do
        expected="$expected|${command%%|*}"
        command=${command#*|}
    done
    count=$((count + 1))
    output=$(bash -c "$command" 2>&1 < /dev/null)
    code=$?
    if [[ "$code" -eq "$status" && "$output" == *"$expected"* ]]; then
        echo "ok   $command"
    else
        failed=$((failed + 1))
        echo "FAIL $command"
        echo "     expected exit code $status and: $expected"
        echo "     got exit code $code and:"
        while IFS= read -r line; do echo "       $line"; done <<< "$output"
    fi
done <<< "$TABLE"

echo "$((count - failed)) of $count passed"
[[ "$failed" -eq 0 ]]
