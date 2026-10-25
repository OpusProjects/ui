import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("/ finds a host and Enter opens it in its source", async ({ page }) => {
  await mockApi(page);
  await page.goto("/topology");
  await expect(page.locator("h1")).toContainText("Topology");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill("db-01");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await expect(dialog.getByRole("option")).toContainText("src-alpha");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(
    /\/sources\/src-alpha\?host=db-01\.example\.net/,
  );
});

test("Escape closes the search and gives focus back", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Find a host" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});
