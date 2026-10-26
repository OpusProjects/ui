import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("/ finds objects, says whether git declares them, and Enter opens one", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  await expect(page.locator("h1")).toContainText("Connectors");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  const field = dialog.getByRole("combobox");
  await field.fill("time");
  // The same key in two applications: one result each, both declared.
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(2);
  const drifted = options.filter({ hasText: "entry in drifted" });
  await expect(drifted).toContainText("timeout");
  await expect(drifted).toContainText("In git");
  await expect(drifted).toContainText(/read (.* ago|just now)/);
  await expect(options.filter({ hasText: "entry in synced" })).toHaveCount(1);

  // Found by a value: the field it was found in is named.
  await field.fill("0030");
  await expect(options).toHaveCount(1);
  await expect(options).toContainText("matched in value");

  await field.fill("hand");
  await expect(options).toHaveCount(1);
  await expect(options).toContainText("Not in git");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL("/applications/drifted");
});

test("Ctrl+K opens the search, and nothing found says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("combobox").fill("nothing like this");
  await expect(
    dialog.getByText("Nothing matches “nothing like this”."),
  ).toBeVisible();
});

test("Escape closes the search and gives focus back", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("a restricted key finds only its own applications' objects", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/applications");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill("time");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await expect(dialog.getByRole("option")).toContainText("entry in drifted");
});

// Configured items are found by name too, first, each opening its own page:
// an application, a connector, a project, a credential.
test("an application is found by its name and opens its page", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await dialog.getByRole("combobox").fill("drifted");
  const first = dialog.getByRole("option").first();
  await expect(first).toContainText("drifted");
  await expect(first).toContainText("Application");
  await first.click();
  await expect(page).toHaveURL(/\/applications\/drifted$/);
});
