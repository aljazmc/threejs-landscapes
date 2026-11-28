import { defineConfig, devices } from "playwright/test";

/** The packages with e2e tests and the ports their dev servers listen on. */
export const PACKAGES = {
    bloodmoon: 8101,
    hullbreach: 8102,
    moonshadow: 8103,
    ptuj: 8104,
    starter: 8105,
};

/**
 * Runs packages/<package>/tests/ts/e2e/*.e2e.ts (not *.test.ts, which are
 * testero's) in Chromium against each package's dev server.
 */
export default defineConfig({
    forbidOnly: !!process.env.CI,
    outputDir: ".cache/playwright",
    reporter: process.env.CI ? "github" : "list",
    retries: process.env.CI ? 1 : 0,
    testMatch: "*.e2e.ts",
    timeout: 120_000,
    use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
            // WebGL on the software renderer, there is no GPU in containers
            args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
        trace: "retain-on-failure",
    },
    projects: [
        ...Object.entries(PACKAGES).map(([name, port]) => ({
            name,
            testDir: `packages/${name}/tests/ts/e2e`,
            use: { baseURL: `http://127.0.0.1:${port}` },
        })),
        // load and frame times of every package, tests/e2e/performance.e2e.ts:
        // only with PERFORMANCE=1, so they are measured on their own, with
        // --project=performance --workers=1 (yarn perf)
        ...(process.env.PERFORMANCE
            ? [{ name: "performance", testDir: "tests/e2e" }]
            : []),
    ],
    webServer: Object.entries(PACKAGES).map(([name, port]) => ({
        // esbuild --serve stops when its stdin closes, so keep it open
        command: `tail -f /dev/null | yarn s:${name} --serve=127.0.0.1:${port} --log-level=warning`,
        url: `http://127.0.0.1:${port}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    })),
});
