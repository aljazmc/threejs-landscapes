import { expect, test } from "playwright/test";

test("the canvas fills the window as it resizes", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("#root canvas");
    await expect(canvas).toBeVisible();

    for (const size of [
        { width: 640, height: 480 },
        { width: 1200, height: 400 },
    ]) {
        await page.setViewportSize(size);
        await expect
            .poll(async () => {
                const box = await canvas.boundingBox();
                return box && { width: box.width, height: box.height };
            })
            .toEqual(size);
    }
});
