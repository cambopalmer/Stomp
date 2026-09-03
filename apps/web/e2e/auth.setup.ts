import { expect, test as setup } from "@playwright/test";

const OWNER_STATE = "e2e/.auth/owner.json";

setup("authenticate as the seeded owner", async ({ page }) => {
  setup.setTimeout(90_000); // first hit compiles the whole module graph
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("owner@stomp.local");
  await page.getByLabel("Password").fill("stomp-dev-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Hub" })).toBeVisible();
  await page.context().storageState({ path: OWNER_STATE });
});
