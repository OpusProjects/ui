import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("a project card's title opens the project's page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  const title = page.getByRole("link", { name: "prj-state", exact: true });
  await expect(title).toHaveAttribute("href", "/projects/prj-state");
  await title.click();
  await expect(page).toHaveURL("/projects/prj-state");
  await expect(page.locator("h1")).toContainText("prj-state");
});

test("a project's page shows its overview, never its token", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/projects/prj-state");
  // The header says what the project is, in its own words.
  await expect(
    page.locator("header").getByText("Desired state", { exact: true }),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(
    overview.getByRole("link", { name: "git.example.com/ops/state" }),
  ).toHaveAttribute("href", "https://git.example.com/ops/state");
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");
  await expect(overview.getByText("On disk", { exact: true })).toHaveCount(0);
  await expect(overview.getByText("Synced")).toBeVisible();
  expect(await page.content()).not.toContain("SECRET-TOKEN");
});

test("Pull pulls the project, with the CSRF token", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/projects/prj-state");
  // A page action, beside the title.
  await page
    .locator("main > header, main header")
    .first()
    .getByRole("button", { name: "Pull", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Pulled");
  expect(calls.writes[0].path).toBe("/api/v1/projects/prj-state/sync");
  expect(calls.writes[0].headers["x-csrf-token"]).toBe("e2e-csrf");
});

test("a project's page lists the applications and connectors using it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/projects/prj-state");
  // One table per kind of user, as unified-api lists a project's sources.
  const apps = page.locator("section", {
    has: page.getByRole("heading", { name: /^Applications / }),
  });
  const appRows = apps.locator("tbody tr");
  await expect(appRows).toHaveCount(3);
  const drifted = appRows.filter({ hasText: "drifted" });
  await expect(drifted).toContainText("Out of sync");
  // The name is the link, the description under it.
  await expect(
    drifted.getByRole("link", { name: "drifted", exact: true }),
  ).toHaveAttribute("href", "/applications/drifted");
  await expect(drifted.getByText("drifted", { exact: true })).toBeVisible();

  const connectors = page.locator("section", {
    has: page.getByRole("heading", { name: /^Connectors / }),
  });
  const kv = connectors.locator("tbody tr").filter({ hasText: "kv" });
  await expect(
    kv.getByRole("link", { name: "kv", exact: true }),
  ).toHaveAttribute("href", "/connectors/kv");
  await expect(kv).toContainText("connectors/kv.py");
});

test("an unknown project says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects/nope");
  await expect(page.getByText("No such project")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See every project" }),
  ).toHaveAttribute("href", "/projects");
});

test("a restricted key is refused the project page, with the reason", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/projects/prj-state");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load this project",
  );
});
