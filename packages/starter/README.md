# Starter

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
3. Add it to the root `package.json` (the `@aljazmc/<name>` workspace dependency and the `b:`, `bp:`, `ct:`, `s:`, `sp:` and `w:` scripts) and to the root `tsconfig.json` (`paths` and `references`).
4. Keep the versions in the import map of `src/prod/index.html` equal to the root `resolutions`.
5. To publish it, copy one of `.github/workflows/publish-*.yml` to `publish-<name>.yml`, and create the `aljazmc/<name>-preview` repository with GitHub Pages.
6. Add a `README.md` for players (the publish workflow copies it into the preview repository) and a `LICENSE`.
7. Keep the tests apart: TypeScript in `tests/ts/*.test.ts`, Python in `tests/py/test_*.py`. The copied `tests/py/test_package.py` checks steps 1 to 3: run `python3 pytests.py <name>` from the root.

## License

[MIT](https://github.com/aljazmc/threejs-landscapes/blob/main/LICENSE)
