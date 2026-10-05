import { expect, request as pwRequest, test } from "@playwright/test";
import { main } from "./_helpers.js";

// The default storageState is the seeded owner, who is the admin.

test("admin opens Manage users from the account menu and can disable / re-enable a member", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Account:/ }).click();
  await page.getByRole("menuitem", { name: "Manage users" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const sam = main(page).getByTestId("user-sam@stomp.local");
  await expect(sam).toBeVisible();
  await expect(sam.getByText("Active")).toBeVisible();

  await sam.getByRole("button", { name: "Disable" }).click();
  await expect(sam.getByText("Disabled")).toBeVisible();
  await sam.getByRole("button", { name: "Enable" }).click();
  await expect(sam.getByText("Active")).toBeVisible();

  // your own row can't be disabled or deleted
  const me = main(page).getByTestId("user-owner@stomp.local");
  await expect(me.getByRole("button", { name: "Disable" })).toBeDisabled();
  await expect(me.getByRole("button", { name: "Delete" })).toBeDisabled();
  await page.screenshot({ path: "test-results/admin-users.png", fullPage: true });
});

test("admin deletes an account through the inline confirmation", async ({ page, baseURL }) => {
  // sign the victim up in an isolated request context so the admin's cookies are untouched
  const email = `e2e-del-${Date.now()}@stomp.local`;
  const other = await pwRequest.newContext({ baseURL });
  const signup = await other.post("/api/auth/signup", {
    data: { email, password: "hunter2hunter2", displayName: "Delete Me" },
  });
  expect(signup.ok()).toBeTruthy();
  await other.dispose();

  await page.goto("/admin");
  const row = main(page).getByTestId(`user-${email}`);
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(main(page).getByText(/Delete Delete Me\?/)).toBeVisible();
  await main(page).getByRole("button", { name: "Delete account" }).click();

  await expect(main(page).getByTestId(`user-${email}`)).toHaveCount(0);
  await expect(main(page).getByText(/Deleted accounts \(\d+\)/)).toBeVisible();
});

test("a member doesn't get the menu item, and /admin says admins only", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  const login = await page.request.post(`${baseURL}/api/auth/login`, {
    data: { email: "sam@stomp.local", password: "stomp-dev-password" },
  });
  expect(login.ok()).toBeTruthy();

  await page.goto("/");
  await page.getByRole("button", { name: /Account:/ }).click();
  await expect(page.getByRole("menuitem", { name: "Manage users" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(main(page).getByText("Admins only")).toBeVisible();
  await ctx.close();
});
