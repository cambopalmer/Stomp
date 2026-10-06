import { expect, test } from "@playwright/test";
import { main } from "./_helpers.js";

test("Settings shows Connect buttons that start the Google flow for each product", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Account:/ }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await expect(main(page).getByRole("heading", { name: "Connected accounts" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Connect Gmail" })).toHaveAttribute(
    "href",
    "/api/integrations/google/connect?product=gmail",
  );
  await expect(main(page).getByRole("link", { name: "Connect Google Calendar" })).toHaveAttribute(
    "href",
    "/api/integrations/google/connect?product=calendar",
  );

  // the connect endpoint hands off to Google (not followed — e2e never talks to Google)
  const r = await page.request.get("/api/integrations/google/connect?product=gmail", { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers().location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  await page.screenshot({ path: "test-results/settings.png", fullPage: true });
});

test("the OAuth callback's outcome codes show as a dismissable notice", async ({ page }) => {
  await page.goto("/settings?error=denied");
  await expect(main(page).getByRole("alert")).toContainText("You cancelled on Google's screen");
  await main(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.goto("/settings?connected=gmail");
  await expect(main(page).getByRole("status").filter({ hasText: "Gmail connected" })).toBeVisible();
});
