import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Every section opens on its own heading, with no error thrown on the way:
// the cheapest check that a refactor did not break a route or an import.
const PAGES: [string, string][] = [
  ["/", "Overview"],
  ["/sources", "Sources"],
  ["/sources/src-alpha", "src-alpha"],
  ["/endpoints", "Endpoints"],
  ["/endpoints/ep-all", "ep-all"],
  ["/projects", "Projects"],
  ["/projects/prj-inventory", "prj-inventory"],
  ["/credentials", "Credentials"],
  ["/credentials/cred-inventory", "cred-inventory"],
  ["/topology", "Topology"],
  ["/metrics", "Metrics"],
  ["/config", "Configuration"],
];

for (const [path, heading] of PAGES) {
  test(`${path} opens`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockApi(page);
    await page.goto(path);
    await expect(page.locator("h1").first()).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test("the overview names what is broken", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByText("Source src-beta is failing, 2 syncs in a row"),
  ).toBeVisible();
});

test("signing out asks to come back to the UI", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const form = page.locator('form[action="/api/v1/logout"]');
  await expect(form.locator('input[name="next"]')).toHaveValue("/");
});
