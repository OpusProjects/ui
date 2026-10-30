import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Configured items are found by name, each opening its own page: an API, a
// script, a webhook, a project, a credential.
test("an API is found by its name and opens its page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await dialog.getByRole("combobox").fill("users");
  const first = dialog.getByRole("option").first();
  await expect(first).toContainText("users");
  await expect(first).toContainText("API");
  await expect(first).toContainText("Portainer users");
  await first.click();
  await expect(page).toHaveURL(/\/apis\/users$/);
});

test("every kind of item is found by name", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Search" });
  const field = dialog.getByRole("combobox");
  for (const [query, label] of [
    ["reload", "Script"],
    ["wh-comm", "Webhook"],
    ["prj-scr", "Project"],
    ["cred-st", "Credential"],
  ]) {
    await field.fill(query);
    await expect(dialog.getByRole("option").first()).toContainText(label);
  }
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

test("a restricted key finds only its own projects' items", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill("cleanup");
  await expect(dialog.getByText("Nothing matches “cleanup”.")).toBeVisible();
  await dialog.getByRole("combobox").fill("wh-");
  await expect(dialog.getByText("Nothing matches “wh-”.")).toBeVisible();
});
