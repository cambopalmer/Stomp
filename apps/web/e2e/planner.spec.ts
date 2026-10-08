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

/* ── slice 4: direct manipulation + review ─────────────────── */

async function apiBlock(page: Page, date: string, startMin: number, endMin: number, title: string) {
  const r = await page.request.post("/api/time-blocks", { data: { date, startMin, endMin, title } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { id: string };
}
const byTitle = (page: Page, title: string) => blocks(page).filter({ hasText: title });
async function scrollGridTo(page: Page, minute: number) {
  await main(page).getByTestId("plan-grid").evaluate((el, top) => el.scrollTo({ top }), minute * (24 / 15));
}

test("mouse: drag a block to move it, drag its bottom edge to resize; no sheet opens", async ({ page }) => {
  const D = "2031-02-03";
  const title = `Drag me ${Date.now()}`;
  await apiBlock(page, D, 540, 600, title);
  await page.goto(`/plan/${D}`);
  await scrollGridTo(page, 480);
  const block = byTitle(page, title);
  const box = (await block.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 24, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 48, { steps: 4 }); // 2 slots = 30 min
  await page.mouse.up();
  await expect(block).toHaveAttribute("aria-label", new RegExp(`${title}, 9:30\\sAM – 10:30\\sAM`));
  await expect(sheet(page)).toHaveCount(0);

  const handle = block.getByTestId("plan-block-resize");
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 24, { steps: 4 }); // +15
  await page.mouse.up();
  await expect(block).toHaveAttribute("aria-label", /9:30\sAM – 10:45\sAM/);
});

test("mouse: drag across empty time to sweep out a new block", async ({ page }) => {
  const D = "2031-02-04";
  await page.goto(`/plan/${D}`);
  await scrollGridTo(page, 0);
  const layer = (await main(page).getByTestId("plan-tap-layer").boundingBox())!;
  const y = (min: number) => layer.y + min * (24 / 15);
  await page.mouse.move(layer.x + 100, y(62)); // inside the 1:00 slot
  await page.mouse.down();
  await page.mouse.move(layer.x + 100, y(100), { steps: 5 });
  await expect(main(page).getByTestId("plan-creating")).toBeVisible();
  await page.mouse.move(layer.x + 100, y(118), { steps: 5 });
  await page.mouse.up();
  await expect(sheet(page).getByLabel("Start time")).toHaveValue("60");
  await expect(sheet(page).getByLabel("End time")).toHaveValue("120");
});

test("keyboard: arrows move a focused block, Shift+arrows resize it, and the change is announced", async ({ page }) => {
  const D = "2031-02-05";
  await apiBlock(page, D, 600, 660, "Keyed");
  await page.goto(`/plan/${D}`);
  const block = byTitle(page, "Keyed");
  await block.focus();
  await page.keyboard.press("ArrowDown");
  await expect(block).toHaveAttribute("aria-label", /10:15\sAM – 11:15\sAM/);
  await page.keyboard.press("Shift+ArrowUp");
  await expect(block).toHaveAttribute("aria-label", /10:15\sAM – 11:00\sAM/);
  await expect(main(page).getByTestId("plan-announce")).toHaveText(/Keyed moved to 10:15\sAM – 11:00\sAM/);
  await expect(block).toBeFocused();
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("long-press then drag moves a block; a quick swipe just scrolls", async ({ page }) => {
    const D = "2031-02-06";
    const title = `Touch me ${Date.now()}`;
    await apiBlock(page, D, 540, 600, title);
    await page.goto(`/plan/${D}`);
    await scrollGridTo(page, 480);
    const block = byTitle(page, title);
    const box = (await block.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, y?: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: y === undefined ? [] : [{ x: box.x + box.width / 2, y }],
      });

    // quick swipe: no hold → the block stays put
    await touch("touchStart", box.y + 10);
    for (let i = 1; i <= 4; i++) await touch("touchMove", box.y + 10 + i * 12);
    await touch("touchEnd");
    await expect(block).toHaveAttribute("aria-label", /9:00\sAM – 10:00\sAM/);

    // long-press, then drag down 2 slots
    const again = (await block.boundingBox())!;
    const y0 = again.y + 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: again.x + again.width / 2, y: y0 }] });
    await page.waitForTimeout(550);
    for (let i = 1; i <= 4; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: again.x + again.width / 2, y: y0 + i * 12 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(block).toHaveAttribute("aria-label", new RegExp(`${title}, 9:30\\sAM – 10:30\\sAM`));
    await expect(sheet(page)).toHaveCount(0);
  });
});

test("review: a past day shows totals, planned → actual (with an outline), and saves notes", async ({ page }) => {
  const D = "2025-01-10"; // in the past, so blocks count as started
  const a = await apiBlock(page, D, 540, 600, "Deep work");
  await apiBlock(page, D, 780, 810, "Errand");
  // moved after it started → planned stays 9:00–10:00
  await page.request.patch(`/api/time-blocks/${a.id}`, { data: { startMin: 600, endMin: 660, status: "done" } });

  await page.goto(`/plan/${D}`);
  const summary = main(page).getByRole("region", { name: "How the day went" });
  await expect(summary.getByTestId("day-totals")).toContainText("Uncategorized");
  await expect(summary.getByText(/1h 30m planned · 1 done · 0 skipped/)).toBeVisible();
  await expect(summary.getByTestId("day-moved")).toContainText(/Deep work: 9:00\sAM – 10:00\sAM → 10:00\sAM – 11:00\sAM/);
  await scrollGridTo(page, 480);
  await expect(main(page).getByTestId("plan-ghost")).toHaveCount(1);

  const notes = summary.getByLabel("Notes for the day");
  await notes.fill("Deep work slipped an hour — school run ran long.");
  await notes.blur();
  await expect(summary.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(main(page).getByLabel("Notes for the day")).toHaveValue("Deep work slipped an hour — school run ran long.");
});
