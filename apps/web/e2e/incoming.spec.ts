import { expect, test } from "@playwright/test";
import { main } from "./_helpers.js";

test("quick-add capture lands in Incoming and triages to a todo", async ({ page }) => {
  const note = `capture ${Date.now()}`;
  await page.goto("/");

  await page.getByLabel("Quick add to Incoming").fill(note);
  await page.locator("header").getByRole("button", { name: "Add", exact: true }).click();

  await main(page).getByRole("link", { name: "Incoming" }).click().catch(() => {});
  await page.goto("/incoming");
  await expect(main(page).getByText(note)).toBeVisible();

  await main(page).getByRole("button", { name: "To todo" }).first().click();
  await page.getByRole("button", { name: "Create todo" }).click();
  await expect(main(page).getByText(note)).toHaveCount(0);

  await page.goto("/todos");
  await expect(main(page).getByRole("link", { name: note, exact: true })).toBeVisible();
});
