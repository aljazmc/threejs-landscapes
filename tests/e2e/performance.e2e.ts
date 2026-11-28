import {
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test } from "playwright/test";
import { PACKAGES } from "../../playwright.config.ts";

/**
 * Measures each package in Chromium: the load time, from the navigation to
 * the first drawn frame, and the frame times after a warm-up, which leaves
 * out the shaders compiled and the assets decoded on the first frames. Only
 * the performance project runs it (PERFORMANCE=1, see playwright.config.ts,
 * or yarn perf), one package at a time. The results go into
 * .cache/performance: one JSON file per package and summary.md, a table CI
 * adds to the job summary.
 *
 * WebGL runs on SwiftShader, on the CPU, so the times are those of the
 * runner, not of a player's GPU: the games draw their menu at the high
 * quality, about a second a frame on SwiftShader. The budgets only catch a
 * page that stopped loading or drawing, the numbers are for following the
 * trend.
 */

/** What shows that a package has drawn its first frame. */
const READY: Record<keyof typeof PACKAGES, string> = {
    // the menu on the HUD, once the resources are loaded
    bloodmoon: "hud",
    hullbreach: "hud",
    moonshadow: "hud",
    // the labels, once both JSON files are loaded and the scene is set up
    ptuj: "#root .labels .label",
    starter: "#root canvas",
};

/** Budgets in milliseconds, far above what CI measures. */
const BUDGET = { load: 60_000, frame: 10_000 };
/**
 * How long the frames are left to settle, then measured, in milliseconds:
 * for SAMPLE, or until FRAMES frames are drawn, up to LIMIT in all.
 */
const WARMUP = 2_000;
const SAMPLE = 4_000;
const FRAMES = 6;
const LIMIT = 40_000;

// Playwright runs from the root, where playwright.config.ts is
const OUTPUT = join(process.cwd(), ".cache", "performance");

export interface Measure {
    name: string;
    /** From the navigation to the first frame. */
    load: number;
    /** Frames drawn while measuring. */
    frames: number;
    /** The time measured over the frames drawn in it. */
    mean: number;
    /** The slowest frame of the fastest 95 %. */
    p95: number;
    /** The slowest frame. */
    max: number;
    fps: number;
}

/** The value below which a share of the sorted values lies. */
export function quantile(sorted: number[], share: number): number {
    if (sorted.length === 0) return Number.NaN;
    const at = (sorted.length - 1) * share;
    const low = sorted[Math.floor(at)] ?? 0;
    const high = sorted[Math.ceil(at)] ?? low;
    return low + (high - low) * (at - Math.floor(at));
}

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

// from the files, as a failed test starts a new worker; a package that
// failed before it was measured has no file
test.afterAll(() => {
    const measures = readdirSync(OUTPUT)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .map(
            (file) =>
                JSON.parse(readFileSync(join(OUTPUT, file), "utf8")) as Measure,
        );
    // JSON has no NaN, a package without frames has null
    const ms = (value: number | null) => value?.toFixed(1) ?? "–";
    const lines = [
        "| Package | Load (ms) | Frames | Mean frame (ms) | p95 frame (ms) | Slowest frame (ms) | FPS |",
        "| ------- | --------: | -----: | --------------: | -------------: | -----------------: | --: |",
        ...measures.map(
            (m) =>
                `| ${m.name} | ${Math.round(m.load)} | ${m.frames} | ${ms(m.mean)} | ${ms(m.p95)} | ${ms(m.max)} | ${ms(m.fps)} |`,
        ),
    ];
    writeFileSync(join(OUTPUT, "summary.md"), `${lines.join("\n")}\n`);
});

for (const [name, port] of Object.entries(PACKAGES)) {
    test(`${name} loads and draws its frames in time`, async ({ page }) => {
        const file = join(OUTPUT, `${name}.json`);
        rmSync(file, { force: true });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${port}/`);

        const ready = await page.waitForFunction(
            (selector) => {
                if (selector !== "hud") {
                    const element = document.querySelector(selector);
                    return element?.getClientRects().length
                        ? performance.now()
                        : false;
                }
                const hud = document.querySelector<HTMLCanvasElement>(
                    "#root > .stage > canvas.hud",
                );
                const ctx = hud?.getContext("2d");
                if (!hud || !ctx || !hud.width || !hud.height) return false;
                const { data } = ctx.getImageData(0, 0, hud.width, hud.height);
                return data.some((value, i) => i % 4 === 3 && value > 0)
                    ? performance.now()
                    : false;
            },
            READY[name as keyof typeof PACKAGES],
            { polling: 50, timeout: BUDGET.load },
        );
        const load = (await ready.jsonValue()) as number;

        // the times of the frames the page draws, after the warm-up
        const times = await page.evaluate(
            ([warmup, duration, frames, limit]) =>
                new Promise<number[]>((resolve) => {
                    const start = performance.now();
                    const times: number[] = [];
                    const frame = (time: number) => {
                        if (time - start >= warmup) times.push(time);
                        const more =
                            time - start < warmup + duration ||
                            times.length <= frames;
                        if (more && time - start < limit)
                            requestAnimationFrame(frame);
                        else resolve(times);
                    };
                    requestAnimationFrame(frame);
                }),
            [WARMUP, SAMPLE, FRAMES, LIMIT] as const,
        );
        const deltas = times.slice(1).map((time, i) => time - times[i]!);
        const sorted = [...deltas].sort((a, b) => a - b);
        const mean =
            ((times.at(-1) ?? 0) - (times[0] ?? 0)) /
            Math.max(deltas.length, 1);
        const measure: Measure = {
            name,
            load,
            frames: deltas.length,
            mean,
            p95: quantile(sorted, 0.95),
            max: sorted.at(-1) ?? Number.NaN,
            fps: 1000 / mean,
        };
        writeFileSync(file, `${JSON.stringify(measure, null, 4)}\n`);
        test.info().annotations.push({
            type: "performance",
            description: `load ${Math.round(load)} ms, mean frame ${mean.toFixed(1)} ms, p95 ${measure.p95.toFixed(1)} ms`,
        });

        expect(errors).toEqual([]);
        expect(measure.load).toBeLessThan(BUDGET.load);
        expect(measure.frames).toBeGreaterThan(1);
        expect(measure.mean).toBeLessThan(BUDGET.frame);
    });
}
