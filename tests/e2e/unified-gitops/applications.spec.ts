import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("an application page shows only its overview and its history", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications/drifted");
  // The header says what this application is, in its own words.
  await expect(
    page.locator("header").getByText("Drifted settings"),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByRole("link", { name: "kv" })).toHaveAttribute(
    "href",
    "/connectors/kv",
  );
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toBeVisible();
  // The connector's config stays in the configuration, not on the page.
  await expect(overview.getByText("Config", { exact: true })).toHaveCount(0);
  await expect(page.locator("section", { hasText: "History" })).toBeVisible();
  // Nothing else: no plan, no unmanaged list, no copy of the settings.
  await expect(page.locator("main section")).toHaveCount(2);
  await expect(page.getByText("To apply", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Current entry settings")).toHaveCount(0);
});

// A write from a signed-in browser must carry the session's CSRF token.
test("Push applies, with the CSRF token, and the run lands in history", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/applications/drifted");
  await page.getByRole("button", { name: "Push", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Applied 2 changes");
  expect(calls.writes[0].path).toBe("/api/v1/applications/drifted/sync");
  expect(calls.writes[0].headers["x-csrf-token"]).toBe("e2e-csrf");
  await expect(
    page.locator("section", { hasText: "History" }).getByText("Succeeded"),
  ).toBeVisible();
});

test("a failed application says why, not that it was never checked", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications/broken");
  await expect(
    page.getByText("The last check failed", { exact: true }),
  ).toBeVisible();
  // No description of its own: the header falls back to the generic line.
  await expect(
    page.getByText("How this application stands against git"),
  ).toBeVisible();
});

test("a restricted key sees admin-only names without links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockApi(page, "restricted");
  await page.goto("/applications/drifted");
  // Connectors, projects and credentials are admin pages: named, not linked.
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("kv", { exact: true })).toBeVisible();
  await expect(overview.getByRole("link", { name: "kv" })).toHaveCount(0);
  await expect(overview.getByRole("link", { name: "cred-store" })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("a connector's page links the applications that use it", async ({
  page,
}) => {
  await mockApi(page);
  // The list's cards stay short; who uses a connector is its page's table.
  await page.goto("/connectors/kv");
  await expect(
    page.getByRole("link", { name: "drifted", exact: true }),
  ).toHaveAttribute("href", "/applications/drifted");
});

test("Rollback applies an older sync's commit until the next Push", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/applications/synced");
  const history = page.locator("section", { hasText: "History" });
  // Every row shows it; only the older sync can use it, and a greyed-out
  // one says why on hover.
  const buttons = history.getByRole("button", { name: "Rollback" });
  await expect(buttons).toHaveCount(2);
  const rollback = history.getByRole("button", {
    name: "Rollback",
    disabled: false,
  });
  await expect(rollback).toHaveCount(1);
  await expect(
    history.getByRole("button", { name: "Rollback", disabled: true }),
  ).toHaveAttribute("title", "A check changed nothing to go back to.");
  // The app's own dialog asks first; Escape (or Cancel) does nothing.
  await rollback.click();
  const dialog = page.getByRole("dialog", {
    name: /^Roll synced back to 1111111/,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(calls.writes).toHaveLength(0);
  await rollback.click();
  // What it would change, before deciding, in a dialog over this one, as a
  // diff; asking writes nothing, and Escape closes only the diff.
  await dialog.getByRole("button", { name: "View changes" }).click();
  const changes = page.getByRole("dialog", {
    name: "Changes in rolling synced back to 1111111",
  });
  const diff = changes.getByLabel("Update entry timeout");
  await expect(diff).toContainText('removed: value: "0031"');
  await expect(diff).toContainText('added: value: "0030"');
  expect(calls.writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(changes).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Roll back" }).click();
  // Done, it says at the top; the row's button greys out, its commit now
  // current.
  await expect(page.getByText(/^Rolled back to 1111111/)).toBeVisible();
  expect(calls.writes.at(-1)?.path).toBe(
    "/api/v1/applications/synced/rollback",
  );
  // The newest run, first in History, is the rollback.
  await expect(
    history.getByRole("row").nth(1).getByRole("cell").first(),
  ).toHaveText("Rollback");

  // The next Push applies the latest commit and ends it.
  await page.getByRole("button", { name: "Push", exact: true }).click();
  await expect(page.getByText(/^Rolled back to/)).toHaveCount(0);
});

test("Push all asks first, then pushes every application shown", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/applications");
  const syncAll = page.getByRole("button", { name: "Push all" });
  // Right of Check all.
  const checkBox = await page
    .getByRole("button", { name: "Check all" })
    .boundingBox();
  const syncBox = await syncAll.boundingBox();
  expect(syncBox!.x).toBeGreaterThan(checkBox!.x);

  // Declined: nothing is written.
  await syncAll.click();
  const dialog = page.getByRole("dialog", { name: "Push 3 applications?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls.writes.filter((w) => w.path.endsWith("/sync"))).toHaveLength(0);

  await syncAll.click();
  await dialog.getByRole("button", { name: "Push 3" }).click();
  await expect(page.getByText(/pushed, 1 failed/)).toBeVisible();
  expect(
    calls.writes
      .filter((w) => w.path.endsWith("/sync"))
      .map((w) => w.path)
      .sort(),
  ).toEqual([
    "/api/v1/applications/broken/sync",
    "/api/v1/applications/drifted/sync",
    "/api/v1/applications/synced/sync",
  ]);
});

test("a success message goes after a few seconds; a failure stays", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications");
  const synced = page.locator("article", { hasText: "synced" }).first();
  await synced.getByRole("button", { name: "Check", exact: true }).click();
  const ok = synced.getByRole("status");
  await expect(ok).toHaveText("In sync");
  await expect(ok).toHaveCount(0, { timeout: 6_000 });

  const broken = page.locator("article", { hasText: "broken" });
  await broken.getByRole("button", { name: "Check", exact: true }).click();
  const failed = broken.getByRole("status");
  await expect(failed).toHaveText("Check failed");
  await page.waitForTimeout(4_500);
  await expect(failed).toHaveText("Check failed");
});

// Each run in the history opens what it changed, as the rollback dialog
// shows a rollback's: removed lines and added lines, per object. A run that
// changed nothing has nothing to open.
test("a run's changes open as a diff from its history row", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications/synced");
  const history = page.locator("section", { hasText: "History" });
  const rows = history.getByRole("row");
  await expect(
    rows.nth(1).getByRole("button", { name: "View changes" }),
  ).toBeDisabled();
  await expect(
    history.getByRole("columnheader", { name: "Errors" }),
  ).toHaveCount(0);

  await rows.nth(2).getByRole("button", { name: "View changes" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("apps/demo/entries.yaml");
  await expect(dialog).toContainText("Update entry timeout");
  await expect(dialog).toContainText("0060");
  await expect(dialog).toContainText("0030");
  // An older run: Push would apply git as it is now, not this, so it waits
  // for the newest run's dialog.
  await expect(dialog.getByRole("button", { name: "Push" })).toBeDisabled();
  // The footer's Close (the header's ✕ is named Close too).
  await expect(
    dialog.getByRole("button", { name: "Close" }).last(),
  ).toBeEnabled();

  // A file folds under its header, and opens again.
  const file = dialog.locator("summary", { hasText: "apps/demo/entries.yaml" });
  await file.click();
  await expect(dialog.getByText("Update entry")).toBeHidden();
  await file.click();
  await expect(dialog.getByText("Update entry")).toBeVisible();
});

// A long history pages inside its panel; a short one shows no pager.
test("a long history pages, a short one does not", async ({ page }) => {
  await mockApi(page, "admin", 30);
  await page.goto("/applications/synced");
  const history = page.locator("section", { hasText: "History" });
  const pager = history.getByRole("navigation", { name: "runs pages" });
  // The count only: what the rows are, the table already says.
  await expect(pager).toContainText(/^1–\d+ of 32(?! runs)/);
  await pager.getByRole("button", { name: "Next runs" }).click();
  await expect(pager).not.toContainText(/^1–/);
  // The page is in the address, page size included, so a link opens it.
  await expect(page).toHaveURL(/history-page=2&history-rows=\d+/);
  await page.goto("/applications/synced?history-page=3&history-rows=10");
  await expect(pager).toContainText(/^21–30 of 32/);

  await mockApi(page);
  await page.goto("/applications/drifted");
  await expect(
    page.getByRole("navigation", { name: "runs pages" }),
  ).toHaveCount(0);
});

// From an application's card: what it has to apply, in the same dialog as a
// run's changes, only when it is out of sync with something to apply.
test("a card's View changes opens what the application has to apply", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications");
  const synced = page.locator("article", {
    has: page.getByRole("link", { name: "synced", exact: true }),
  });
  await expect(
    synced.getByRole("button", { name: "View changes" }),
  ).toBeDisabled();
  const drifted = page.locator("article", {
    has: page.getByRole("link", { name: "drifted", exact: true }),
  });
  await drifted.getByRole("button", { name: "View changes" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Changes to apply to drifted");
  await expect(
    dialog.getByRole("button", { name: "Push", exact: true }),
  ).toBeEnabled();
});

// A shared link's page size is kept back on the first page: going back
// does not switch to the viewer's own size.
test("back on the first page, a shared link keeps its page size", async ({
  page,
}) => {
  await mockApi(page, "admin", 30);
  await page.addInitScript(() =>
    localStorage.setItem("unified-ui:page-size:table:runs", "10"),
  );
  await page.goto("/applications/synced?history-page=2&history-rows=20");
  const history = page.locator("section", { hasText: "History" });
  const pager = history.getByRole("navigation", { name: "runs pages" });
  await expect(pager).toContainText(/^21–32 of 32/);
  await pager.getByRole("button", { name: "Previous runs" }).click();
  await expect(pager).toContainText(/^1–20 of 32/);
  await expect(page).toHaveURL(/history-rows=20/);
  await expect(page).not.toHaveURL(/history-page/);
  // Choosing a size makes it the viewer's own: the address drops it.
  await pager.getByRole("combobox").selectOption("50");
  await expect(page).not.toHaveURL(/history-rows/);
});

// A dialog with no buttons under it (the changes over a confirmation) keeps
// Tab inside, and Tab still reaches its file toggles and its scrolling diff.
test("Tab reaches the changes in the rollback's View changes", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications/synced");
  const history = page.locator("section", { hasText: "History" });
  await history
    .getByRole("button", { name: "Rollback", disabled: false })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "View changes" })
    .click();
  const changes = page.getByRole("dialog", {
    name: "Changes in rolling synced back to 1111111",
  });
  await expect(changes.getByLabel("Update entry timeout")).toBeVisible();
  const close = changes.getByRole("button", { name: "Close" });
  await close.focus();
  await page.keyboard.press("Tab");
  await expect(changes.getByRole("region", { name: "Changes" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(changes.locator("summary").first()).toBeFocused();
  // Shift+Tab from the first stop goes round to the last.
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(close).not.toBeFocused();
  await expect(changes.locator(":focus")).toHaveCount(1);
  // A click on the dialog's text keeps the keys in it: Escape closes it.
  await changes.getByRole("heading").first().click();
  await page.keyboard.press("Escape");
  await expect(changes).toHaveCount(0);
});

test("ages keep counting between polls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/applications/synced");
  // Its last check was 20 seconds ago when the page loaded; two seconds
  // later, before any poll, it says so.
  const lastCheck = page
    .locator("dt", { hasText: "Last check" })
    .locator("xpath=following-sibling::dd[1]");
  const before = await lastCheck.innerText();
  await expect(lastCheck).not.toHaveText(before, { timeout: 4000 });
  expect(await lastCheck.innerText()).toMatch(/^2\ds ago$/);
});
