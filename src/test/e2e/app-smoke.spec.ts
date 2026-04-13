import { expect, test } from "@playwright/test";

test.describe("App smoke", () => {
  test("homepage renders the hero CTA", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByTestId("homepage-hero");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: /Get the best deal on your Florida home/i }),
    ).toBeVisible();
    await expect(hero.getByRole("button", { name: "Get free analysis" })).toBeVisible();
  });

  test("homepage hero accepts a supported listing URL and routes into intake", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.getByTestId("homepage-hero");

    await hero
      .getByPlaceholder("Paste a Zillow, Redfin, or Realtor.com link...")
      .fill("https://www.zillow.com/homedetails/123456_zpid/");
    await hero.getByRole("button", { name: "Get free analysis" }).click();

    await expect(page).toHaveURL(/\/intake\?url=.*source=hero.*submittedAt=/);
    await expect(page.getByText("Listing:")).toBeVisible();
  });

  test("homepage hero shows a typed parser error for unsupported domains", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.getByTestId("homepage-hero");

    await hero
      .getByPlaceholder("Paste a Zillow, Redfin, or Realtor.com link...")
      .fill("https://example.com/listing/123");
    await hero.getByRole("button", { name: "Get free analysis" }).click();

    await expect(
      page.getByText("Paste a Zillow, Redfin, or Realtor.com listing link."),
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

    await expect(
      page.getByRole("heading", { name: "Paste a link. Get instant analysis." }),
    ).toBeVisible();

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
