import { expect, test } from "@playwright/test";
import { main } from "./_helpers.js";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function createEvent(page: import("@playwright/test").Page, title: string, date: string) {
  await page.goto(`/calendar?view=month&date=${date}`);
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

/* ── todos on the calendar ──────────────────────────────────── */

const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Local midnight on a day `monthsOut` months ahead — uncrowded by other tests' items. */
const quietDay = (monthsOut: number, date: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsOut, date);
  d.setHours(0, 0, 0, 0);
  return d;
};

async function apiTodo(page: import("@playwright/test").Page, title: string, dueAt: number) {
  const r = await page.request.post("/api/todos", { data: { title, dueAt } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { id: string };
}

test("a todo with a deadline shows on its day in month, week and list, and links to the todo", async ({ page }) => {
  const title = `cal todo ${Date.now()}`;
  const day = quietDay(3, 12);
  const { id } = await apiTodo(page, title, day.getTime());
  const chip = () => main(page).getByRole("link", { name: new RegExp(`Todo: ${title}`) });

  for (const view of ["month", "week", "list"]) {
    await page.goto(`/calendar?view=${view}&date=${iso(day)}`);
    await expect(chip()).toBeVisible();
  }
  await page.screenshot({ path: "test-results/calendar-list-todos.png", fullPage: true });

  await chip().click();
  await expect(page).toHaveURL(new RegExp(`/todos/${id}$`));
});

test("editing a todo's deadline moves it on the calendar; completing it removes it", async ({ page }) => {
  const title = `cal move ${Date.now()}`;
  // start a week out so it's on neither today nor the target day
  const { id } = await apiTodo(page, title, todayMidnight() + 7 * 86_400_000);
  const target = new Date();
  target.setDate(target.getDate() + 1);

  // the user's flow: open the todo, Edit, change Deadline, Save
  await page.goto(`/todos/${id}`);
  await main(page).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Deadline", { exact: true }).fill(iso(target));
  await page.getByRole("button", { name: "Save todo" }).click();

  await page.goto(`/calendar?view=list&date=${iso(target)}`);
  const day = main(page).locator("section").filter({ has: page.getByRole("link", { name: new RegExp(title) }) });
  await expect(day.getByRole("heading")).toContainText(
    target.toLocaleDateString(undefined, { day: "numeric" }),
  );

  await page.request.patch(`/api/todos/${id}`, { data: { status: "done" } });
  await page.reload();
  await expect(main(page).getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
});

test("the Show filter switches between all, events only and todos only", async ({ page }) => {
  const stamp = Date.now();
  const eventTitle = `filter event ${stamp}`;
  const todoTitle = `filter todo ${stamp}`;
  const day = quietDay(2, 11);
  await createEvent(page, eventTitle, iso(day));
  await apiTodo(page, todoTitle, day.getTime());
  await page.goto(`/calendar?view=month&date=${iso(day)}`);

  const ev = () => main(page).getByRole("link", { name: new RegExp(eventTitle) });
  const td = () => main(page).getByRole("link", { name: new RegExp(todoTitle) });
  const filter = page.getByRole("radiogroup", { name: "Show" });

  await expect(filter.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
  await expect(ev()).toBeVisible();
  await expect(td()).toBeVisible();

  await filter.getByRole("radio", { name: "Events" }).click();
  await expect(page).toHaveURL(/show=events/);
  await expect(ev()).toBeVisible();
  await expect(td()).toHaveCount(0);

  await filter.getByRole("radio", { name: "Todos" }).click();
  await expect(page).toHaveURL(/show=todos/);
  await expect(td()).toBeVisible();
  await expect(ev()).toHaveCount(0);

  // survives a reload and a view switch
  await page.reload();
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page).toHaveURL(/show=todos/);
  await expect(td()).toBeVisible();
  await expect(ev()).toHaveCount(0);

  await filter.getByRole("radio", { name: "All" }).click();
  await expect(page).not.toHaveURL(/show=/);
  await expect(ev()).toBeVisible();
});
