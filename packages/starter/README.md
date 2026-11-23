# Starter

[![CI](https://github.com/aljazmc/threejs-landscapes/actions/workflows/ci.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/aljazmc/threejs-landscapes/blob/main/LICENSE)
[![three.js 0.187](https://img.shields.io/badge/three.js-0.187-black?logo=threedotjs)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-R3F-000000?logo=react&logoColor=61dafb)](https://r3f.docs.pmnd.rs/)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Template](https://img.shields.io/badge/template-for%20new%20packages-0a7bbb)](#a-new-package-from-it)

A minimal [React Three Fiber](https://r3f.docs.pmnd.rs/) scene, two spinning boxes that light up when pointed at and grow when clicked, and the template for new packages of [threejs-landscapes](https://github.com/aljazmc/threejs-landscapes).

[Source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/starter)

It isn't published to a preview repository. Run it from the monorepo root:

```sh
docker compose run --rm node yarn s:starter    # dev server
docker compose run --rm node yarn sp:starter   # production build, served
```

## A new package from it

1. Copy `packages/starter` to `packages/<name>` and rename the package in its `package.json` to `@aljazmc/<name>`, with its own `description` and `repository.directory`.
2. In its `package.json`, point `checktypes` at `yarn ct:<name>`.
3. Add it to the root `package.json` (the `@aljazmc/<name>` workspace dependency and the `b:`, `bp:`, `ct:`, `s:`, `sp:` and `w:` scripts), to the root `tsconfig.json` (`paths` and `references`) and to `PACKAGES` in `playwright.config.ts`, with a port of its own.
4. Keep the versions in the import map of `src/prod/index.html` equal to the root `resolutions`.
5. To publish it, copy one of `.github/workflows/publish-*.yml` to `publish-<name>.yml`, and create the `aljazmc/<name>-preview` repository with GitHub Pages.
6. Add a `README.md` for players (the publish workflow copies it into the preview repository) and a `LICENSE`.
7. Keep the tests apart: TypeScript unit tests in `tests/ts/unit/*.test.ts`, end-to-end tests in `tests/ts/e2e/*.e2e.ts`, Python in `tests/py/unit/test_*.py`. The copied `tests/py/unit/test_package.py` checks steps 1 to 3: run `python3 pytests.py <name>` from the root.

## License

[MIT](https://github.com/aljazmc/threejs-landscapes/blob/main/LICENSE). The starter has no generated assets: its two boxes are drawn by code. It runs on [three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE), [React](https://github.com/facebook/react/blob/main/LICENSE) and [React Three Fiber](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE), all under the MIT License.
