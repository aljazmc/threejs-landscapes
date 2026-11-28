/**
 * Writes the notes of the GitHub releases, for `.github/workflows/ci.yml`.
 * The versions and tags come from monorepo (see monorepo.config.ts): each
 * package is tagged `<name>@<version>`, the root `v<version>`, on the
 * `version:` commit that bumped it. The notes of a tag are the conventional
 * commits since the tag before it that changed the package, by kind.
 *
 *     node .github/scripts/release.ts latest        # the last tag of each package
 *     node .github/scripts/release.ts notes <tag>   # the notes of a release
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A versioned package, the root one included. */
export interface Package {
    name: string;
    /** Its folder, `.` for the root. */
    dir: string;
    /** The prefix of its tags, before the version. */
    prefix: string;
}

/** A commit, short. */
export interface Commit {
    hash: string;
    subject: string;
    body: string;
}

const git = (cwd: string, args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trimEnd();

const read = (path: string) =>
    JSON.parse(readFileSync(path, "utf8")) as { name: string };

/** The root and the packages of packages/, like monorepo.config.ts. */
export function packages(cwd: string): Package[] {
    const found: Package[] = [
        { name: read(join(cwd, "package.json")).name, dir: ".", prefix: "v" },
    ];
    const folder = join(cwd, "packages");
    if (!existsSync(folder)) return found;
    for (const entry of readdirSync(folder).sort()) {
        const path = join(folder, entry, "package.json");
        if (!existsSync(path)) continue;
        const { name } = read(path);
        found.push({ name, dir: `packages/${entry}`, prefix: `${name}@` });
    }
    return found;
}

/** Parses `x.y.z`, without a prerelease, undefined otherwise. */
const parse = (version: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return match ? match.slice(1).map(Number) : undefined;
};

const compare = (a: number[], b: number[]) =>
    (a[0] ?? 0) - (b[0] ?? 0) ||
    (a[1] ?? 0) - (b[1] ?? 0) ||
    (a[2] ?? 0) - (b[2] ?? 0);

/** The versions a package was tagged with, the newest first. */
export function versions(cwd: string, pack: Package): string[] {
    return git(cwd, ["tag", "--list", `${pack.prefix}*`])
        .split("\n")
        .map((tag) => tag.slice(pack.prefix.length))
        .filter((version) => parse(version))
        .sort((a, b) => compare(parse(b) ?? [], parse(a) ?? []));
}

/** The paths of a package: its folder, the root without the packages. */
function paths(pack: Package, all: Package[]): string[] {
    if (pack.dir !== ".") return [pack.dir];
    return [
        ".",
        ...all
            .filter((other) => other.dir !== ".")
            .map((other) => `:(exclude)${other.dir}`),
    ];
}

/**
 * The commits of a range that change some paths, the newest first, without
 * the `version:` commits of monorepo.
 */
export function commits(cwd: string, range: string, of: string[]): Commit[] {
    const output = git(cwd, [
        "log",
        "--format=%x01%h%x00%s%x00%b",
        range,
        "--",
        ...of,
    ]);
    return output
        .split("\x01")
        .filter((record) => record.trim() !== "")
        .map((record) => {
            const [hash = "", subject = "", body = ""] = record
                .replace(/^\n/, "")
                .split("\x00");
            return { hash, subject, body: body.trim() };
        })
        .filter(({ subject }) => !/^version(\([^)]*\))?:/.test(subject));
}

const sections: [string, (type: string) => boolean][] = [
    ["Breaking changes", () => false],
    ["Features", (type) => type === "feat"],
    ["Fixes", (type) => type === "fix" || type === "revert"],
    ["Performance", (type) => type === "perf"],
    ["Refactoring", (type) => type === "refactor"],
    ["Documentation", (type) => type === "docs"],
    ["Tests", (type) => type === "test" || type === "tests"],
    ["Other changes", () => true],
];

/** The package a tag belongs to, and its version. */
export function owner(
    all: Package[],
    tag: string,
): { pack: Package; version: string } {
    for (const pack of all) {
        if (!tag.startsWith(pack.prefix)) continue;
        const version = tag.slice(pack.prefix.length);
        if (parse(version)) return { pack, version };
    }
    throw new Error(`${tag} is not the tag of a version of a package.`);
}

/**
 * The notes of a tagged release: a link to its preview, what changed since
 * the version before, by kind, with the commits that changed the package.
 */
export function notes(
    cwd: string,
    tag: string,
    { repository = "aljazmc/threejs-landscapes" } = {},
): string {
    const all = packages(cwd);
    const { pack, version } = owner(all, tag);
    if (!git(cwd, ["tag", "--list", tag]))
        throw new Error(`${tag} is not tagged.`);
    const before = versions(cwd, pack).find(
        (other) => compare(parse(other) ?? [], parse(version) ?? []) < 0,
    );
    const previous = before && `${pack.prefix}${before}`;
    const range = previous ? `${previous}..${tag}` : tag;
    const changes = commits(cwd, range, paths(pack, all));

    const links: string[] = [];
    const folder = pack.dir.replace(/^packages\//, "");
    if (existsSync(join(cwd, ".github/workflows", `publish-${folder}.yml`)))
        links.push(
            `[Play ${folder} ${version}](https://aljazmc.github.io/${folder}-preview/)`,
        );
    if (previous)
        links.push(
            `[changes since ${before}](https://github.com/${repository}/compare/${encodeURIComponent(previous)}...${encodeURIComponent(tag)})`,
        );
    const lines = links.length > 0 ? [links.join(" · ")] : [`${pack.name}`];

    const placed = new Set<Commit>();
    for (const [title, matches] of sections) {
        const of = changes.filter((commit) => {
            if (placed.has(commit)) return false;
            const match = /^(\w+)(?:\([^)]*\))?(!)?:\s*(.*)$/.exec(
                commit.subject,
            );
            const breaking =
                match?.[2] === "!" || /^BREAKING[ -]CHANGE:/m.test(commit.body);
            return title === "Breaking changes"
                ? breaking
                : matches(match?.[1] ?? "");
        });
        if (of.length === 0) continue;
        lines.push("", `### ${title}`, "");
        for (const commit of of) {
            placed.add(commit);
            const text = commit.subject.replace(/^\w+(?:\([^)]*\))?!?:\s*/, "");
            lines.push(`- ${text} (${commit.hash})`);
        }
    }
    if (changes.length === 0)
        lines.push("", "No changes since the version before.");
    return `${lines.join("\n")}\n`;
}

/** The last tag of each package that has one. */
export function latest(cwd: string): string[] {
    return packages(cwd).flatMap((pack) => {
        const version = versions(cwd, pack)[0];
        return version ? [`${pack.prefix}${version}`] : [];
    });
}

export const usage = "usage: release.ts latest | notes <tag>";

/** Runs a command, the exit code it ends with. */
export function main(cwd: string, argv: string[]): number {
    const [command, argument, ...rest] = argv;
    try {
        if (command === "latest" && argument === undefined) {
            for (const tag of latest(cwd)) console.log(tag);
            return 0;
        }
        if (command === "notes" && argument && rest.length === 0) {
            process.stdout.write(
                notes(cwd, argument, {
                    repository:
                        process.env.GITHUB_REPOSITORY ??
                        "aljazmc/threejs-landscapes",
                }),
            );
            return 0;
        }
    } catch (error) {
        console.error((error as Error).message);
        return 1;
    }
    console.error(usage);
    return 2;
}

if (import.meta.main) process.exit(main(process.cwd(), process.argv.slice(2)));
