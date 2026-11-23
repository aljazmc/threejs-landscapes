import { expect, test } from "playwright/test";

test("labels every quarter and village of the map", async ({ page }) => {
    const response = await page.request.get("/map/ptuj.json");
    expect(response.ok()).toBe(true);
    const map: { quarters: { name: string; kind: string }[] } =
        await response.json();
    expect(map.quarters.length).toBeGreaterThan(0);

    await page.goto("/");
    for (const kind of ["quarter", "village"]) {
        const names = map.quarters
            .filter((quarter) => quarter.kind === kind)
            .map(({ name }) => name);
        await expect(page.locator(`.labels .label.${kind}`)).toHaveText(names, {
            timeout: 60_000,
        });
    }
});
