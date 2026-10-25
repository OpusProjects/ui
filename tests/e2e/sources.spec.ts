import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("a source's hosts open with their variables", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.getByText("web-01.example.net").click();
  await expect(page.getByText("192.0.2.10")).toBeVisible();
  await expect(page).toHaveURL(/host=web-01\.example\.net/);
});

// A write from a signed-in browser must carry the session's CSRF token, or
// the API refuses it.
test("Sync sends the CSRF token", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.getByRole("button", { name: /sync/i }).first().click();
  await expect.poll(() => calls.writes.length).toBe(1);
  expect(calls.writes[0].path).toBe("/api/v1/sources/src-alpha/sync");
  expect(calls.writes[0].headers["x-csrf-token"]).toBe("e2e-csrf");
});

test("a token in a project's git address is never shown", async ({ page }) => {
  await mockApi(page);
  for (const path of ["/projects", "/projects/prj-inventory"]) {
    await page.goto(path);
    await expect(
      page.getByText("git.example.com/ops/inventory").first(),
    ).toBeVisible();
    expect(await page.content()).not.toContain("SECRET-TOKEN");
  }
});
