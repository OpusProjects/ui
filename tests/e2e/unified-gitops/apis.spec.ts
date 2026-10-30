import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the list shows what each API watches, calls and how its last run went", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/apis");
  await expect(page.getByRole("region", { name: "APIs health" })).toBeVisible();

  const users = page.locator("article", { hasText: "users" });
  await expect(users.getByText("Working", { exact: true })).toBeVisible();
  await expect(users.getByText("prj-infra", { exact: true })).toBeVisible();
  await expect(
    users.getByText("PUT https://portainer.example.com"),
  ).toBeVisible();
  await expect(users.getByText("users/*.json")).toBeVisible();
  await expect(users.getByText("A change, by hand")).toBeVisible();
  await expect(users.getByText(/^2 steps, /)).toBeVisible();

  const groups = page.locator("article", { hasText: "groups" });
  await expect(groups.getByText("Failing", { exact: true })).toBeVisible();
  await expect(groups.getByText("HTTP 503: Service Unavailable")).toBeVisible();
  await expect(groups.getByText("1 of 1 step failed")).toBeVisible();

  const audit = page.locator("article", { hasText: "audit" });
  await expect(audit.getByText("Disabled").first()).toBeVisible();
  await expect(audit.getByText("Every file")).toBeVisible();
  await expect(audit.getByText("Schedule (0 * * * *)")).toBeVisible();
  await expect(audit.getByText("Never", { exact: true })).toBeVisible();
});

test("the list searches by destination, path and label", async ({ page }) => {
  await mockApi(page);
  await page.goto("/apis");
  const search = page.getByRole("searchbox", { name: "Search APIs" });
  await search.fill("audit.example");
  await expect(page.locator("article h2")).toHaveText(["audit"]);
  await search.fill("team=platform");
  await expect(page.locator("article h2")).toHaveText(["users"]);
  await search.fill("nothing like this");
  await expect(page.getByText("No APIs match")).toBeVisible();
});

test("an API's page shows its settings and its runs with their steps", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/apis");
  await page.getByRole("link", { name: "users", exact: true }).click();
  await expect(page).toHaveURL("/apis/users");
  await expect(
    page.locator("header").getByText("Portainer users"),
  ).toBeVisible();

  const overview = page.locator("section", { hasText: "Overview" }).first();
  await expect(
    overview.getByRole("link", { name: "prj-infra" }),
  ).toHaveAttribute("href", "/projects/prj-infra");
  await expect(
    overview.getByText("PUT https://portainer.example.com"),
  ).toBeVisible();
  await expect(
    overview.getByText("Bearer token", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("One request per changed file", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Compares first, sends only a difference", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(overview.getByText("users/README.md")).toBeVisible();
  await expect(overview.getByText("team=platform")).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");

  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Change");
  await expect(rows.nth(0)).toContainText("4b825dc");
  await expect(rows.nth(0)).toContainText("2 steps");
  await expect(rows.nth(0)).toContainText("Worked");

  // Each run's steps: file, action, method, URL, status, changed fields.
  await rows.nth(0).getByRole("button", { name: "View steps" }).click();
  const dialog = page.getByRole("dialog");
  const steps = dialog.locator("tbody tr");
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0)).toContainText("users/jane.json");
  await expect(steps.nth(0)).toContainText("update");
  await expect(steps.nth(0)).toContainText("PUT");
  await expect(steps.nth(0)).toContainText(
    "https://portainer.example.com/api/users/jane",
  );
  await expect(steps.nth(0)).toContainText("HTTP 200");
  await expect(steps.nth(0)).toContainText("role");
  await expect(steps.nth(1)).toContainText("skip");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("a failed run's steps say why", async ({ page }) => {
  await mockApi(page);
  await page.goto("/apis/groups");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  await expect(history.locator("tbody tr").nth(0)).toContainText("Failed");
  await history.getByRole("button", { name: "View steps" }).click();
  const step = page.getByRole("dialog").locator("tbody tr");
  await expect(step).toContainText("HTTP 503");
  await expect(step).toContainText("HTTP 503: Service Unavailable");
  await expect(step).toContainText("3");
});

test("Dry run posts with dry_run and shows each body it would send", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/apis/users");
  await page.getByRole("button", { name: "Dry run" }).click();
  await expect(page.getByText("Dry run: 1 step")).toBeVisible();
  expect(calls.writes.map((w) => w.path)).toEqual([
    "/api/v1/apis/users/run?dry_run=true",
  ]);
  expect(calls.writes[0].headers["x-csrf-token"]).toBe("e2e-csrf");

  const result = page.locator("section", {
    has: page.getByRole("heading", { name: /^Dry run/ }),
  });
  await expect(result.getByText("Would work")).toBeVisible();
  await expect(result.getByText("Manual (dry run), e2e")).toBeVisible();
  await expect(result.getByLabel("Body as JSON")).toContainText('"admin"');
  // Kept in the history too, marked so.
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  await expect(history.locator("tbody tr")).toHaveCount(3);
  await expect(history.locator("tbody tr").nth(0)).toContainText(
    "Manual (dry run)",
  );
  await result.getByRole("button", { name: "Close" }).click();
  await expect(result).toHaveCount(0);
});

test("Run now asks first, then runs and shows the run", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/apis/users");
  await page.getByRole("button", { name: "Run now" }).click();
  const ask = page.getByRole("dialog", { name: "Run users now?" });
  await ask.getByRole("button", { name: "Cancel" }).click();
  expect(calls.writes).toEqual([]);

  await page.getByRole("button", { name: "Run now" }).click();
  await ask.getByRole("button", { name: "Run now" }).click();
  await expect(page.getByText("Ran: 1 step")).toBeVisible();
  expect(calls.writes.map((w) => w.path)).toEqual([
    "/api/v1/apis/users/run?dry_run=false",
  ]);
  const result = page.locator("section", {
    has: page.getByRole("heading", { name: /^Run\b/ }),
  });
  await expect(result.getByText("Worked").first()).toBeVisible();
  await expect(result.locator("tbody tr")).toContainText("HTTP 200");
});

test("an API that does not run by hand can only be dry run", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/apis/groups");
  await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Dry run" })).toBeEnabled();
});

test("an unknown API says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/apis/nope");
  await expect(page.getByText("No such API")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See every API" }),
  ).toHaveAttribute("href", "/apis");
});
