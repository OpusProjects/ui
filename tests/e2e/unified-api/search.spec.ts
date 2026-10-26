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
  const trigger = page.getByRole("button", { name: "Search" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

// The host search failing (an error, a backend without it) leaves the name
// matches, and says what could not be searched.
test("a failing host search still shows the names that match", async ({
  page,
}) => {
  await mockApi(page);
  await page.route(/\/api\/v1\/hosts\/search(\?.*)?$/, (route) =>
    route.fulfill({ status: 500, json: { error: "search is down" } }),
  );
  await page.goto("/");
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill("src-");
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await expect(dialog.getByRole("option").first()).toContainText("src-alpha");
  await expect(dialog.getByRole("status")).toContainText(
    "Could not search hosts by name",
  );
});
