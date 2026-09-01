import type { Page } from "@playwright/test";

/** Content area only — avoids matching the same text in the nav or hot sidebar. */
export const main = (page: Page) => page.getByRole("main");

export async function setWorkspace(page: Page, name: "Personal" | string) {
  // the switcher button is labelled with the current workspace name
  const current = page.locator("header button").first();
  await current.click();
  await page.getByRole("option", { name, exact: true }).click();
}

export async function createTodo(page: Page, title: string, opts: { priority?: string } = {}) {
  await page.goto("/todos");
  await main(page).getByRole("button", { name: "New todo" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  if (opts.priority) await page.getByLabel("Priority", { exact: true }).selectOption(opts.priority);
  await page.getByRole("button", { name: "Add todo" }).click();
  await main(page).getByRole("link", { name: title, exact: true }).first().waitFor();
}
