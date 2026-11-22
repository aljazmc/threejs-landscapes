# threejs-landscapes

[![CI](https://github.com/aljazmc/threejs-landscapes/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/ci.yml)
[![Publish ptuj](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-ptuj.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-ptuj.yml)
[![Publish bloodmoon](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-bloodmoon.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-bloodmoon.yml)
[![Publish hullbreach](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-hullbreach.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-hullbreach.yml)
[![Publish moonshadow](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-moonshadow.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-moonshadow.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![three.js 0.187](https://img.shields.io/badge/three.js-0.187-black?logo=threedotjs)](https://threejs.org/)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Yarn 4](https://img.shields.io/badge/Yarn-4-2c8ebb?logo=yarn&logoColor=white)](https://yarnpkg.com/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/)

A Yarn monorepo scrapyard of experiments with [three.js](https://threejs.org/), for half-baked ideas, quirks and programming approaches, and to give scrapped assets another life. Each package in `packages/` is a static browser app, built with esbuild and published to its own `<package>-preview` repository on GitHub Pages together with its README, which is written for the people who play or use it.

## Packages

| Package                           | What it is                                                                                                                               | Live                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [ptuj](packages/ptuj)             | A neon vector map of the Municipality of Ptuj with its quarters, rivers, roads, railway, landmarks and simulated road and train traffic. | [ptuj-preview](https://aljazmc.github.io/ptuj-preview/)             |
| [bloodmoon](packages/bloodmoon)   | Bloodmoon Manor: a first person shooter in Victorian gothic style, against ten creatures of the night in a vampire's castle.             | [bloodmoon-preview](https://aljazmc.github.io/bloodmoon-preview/)   |
| [hullbreach](packages/hullbreach) | Hull Breach: a first person shooter in cyberpunk style, against ten alien boarders of a spaceship.                                       | [hullbreach-preview](https://aljazmc.github.io/hullbreach-preview/) |
| [moonshadow](packages/moonshadow) | Moonshadow Keep: a first person shooter in elven fantasy style, against ten monsters in an elven keep.                                   | [moonshadow-preview](https://aljazmc.github.io/moonshadow-preview/) |
| [starter](packages/starter)       | A minimal React Three Fiber scene, the template for new packages. Not published.                                                         |                                                                     |

![The old town of Ptuj in the ptuj package](packages/ptuj/preview.gif)

## Development

### Requirements

Only Docker and Bash. Node and Yarn run in the `aljazmc/corepack-alpine` container, which `project.sh` sets up:

```sh
./project.sh start   # writes docker-compose.yml, installs the dependencies and serves the ptuj production build
./project.sh clean   # removes the container, node_modules, the builds and the generated docker-compose.yml
```

`docker-compose.yml` is generated and gitignored. On GNU/Linux, `start` also sets the container's user to yours so files it writes stay yours. Every Yarn command then runs as:

```sh
docker compose run --rm node yarn <script>
```

### Scripts

| Script                   | What it does                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `s:<package>`            | development server                                                                                                                                                                   |
| `w:<package>`            | development server that rebuilds on changes                                                                                                                                          |
| `sp:<package>`           | production build, served                                                                                                                                                             |
| `b:<package>`, `b:all`   | development build into `packages/<package>/dist/`                                                                                                                                    |
| `bp:<package>`, `bp:all` | production build into `packages/<package>/dist/`                                                                                                                                     |
| `ct:<package>`, `ct:all` | type check                                                                                                                                                                           |
| `test`                   | the tests in `packages/*/tests/*.test.ts`, run in Node                                                                                                                               |
| `lint`, `lint:w`         | lint and format check ([lintero](https://www.npmjs.com/package/@aljazmc/lintero) and [formatero](https://www.npmjs.com/package/@aljazmc/formatero)), and the same with fixes written |

The development builds bundle every dependency. The production builds leave out three.js (and React for ptuj and starter) and load them from [esm.sh](https://esm.sh/) through the import map in each package's `src/prod/index.html`. When dependencies are updated, those pinned versions must match the root `resolutions`.

The tests import only modules that don't need the DOM, and aren't type checked: the package tsconfigs include only `src`.

### Code style

TypeScript 7, strict, with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. 4 space indents, double quotes, semicolons, trailing commas and 80 columns (`formatero.config.ts`). Run `yarn lint:w` after every change and keep its fixes.

Each package's `tsconfig.json` extends the root one and keeps `"emitDeclarationOnly": true` and `"noEmit": false`, because TypeScript 7 refuses referenced composite projects that disable emitting (TS6310). Check the whole solution with `tsc -b` on the root.

### Script checks

The shell and Python scripts are checked in CI with [ShellCheck](https://www.shellcheck.net/) and [Ruff](https://docs.astral.sh/ruff/) (`ruff.toml`: pyflakes, pycodestyle errors, sorted imports and bugbear, no line length). Neither runs in the Node container; run them from the repository root with Docker:

```sh
docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable $(git ls-files '*.sh')
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/io" -w /io ghcr.io/astral-sh/ruff:0.17.6 check .        # --fix to fix
```

Keep `# isort: split` in `shooter-scripts/blender/exportglb.py`: `common` has to be imported before `shooter`, because it puts the package's own modules first on the path.

### Generated files

Generated files are committed. Rebuild them on the host (not in Docker) with each package's scripts, and edit the scripts, never their output. The shooters' `./project.sh` only sets the package's theme and runs [`shooter-scripts/project.sh`](shooter-scripts/project.sh), with the Blender and FluidSynth code they share in `shooter-scripts/blender/` and `shooter-scripts/fluidsynth/`. A package's `blender-scripts/` and `fluidsynth-scripts/` hold only its theme, its level layout, its creatures and one project directory per asset.

| Package                           | Command                               | Needs                                  | Makes                                                                                                                            |
| --------------------------------- | ------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| bloodmoon, hullbreach, moonshadow | `./project.sh graphics`               | Blender                                | `src/res`: the map from the package's layout module, the textures and GLB models from `blender-scripts/<theme>-<name>/<name>.py` |
| bloodmoon, hullbreach, moonshadow | `./project.sh audio`                  | Python with numpy, FluidSynth, ffmpeg  | `src/res`: the sound effects and music from `fluidsynth-scripts/<theme>-<name>/` (OGG, and WAV or MP3 for Safari)                |
| hullbreach                        | `./project.sh font <font.fnt>`        | Python with Pillow                     | `src/res/shooter-font.*` from `pillow-scripts/font.py`: Pixel Operator with č, š, ž, ą, ł…                                       |
| ptuj                              | `inkscape-scripts/project.sh fetch`   | Python                                 | downloads the OpenStreetMap data and the ESS list of bans into `inkscape-scripts/osm/data`                                       |
| ptuj                              | `inkscape-scripts/project.sh map`     | Python                                 | `src/map/ptuj.json`                                                                                                              |
| ptuj                              | `inkscape-scripts/project.sh terrain` | Python with Pillow                     | `src/map/terrain.json` from Terrarium elevation tiles, cached in `osm/data/terrain`                                              |
| ptuj                              | `inkscape-scripts/project.sh all`     |                                        | `fetch`, `map` and `terrain`                                                                                                     |
| ptuj                              | `inkscape-scripts/project.sh preview` | Firefox, ffmpeg, a `yarn b:ptuj` build | `preview.gif`, recorded close up over the old town in headless Firefox                                                           |

`python3 packages/ptuj/inkscape-scripts/osm/bans.py packages/ptuj/inkscape-scripts/osm/data` lists which places match the list of bans. A place matches only when its post code, street, house number **and** a distinctive word of the employer's name all match. Matching on the address alone would mark the wrong places, because several firms share buildings. Places that are confirmed but can't be matched from their tags go in `KNOWN` in `bans.py`.

### Layout

```
shooter-scripts/           asset scripts shared by the three shooters
├── project.sh            graphics | audio | font, run by each shooter's ./project.sh
├── blender/              common.py, export*.py, saveblend.py, shooter.py, creatures.py
└── fluidsynth/           common.py, export.py, song.py, sound.py

packages/<package>/
├── src/index.html        development page
├── src/prod/index.html   production page with the esm.sh import map
├── src/index.css
├── src/…                 the app (the shooters: src/game/, generated src/res/; ptuj: generated src/map/)
├── tests/                Node tests of the DOM-free modules
├── README.md             for players and users, published with the app
└── LICENSE             (the shooters; the others use the root one)
```

[`CLAUDE.md`](CLAUDE.md) describes every package's modules in detail.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Don't bump versions or write `version:` commits by hand.

1. **CI** ([`ci.yml`](.github/workflows/ci.yml)) checks the shell and Python scripts with ShellCheck and Ruff, then runs `lint`, `ct:all`, `test` and `b:all` on Node 24, 25 and 26 for every push and pull request to `main`.
2. On a push to `main`, the Node 26 run versions every package changed since its last version, and the root, with [`@aljazmc/monorepo`](https://www.npmjs.com/package/@aljazmc/monorepo) (`monorepo.config.ts`; a `refactor` releases a patch). It commits and tags each one as `@aljazmc/<package>@<version>` and pushes them.
3. For every package whose new version isn't tagged in its preview repository yet, it starts `publish-<package>.yml`. That workflow builds the tag with `bp:<package>`, checks the build, and force pushes `dist/` with the README (and the LICENSE or preview) to `aljazmc/<package>-preview` as tag `v<version>`, where GitHub Pages serves it. Pushing there needs the `GH_TOKEN` secret.

A publish can also be started by hand from the Actions tab, with a version (empty for the branch) and `force` to publish again a version that is already there.

## License

[MIT](LICENSE). The ptuj map data is © OpenStreetMap contributors under the [ODbL](https://opendatacommons.org/licenses/odbl/). The fonts have their own licenses, listed in their packages' LICENSE files: DejaVu Sans in bloodmoon is under the Bitstream Vera Fonts license, and Pixel Operator in hullbreach is CC0 1.0. moonshadow ships no font.
