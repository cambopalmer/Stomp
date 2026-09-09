import { expect, test } from "@playwright/test";
import { main } from "./_helpers.js";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function createEvent(page: import("@playwright/test").Page, title: string, date: string) {
  await page.goto("/calendar?view=month");
  await main(page).getByRole("button", { name: "New event" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Date", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(main(page).getByRole("link", { name: new RegExp(title) })).toBeVisible();
}

test("an event created for today shows in month, week and list views", async ({ page }) => {
  const title = `cal e2e ${Date.now()}`;
  const today = iso(new Date());
  await createEvent(page, title, today);

  // month (default after create)
  await expect(page.getByRole("tab", { name: "Month" })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "test-results/calendar-month.png", fullPage: true });

  // week — the time grid
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page).toHaveURL(/view=week/);
  await expect(main(page).getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.screenshot({ path: "test-results/calendar-week.png", fullPage: true });

  // list — grouped by day, under a "Today" heading
  await page.getByRole("tab", { name: "List" }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(main(page).getByRole("heading", { name: /Today/ })).toBeVisible();
  await expect(main(page).getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.screenshot({ path: "test-results/calendar-list.png", fullPage: true });
});

test("next / today navigation moves the period", async ({ page }) => {
  await page.goto("/calendar?view=month");
  const thisMonth = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  await expect(main(page).getByText(thisMonth, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(main(page).getByText(thisMonth, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Today" }).click();
  await expect(main(page).getByText(thisMonth, { exact: true })).toBeVisible();
});

test("clicking a day opens the new-event form pre-filled with that date", async ({ page }) => {
  await page.goto("/calendar?view=month");
  const today = iso(new Date());
  await main(page).getByRole("button", { name: `Add event on ${today}` }).click();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(today);
});
