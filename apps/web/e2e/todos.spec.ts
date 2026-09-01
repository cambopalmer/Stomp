import { expect, test } from "@playwright/test";
import { createTodo, main } from "./_helpers.js";

test("create, edit, complete and delete a todo", async ({ page }) => {
  const title = `e2e todo ${Date.now()}`;
  await createTodo(page, title, { priority: "high" });

  const row = main(page).getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText("High")).toBeVisible();

  await row.getByRole("link", { name: title, exact: true }).click();
  await expect(page).toHaveURL(/\/todos\/[0-9a-f-]{36}$/);
  await expect(main(page).getByRole("heading", { name: title })).toBeVisible();

  // add a subtask
  await page.getByPlaceholder("Add a subtask…").fill("first subtask");
  await main(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(main(page).getByText("first subtask")).toBeVisible();
  await expect(main(page).getByRole("heading", { name: /Subtasks \(1\)/ })).toBeVisible();

  // mark done via the status buttons, then confirm on the list
  await page.getByRole("button", { name: "done", exact: true }).click();
  await page.goto("/todos");
  await expect(
    main(page).getByRole("checkbox", { name: `Mark "${title}" not done` }),
  ).toBeChecked();

  // delete
  page.once("dialog", (d) => d.accept());
  await main(page)
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: `Delete ${title}` })
    .click();
  await expect(main(page).getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("priority filter narrows the list", async ({ page }) => {
  await page.goto("/todos");
  await page.getByLabel("Filter by priority").selectOption("urgent");
  await expect(main(page).getByRole("link", { name: "Call the vet", exact: true })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Ship Phase 0", exact: true })).toHaveCount(0);
});
