import { expect, test } from "@playwright/test";
import { main } from "./_helpers.js";

test("home shows section tiles and the hot sidebar from seed data", async ({ page }) => {
  await page.goto("/");

  await expect(main(page).getByRole("heading", { name: "Hub" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: /Todos/ })).toBeVisible();

  const sidebar = page.getByRole("complementary", { name: "Hot and relevant" });
  await expect(sidebar.getByRole("heading", { name: "Overdue" })).toBeVisible();
  await expect(sidebar.getByText("Fix leaking tap")).toBeVisible();
});

test("tiles link to their section landing pages", async ({ page }) => {
  await page.goto("/");
  await main(page).getByRole("link", { name: /Todos/ }).click();
  await expect(page).toHaveURL(/\/todos$/);
  await expect(main(page).getByRole("heading", { name: "Todos" })).toBeVisible();
});

test("dark mode toggle sets the theme attribute", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "dark");

  const toggle = page.getByRole("button", { name: /Theme:/ });
  await toggle.click(); // system -> light
  await expect(html).toHaveAttribute("data-theme", "light");
  await toggle.click(); // light -> dark
  await expect(html).toHaveAttribute("data-theme", "dark");
});
