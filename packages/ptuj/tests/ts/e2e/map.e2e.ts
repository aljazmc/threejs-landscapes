import { expect, test } from "playwright/test";

test("shows the map and its credits", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await expect(page).toHaveTitle("Ptuj");

    // the canvas is shown once both JSON files are loaded
    await expect(page.locator("#root .stage canvas")).toBeVisible({
        timeout: 60_000,
    });
    await expect(page.locator(".title h1")).toHaveText("Ptuj");
    await expect(page.locator(".labels .label").first()).toBeAttached();

    // the license opens first, OK folds it into the credit, which opens it
    const license = page.locator(".license");
    await expect(license).toHaveClass(/\bopen\b/);
    await expect(license).toContainText("OpenStreetMap");
    await license.getByRole("button", { name: "OK" }).click();
    const credit = license.locator("button.credit");
    await expect(credit).toHaveText(
        "Map data © OpenStreetMap contributors, ODbL",
    );
    await credit.click();
    await expect(license).toHaveClass(/\bopen\b/);

    expect(errors).toEqual([]);
});
