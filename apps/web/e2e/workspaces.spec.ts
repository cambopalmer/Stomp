import { expect, test } from "@playwright/test";
import { createTodo, main, setWorkspace } from "./_helpers.js";

test("switching workspace scopes the todo list", async ({ page }) => {
  await page.goto("/todos");
  await expect(main(page).getByRole("link", { name: "Fix leaking tap", exact: true })).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Draft trip packing list", exact: true }),
  ).toHaveCount(0);

  await setWorkspace(page, "Household");
  await expect(
    main(page).getByRole("link", { name: "Draft trip packing list", exact: true }),
  ).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Fix leaking tap", exact: true })).toHaveCount(0);

  await setWorkspace(page, "Personal");
});

test("create a workspace; it becomes active in the switcher", async ({ page }) => {
  const name = `WS ${Date.now()}`;
  await page.goto("/workspaces");
  await main(page).getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(main(page).getByRole("heading", { name })).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name })).toBeVisible();

  await setWorkspace(page, "Personal");
});

test("share a todo with another user", async ({ page }) => {
  const title = `share ${Date.now()}`;
  await createTodo(page, title);
  await main(page).getByRole("link", { name: title, exact: true }).click();

  await page.getByLabel("Add someone").fill("sam@stomp.local");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(main(page).getByText("sam@stomp.local")).toBeVisible();
});

test("shared with me page loads", async ({ page }) => {
  await page.goto("/shared");
  await expect(main(page).getByRole("heading", { name: "Shared with me" })).toBeVisible();
});
