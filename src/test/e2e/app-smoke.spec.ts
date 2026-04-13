import { expect, test } from "@playwright/test";

test.describe("App smoke", () => {
  test("homepage renders the hero CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Florida home");
    await expect(
      page.getByRole("button", { name: "Get free analysis" }).first(),
    ).toBeVisible();
  });

  test("intake landing route renders its fallback state", async ({ page }) => {
    await page.goto("/intake");

    await expect(page.getByRole("heading", { name: "Intake" })).toBeVisible();
    await expect(page.getByText("No listing URL was forwarded.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to homepage" })).toBeVisible();
  });

  test("get-started and admin preview surfaces render", async ({ page }) => {
    await page.goto("/get-started");
    await expect(page.locator("h1")).toContainText(
      "Paste a link. Get instant analysis.",
    );

    await page.goto("/preview");
    await expect(page.getByRole("heading", { name: "Broker Console Preview" })).toBeVisible();
    await expect(page.getByText("Internal console shell preview")).toBeVisible();
  });

  test("deal room placeholder route resolves", async ({ page }) => {
    await page.goto("/property/test-property");

    await expect(page.getByRole("heading", { name: "Deal Room" })).toBeVisible();
    await expect(page.getByText("Property: test-property")).toBeVisible();
  });
});
