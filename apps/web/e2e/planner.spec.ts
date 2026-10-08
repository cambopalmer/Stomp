import { expect, type Page, test } from "@playwright/test";
import { main } from "./_helpers.js";

// A fixed future day keeps "now"-dependent defaults out of the way: Add block → 9:00 AM.
const DAY = "2031-01-15";
const blocks = (page: Page) => main(page).getByTestId("plan-block");
const sheet = (page: Page) => page.getByRole("dialog");

test("Plan nav opens today's plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/\d{4}-\d{2}-\d{2}$/);
  await expect(main(page).getByText("Today", { exact: true })).toBeVisible();
});

test("add, edit with −15/+15 and duration presets, then delete a block", async ({ page }) => {
  await page.goto(`/plan/${DAY}`);
  await main(page).getByRole("button", { name: "Add block" }).click();
  await expect(sheet(page).getByRole("heading", { name: "New block" })).toBeVisible();
  await expect(sheet(page).getByLabel("Start time")).toHaveValue(String(9 * 60));

  await sheet(page).getByLabel("Title").fill("Write the deck");
  await sheet(page).getByRole("button", { name: /Focus/ }).click();
  await sheet(page).getByRole("button", { name: "1h", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Add block" }).click();
  await expect(sheet(page)).toHaveCount(0);

  const block = blocks(page).filter({ hasText: "Write the deck" });
  await expect(block).toHaveAttribute("aria-label", /Write the deck, 9:00\sAM – 10:00\sAM, Focus/);

  // nudge: start 15 later (keeps the hour), then end 15 later
  await block.click();
  await sheet(page).getByRole("button", { name: "Start 15 minutes later" }).click();
  await sheet(page).getByRole("button", { name: "End 15 minutes later" }).click();
  await sheet(page).getByRole("button", { name: "Save" }).click();
  await expect(block).toHaveAttribute("aria-label", /9:15\sAM – 10:30\sAM/);
  await page.screenshot({ path: "test-results/plan-day.png", fullPage: true });

  await block.click();
  await sheet(page).getByRole("button", { name: "Delete" }).click();
  await expect(blocks(page).filter({ hasText: "Write the deck" })).toHaveCount(0);
});

test("calendar events sit on the plan as fixed blocks; overlapping blocks are allowed", async ({ page }) => {
  const start = new Date(2031, 0, 15, 14, 0).getTime();
  const ev = await page.request.post("/api/events", {
    data: { title: "Gymnastics", startsAt: start, endsAt: start + 90 * 60_000 },
  });
  expect(ev.ok()).toBeTruthy();

  await page.goto(`/plan/${DAY}`);
  await expect(main(page).getByRole("link", { name: /Gymnastics/ })).toBeVisible();

  // a block on top of the event is fine — side by side, nothing refused
  await main(page).getByRole("button", { name: "Add block" }).click();
  await sheet(page).getByLabel("Start time").selectOption(String(14 * 60));
  await sheet(page).getByLabel("Title").fill("Podcast in the car");
  await sheet(page).getByRole("button", { name: "Add block" }).click();
  await expect(blocks(page).filter({ hasText: "Podcast in the car" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: /Gymnastics/ })).toBeVisible();
});

test("day navigation with prev / next / Today", async ({ page }) => {
  await page.goto(`/plan/${DAY}`);
  await main(page).getByRole("button", { name: "Next day" }).click();
  await expect(page).toHaveURL(/\/plan\/2031-01-16$/);
  await main(page).getByRole("button", { name: "Previous day" }).click();
  await main(page).getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/\/plan\/2031-01-14$/);
  await main(page).getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).not.toHaveURL(/2031-01-14/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("tap a time to add a block there; the sheet sits at the bottom", async ({ page }) => {
    await page.goto(`/plan/${DAY}`);
    const grid = main(page).getByTestId("plan-grid");
    await grid.evaluate((el) => el.scrollTo({ top: 0 })); // midnight at the top
    const layer = main(page).getByTestId("plan-tap-layer");
    const box = (await layer.boundingBox())!;
    // 24 px per 15 min → 1:30 AM is 6 slots down; tap just inside that slot
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 6 * 24 + 5);

    await expect(sheet(page).getByLabel("Start time")).toHaveValue(String(90));
    const dlg = (await sheet(page).boundingBox())!;
    expect(dlg.y + dlg.height).toBeGreaterThan(844 - 4); // anchored to the bottom edge
    await page.screenshot({ path: "test-results/plan-phone-sheet.png" });

    await sheet(page).getByLabel("Title").fill("Night feed");
    await sheet(page).getByRole("button", { name: "Add block" }).click();
    await expect(blocks(page).filter({ hasText: "Night feed" })).toBeVisible();
  });
});

