import { expect, test } from "@playwright/test";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("sections live behind ☰: open, navigate, and it closes itself", async ({ page }) => {
    await page.goto("/");
    // the sidebar's links aren't on screen at phone width
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();

    const menuBtn = page.getByRole("button", { name: "Open menu" });
    await expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    await menuBtn.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    for (const s of ["Home", "Plan", "Calendar", "Todos", "Incoming", "Learn", "Projects", "Shared with me", "Settings"]) {
      await expect(drawer.getByRole("link", { name: s, exact: true })).toBeVisible();
    }
    await expect(drawer.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.screenshot({ path: "test-results/mobile-nav-open.png" });

    await drawer.getByRole("link", { name: "Todos", exact: true }).click();
    await expect(page).toHaveURL(/\/todos$/);
    await expect(drawer).toBeHidden();
  });

  test("Escape closes it and focus returns to ☰", async ({ page }) => {
    await page.goto("/plan");
    const menuBtn = page.getByRole("button", { name: "Open menu" });
    await menuBtn.click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
    await expect(menuBtn).toBeFocused();
  });
});

test("desktop keeps the sidebar and has no ☰", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
});
