import { expect, test } from "playwright/test";

test("renders the scene into a WebGL canvas", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page).toHaveTitle("Starter");

    const canvas = page.locator("#root canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
    expect(
        await canvas.evaluate((element: HTMLCanvasElement) =>
            Boolean(element.getContext("webgl2")),
        ),
    ).toBe(true);

    expect(errors).toEqual([]);
});