/* ── slice 3: todos on the planner ─────────────────────────── */

async function dueTodo(page: Page, title: string) {
  const r = await page.request.post("/api/todos", { data: { title, dueAt: new Date(2031, 0, 15).getTime() } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { id: string };
}

test("schedule a due todo from the tray; marking its block done offers to complete it", async ({ page }) => {
  const title = `Renew passport ${Date.now()}`;
  const { id } = await dueTodo(page, title);
  await page.goto(`/plan/${DAY}`);

  const tray = main(page).getByRole("complementary", { name: "To schedule" });
  const item = tray.getByRole("listitem").filter({ hasText: title });
  await expect(item.getByText("Due")).toBeVisible();
  await item.getByRole("button", { name: `Schedule ${title}` }).click();

  await expect(sheet(page).getByTestId("sheet-linked-todo")).toContainText(title);
  await sheet(page).getByRole("button", { name: "Add block" }).click(); // no title needed — uses the todo's
  const block = blocks(page).filter({ hasText: title });
  await expect(block).toBeVisible();
  await expect(tray.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);

  await block.click();
  await sheet(page).getByRole("radio", { name: "Done" }).click();
  await sheet(page).getByRole("button", { name: "Save" }).click();
  await expect(sheet(page).getByText(`Also mark the todo “${title}” complete?`)).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Complete todo" })).toBeFocused(); // its only block → default yes
  await sheet(page).getByRole("button", { name: "Complete todo" }).click();

  await expect(block).toHaveAttribute("aria-label", /, done$/);
  const todo = await (await page.request.get(`/api/todos/${id}`)).json();
  expect(todo.status).toBe("done");
});

test("a todo with several blocks: finishing one block leaves the todo open by default", async ({ page }) => {
  const title = `Taxes ${Date.now()}`;
  const { id } = await dueTodo(page, title);
  for (const startMin of [600, 900]) {
    const r = await page.request.post("/api/time-blocks", { data: { date: DAY, startMin, endMin: startMin + 60, todoId: id } });
    expect(r.ok()).toBeTruthy();
  }
  await page.goto(`/plan/${DAY}`);
  await blocks(page).filter({ hasText: title }).first().click();
  await sheet(page).getByRole("radio", { name: "Done" }).click();
  await sheet(page).getByRole("button", { name: "Save" }).click();
  await expect(sheet(page).getByText("It has other blocks planned too.")).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Not yet" })).toBeFocused();
  await sheet(page).getByRole("button", { name: "Not yet" }).click();
  const todo = await (await page.request.get(`/api/todos/${id}`)).json();
  expect(todo.status).not.toBe("done");
});

test.describe("tray on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the tray opens as a bottom sheet and schedules from there", async ({ page }) => {
    const title = `Call the vet ${Date.now()}`;
    await dueTodo(page, title);
    await page.goto(`/plan/${DAY}`);
    await main(page).getByRole("button", { name: /To schedule \(\d+\)/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: `Schedule ${title}` }).click();
    await expect(sheet(page).getByTestId("sheet-linked-todo")).toContainText(title);
    await page.screenshot({ path: "test-results/plan-phone-schedule.png" });
    await sheet(page).getByRole("button", { name: "Add block" }).click();
    await expect(blocks(page).filter({ hasText: title })).toBeVisible();
  });
});
