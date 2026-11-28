import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { latest, notes, owner, packages, usage, versions } from "../release.ts";

const script = join(import.meta.dirname, "..", "release.ts");

describe("release", () => {
    let root: string;
    const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const file = (path: string, text: string) => {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    };
    const commit = (message: string, path = "README.md") => {
        file(path, `${message}\n${Math.random()}\n`);
        git("add", "-A");
        git("commit", "-q", "-m", message);
        return git("rev-parse", "--short", "HEAD");
    };
    const tag = (name: string) => git("tag", "-a", name, "-m", name);

    beforeAll(() => {
        // a committer for the commits and annotated tags of the tests
        for (const kind of ["AUTHOR", "COMMITTER"]) {
            process.env[`GIT_${kind}_NAME`] = "test";
            process.env[`GIT_${kind}_EMAIL`] = "test@example.org";
        }
        process.env.GIT_CONFIG_NOSYSTEM = "1";
    });

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "release-"));
        git("init", "-q", "-b", "main");
        file("package.json", '{ "name": "root", "private": true }\n');
        file("packages/game/package.json", '{ "name": "@x/game" }\n');
        file("packages/tool/package.json", '{ "name": "@x/tool" }\n');
        file(".github/workflows/publish-game.yml", "name: publish\n");
        commit("chore: start");
        for (const name of ["v0.1.0", "@x/game@0.1.0", "@x/tool@0.2.0"])
            tag(name);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test("the root and the packages, with the prefixes of their tags", () => {
        expect(packages(root)).toEqual([
            { name: "root", dir: ".", prefix: "v" },
            { name: "@x/game", dir: "packages/game", prefix: "@x/game@" },
            { name: "@x/tool", dir: "packages/tool", prefix: "@x/tool@" },
        ]);
    });

    test("versions are sorted by number, not by text", () => {
        commit("fix: one", "packages/game/a.ts");
        tag("@x/game@0.1.10");
        tag("@x/game@0.1.9");
        tag("@x/game@next");
        const game = packages(root)[1]!;
        expect(versions(root, game)).toEqual(["0.1.10", "0.1.9", "0.1.0"]);
        expect(latest(root)).toEqual([
            "v0.1.0",
            "@x/game@0.1.10",
            "@x/tool@0.2.0",
        ]);
    });

    test("the notes of a package: its commits by kind, a link to play", () => {
        const feat = commit("feat: a new enemy", "packages/game/enemy.ts");
        const fix = commit("fix(input): touch", "packages/game/input.ts");
        commit("feat: a tool", "packages/tool/tool.ts");
        commit("version: update @x/game to v0.2.0", "packages/game/x");
        tag("@x/game@0.2.0");
        expect(notes(root, "@x/game@0.2.0", { repository: "o/r" })).toBe(
            [
                "[Play game 0.2.0](https://aljazmc.github.io/game-preview/)" +
                    " · [changes since 0.1.0](https://github.com/o/r/compare/" +
                    "%40x%2Fgame%400.1.0...%40x%2Fgame%400.2.0)",
                "",
                "### Features",
                "",
                `- a new enemy (${feat})`,
                "",
                "### Fixes",
                "",
                `- touch (${fix})`,
                "",
            ].join("\n"),
        );
    });

    test("the notes of the root leave out the packages", () => {
        commit("feat: a game", "packages/game/game.ts");
        const ci = commit("ci: a check", ".github/workflows/ci.yml");
        const breaking = commit("refactor!: the scripts", "project.sh");
        tag("v0.2.0");
        expect(notes(root, "v0.2.0", { repository: "o/r" })).toBe(
            [
                "[changes since 0.1.0](https://github.com/o/r/compare/" +
                    "v0.1.0...v0.2.0)",
                "",
                "### Breaking changes",
                "",
                `- the scripts (${breaking})`,
                "",
                "### Other changes",
                "",
                `- a check (${ci})`,
                "",
            ].join("\n"),
        );
    });

    test("a first version, and one without changes", () => {
        expect(notes(root, "@x/tool@0.2.0")).toContain("- start (");
        tag("@x/tool@0.2.1");
        expect(notes(root, "@x/tool@0.2.1")).toBe(
            [
                "[changes since 0.2.0](https://github.com/" +
                    "aljazmc/threejs-landscapes/compare/" +
                    "%40x%2Ftool%400.2.0...%40x%2Ftool%400.2.1)",
                "",
                "No changes since the version before.",
                "",
            ].join("\n"),
        );
    });

    test("a tag of no package is refused", () => {
        expect(() => owner(packages(root), "@x/none@1.0.0")).toThrow(
            "@x/none@1.0.0 is not the tag of a version of a package.",
        );
        expect(() => owner(packages(root), "@x/game@next")).toThrow(
            "is not the tag of a version",
        );
        expect(() => notes(root, "@x/game@9.9.9")).toThrow(
            "@x/game@9.9.9 is not tagged.",
        );
    });

    // wrong arguments and missing ones, with the exit codes
    const cases: [string, number, string[], string][] = [
        ["no command", 2, [], usage],
        ["an unknown command", 2, ["publish"], usage],
        ["notes without a tag", 2, ["notes"], usage],
        ["notes with two tags", 2, ["notes", "v0.1.0", "v0.1.0"], usage],
        ["latest with an argument", 2, ["latest", "v0.1.0"], usage],
        ["notes of an unknown tag", 1, ["notes", "nope"], "nope is not"],
        ["notes of a missing tag", 1, ["notes", "v9.0.0"], "is not tagged"],
        ["the notes of a tag", 0, ["notes", "v0.1.0"], ""],
        ["the latest tags", 0, ["latest"], ""],
    ];
    test.each(cases)("%s exits with %i", (_name, status, argv, error) => {
        const run = spawnSync(process.execPath, [script, ...argv], {
            cwd: root,
            encoding: "utf8",
        });
        expect([run.status, run.stderr.includes(error)]).toEqual([
            status,
            true,
        ]);
        if (status === 0) expect(run.stdout).not.toBe("");
        else expect(run.stdout).toBe("");
    });
});
