import { expect, test } from "playwright/test";

test("loads the game and draws the menu", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page).toHaveTitle("Moonshadow Keep");

    // the WebGL canvas of the scene and the 2D canvas of the HUD
    const stage = page.locator("#root > .stage");
    await expect(stage.locator("canvas")).toHaveCount(2);
    const scene = stage.locator("canvas:not(.hud)");
    expect(
        await scene.evaluate((canvas: HTMLCanvasElement) =>
            Boolean(canvas.getContext("webgl2")),
        ),
    ).toBe(true);

    // once the resources are loaded, the menu is drawn on the HUD
    await page.waitForFunction(
        () => {
            const hud = document.querySelector<HTMLCanvasElement>(
                "#root > .stage > canvas.hud",
            );
            const ctx = hud?.getContext("2d");
            if (!hud || !ctx || !hud.width || !hud.height) return false;
            const { data } = ctx.getImageData(0, 0, hud.width, hud.height);
            return data.some((value, i) => i % 4 === 3 && value > 0);
        },
        undefined,
        { timeout: 60_000 },
    );

    expect(errors).toEqual([]);
});
