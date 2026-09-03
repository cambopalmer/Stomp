import { expect, test } from "@playwright/test";

test("unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/todos");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@stomp.local");
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText(/wrong email or password/i);
});

test("sign up, land in the app, sign out", async ({ page }) => {
  const email = `e2e-${Date.now()}@stomp.local`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Hub" })).toBeVisible();

  await page.getByRole("button", { name: /Account:/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
