import { expect, type Page, test } from "playwright/test";

/** The box of the 960x540 stage in a window of the given size. */
async function stageIn(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    const stage = page.locator("#root > .stage");
    // the stage is fitted on the window's resize event
    await expect
        .poll(async () => (await stage.boundingBox())?.width)
        .toBe(Math.round(960 * Math.min(width / 960, height / 540)));
    const box = await stage.boundingBox();
    if (!box) throw new Error("the stage has no box");
    return box;
}

test("letterboxes the 16:9 stage in any window", async ({ page }) => {
    await page.goto("/");

    // a tall window: as wide as the window, bars above and below
    const tall = await stageIn(page, 800, 800);
    expect(tall.width).toBe(800);
    expect(tall.height).toBe(450);
    expect(tall.x).toBe(0);
    expect(tall.y).toBe(175);

    // a wide window: as high as the window, bars left and right
    const wide = await stageIn(page, 1600, 540);
    expect(wide.width).toBe(960);
    expect(wide.height).toBe(540);
    expect(wide.x).toBe(320);
    expect(wide.y).toBe(0);
});
