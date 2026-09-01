import { expect, test } from "@playwright/test";
import { createTodo, main } from "./_helpers.js";

test("notifications bell shows past-due items", async ({ page }) => {
  await page.goto("/");

  const bell = page.getByRole("button", { name: /Notifications/ });
  await expect(bell).toHaveAccessibleName(/unread/);

  await bell.click();
  await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
  await expect(page.getByText(/Past due:/).first()).toBeVisible();
});

test("tagging a todo surfaces it on the tag page", async ({ page }) => {
  const title = `tagme ${Date.now()}`;
  const tag = `e2e-${Date.now()}`;
  await createTodo(page, title);
  await main(page).getByRole("link", { name: title, exact: true }).click();

  await page.getByLabel("Add a tag").fill(tag);
  await page.getByLabel("Add a tag").press("Enter");
  await expect(main(page).getByText(tag)).toBeVisible();

  await page.goto(`/tags/${tag}`);
  await expect(main(page).getByRole("heading", { name: /Tag:/ })).toBeVisible();
  await expect(main(page).getByRole("link", { name: title, exact: true })).toBeVisible();
});
