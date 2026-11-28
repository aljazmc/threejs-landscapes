#!/bin/bash

## Variables

#PROJECT_NAME=`echo ${PWD##*/}` ## PROJECT_NAME = parent directory
PROJECT_UID=$(id -u)
PROJECT_GID=$(id -g)

## Functions

clean() {

    docker compose down -v --rmi all --remove-orphans
    rm -rf \
        coverage \
        node_modules \
        packages/*/dist \
        .cache \
        .yarn/berry \
        .yarn/bin \
        .yarn/cache \
        .yarn/sdks \
        .yarn/unplugged

    find . \( -type f \
        -name "*.d.ts" \
        -o -name "*.js" \
        -o -name "*.jsx" \
        -o -name "*.tsbuildinfo" \
        -o -name ".pnp.loader.mjs" \
        -o -name ".pnp.cjs" \
        -o -name "docker-compose.yml" \
        -o -name "install-state.gz" \
        \) \
        -delete

}


compose() {

if [[ ! -f docker-compose.yml ]]; then
    cat << EOF > docker-compose.yml
services:
    node:
        image: aljazmc/corepack-alpine
        working_dir: $PWD
        volumes:
            - .:$PWD
        environment:
            HOME: $PWD
            NODE_AUTH_TOKEN: npm_000000000000000000000000000000000000
            NODE_ENV: development
            NODE_OPTIONS: "--experimental-vm-modules --no-webstorage"
            NODE_NO_WARNINGS: "1"
            PATH: "$PATH:$HOME/.yarn/releases/"
        network_mode: host
EOF
fi

}

composehack() {

    if  ! grep -q "user" "docker-compose.yml"; then
        echo "Adding user configuration line to docker-compose.yml for GNU/Linux users."
        sed -i "/working_dir\:/{s@^\( \+\)@\1user\: $PROJECT_UID\:$PROJECT_GID\n\1@}" docker-compose.yml
    fi

}

e2e() {

    ## Runs the Playwright tests (packages/*/tests/ts/e2e/*.e2e.ts) in the
    ## Playwright image of the installed version, which has the browsers:
    ## ./project.sh e2e [playwright test arguments...], e.g. --project=ptuj,
    ## or the load and frame times with
    ## PERFORMANCE=1 ./project.sh e2e --project=performance --workers=1
    local version
    version=$(sed -n 's/^ *"version": "\(.*\)",$/\1/p' \
        node_modules/playwright/package.json)
    if [[ -z "$version" ]]; then
        echo "playwright is not installed, run ./project.sh start first"
        return 1
    fi

    docker run --rm --init --ipc=host --network=host \
        --user "$PROJECT_UID:$PROJECT_GID" -e HOME=/tmp \
        -e CI="${CI:-}" -e PERFORMANCE="${PERFORMANCE:-}" -e NODE_NO_WARNINGS=1 \
        -v "$PWD:$PWD" -w "$PWD" \
        "mcr.microsoft.com/playwright:v$version-noble" \
        node .yarn/releases/yarn-4.18.1.cjs e2e "$@"

}

node() {

if [[ ! -f package.json ]]; then

    docker compose run --rm node yarn init

else

    docker compose run --rm node yarn install

fi

docker compose run --rm node sh -c "printenv"

}

pytests() {

    ## Runs pytests.py (packages/*/tests/py/unit/test_*.py) in the aljazmc images:
    ## ./project.sh pytests [image...], the six below without images. Blender's
    ## run inside Blender, so the tests that need bpy run there too.
    local images=("$@") image failed=()
    [[ ${#images[@]} -eq 0 ]] && images=(blender-alpine blender-debian \
        inkscape-alpine inkscape-debian fluidsynth-alpine fluidsynth-debian)

    for image in "${images[@]}"; do
        echo "### aljazmc/$image"
        if [[ "$image" == blender-* ]]; then
            command=(blender -b --factory-startup --python-exit-code 1 -P pytests.py --)
        else
            command=(python3 pytests.py)
        fi
        docker run --rm -e PYTHONDONTWRITEBYTECODE=1 -v "$PWD:$PWD:ro" -w "$PWD" \
            "aljazmc/$image" "${command[@]}" || failed+=("$image")
    done

    if [[ ${#failed[@]} -gt 0 ]]; then
        echo "### failed in: ${failed[*]}"
        return 1
    fi
    echo "### passed in: ${images[*]}"

}

start() {

    compose

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then

        composehack

    fi

    node

    docker compose run --rm node yarn sp:ptuj

}

usage() {

    echo "usage: ./project.sh clean | compose | composehack | e2e [args...] | node | pytests [image...] | start" >&2
    exit 1

}

## Runs one of the functions above, nothing else: ./project.sh <function> [args...]
case "${1:-}" in
    clean | compose | composehack | e2e | node | pytests | start) "$@" ;;
    *) usage ;;
esac
