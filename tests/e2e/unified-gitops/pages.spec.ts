import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Every section opens on its own heading, with no error thrown on the way.
const PAGES: [string, string][] = [
  ["/", "Overview"],
  ["/applications", "Applications"],
  ["/applications/drifted", "drifted"],
  ["/applications/broken", "broken"],
  ["/connectors", "Connectors"],
  ["/connectors/kv", "kv"],
  ["/projects", "Projects"],
  ["/projects/prj-state", "prj-state"],
  ["/credentials", "Credentials"],
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

test("the overview names what needs a person", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Application broken failed")).toBeVisible();
  await expect(
    page.getByText("Application drifted is out of sync: 2 changes to apply"),
  ).toBeVisible();
  await expect(
    page.getByText("Credential cred-store is missing"),
  ).toBeVisible();
});

test("a token in a project's git address is never shown", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("git.example.com/ops/state")).toBeVisible();
  expect(await page.content()).not.toContain("SECRET-TOKEN");
});

test("a restricted key sees its applications and no admin sections", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/applications");
  await expect(page.locator("article h2")).toHaveText(["drifted"]);
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Applications" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Connectors" })).toHaveCount(0);
});

test("no menu entry or link leads to the removed targets pages", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications/drifted");
  await expect(page.locator("h1").first()).toContainText("drifted");
  await expect(page.locator('a[href^="/targets"]')).toHaveCount(0);
  await page.goto("/targets");
  await expect(page).toHaveURL("/");
});

test("a card's title is the name, with the description under it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/applications");
  // Worst first, as every list orders them.
  await expect(page.locator("article h2")).toHaveText([
    "broken",
    "drifted",
    "synced",
  ]);
  const drifted = page.locator("article", { hasText: "drifted" });
  await expect(drifted.getByText("Drifted settings")).toBeVisible();
  // broken has no description: nothing is drawn for it.
  expect(await page.locator("main").innerText()).not.toContain("null");
  await page.goto("/projects");
  const project = page.locator("article", { hasText: "prj-state" });
  await expect(project.getByText("Desired state")).toBeVisible();
  await expect(project.getByRole("link", { name: "cred-store" })).toBeVisible();
});

// What this instance does to the systems, not the UI polling it.
test("the overview charts the calls made to the systems", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByText("Requests to applications per minute"),
  ).toBeVisible();
  await expect(page.getByText("Requests per minute")).toHaveCount(0);
  // Each point counts a whole minute, so the first needs a minute of samples.
  await page.clock.runFor(70_000);
  const chart = page.getByLabel(/^Requests to applications per minute, latest/);
  await expect(chart).toBeVisible();
  await chart.focus();
  const tip = page.getByRole("status").filter({ hasText: "in the minute" });
  // Reads, writes and describes add up to the total; failed is within them.
  await expect(tip).toContainText("reads");
  await expect(tip).toContainText("writes");
  await expect(tip).toContainText("describes");
  await expect(tip).toContainText("of which");
});

test("connectors have a summary, a search and Show all like the other lists", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  // The summary counts whether their requests work, as the overview's card.
  await expect(
    page.getByRole("region", { name: "connectors health" }),
  ).toBeVisible();
  // Kinds and users are the connector page's tables, not the card's.
  const card = page.locator("article", { hasText: "kv" });
  await expect(
    card.getByText(/^(Idle|Working|Requests failing)$/),
  ).toBeVisible();
  await expect(card.getByText("Kinds", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Used by", { exact: true })).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Search connectors" });
  await search.fill("powerscale.py");
  await expect(page.getByRole("heading", { name: "powerscale" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "kv" })).toHaveCount(0);
  await search.fill("nothing like this");
  await expect(page.getByText("No connectors match")).toBeVisible();
  await search.fill("");
  await expect(page.getByRole("button", { name: "Show all" })).toBeVisible();
});

test("the metrics page charts calls to systems, not requests received", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/metrics");
  await expect(
    page.getByText("Requests to applications per minute"),
  ).toBeVisible();
  await expect(page.getByText("Connector response time")).toBeVisible();
  await expect(page.getByText("Incoming requests per minute")).toHaveCount(0);
  // 6 reads at 300 ms and 2 writes at 900 ms a sample: a 450 ms mean.
  const chart = page.getByLabel(/^Mean connector response time, latest/);
  await expect(chart).toBeVisible({ timeout: 25_000 });
  await chart.focus();
  const tip = page.getByRole("status").filter({ hasText: "reads" });
  await expect(tip).toContainText("450ms");
  await expect(tip).toContainText("writes 900ms");
});

test("the metrics page has calls and check health by application", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/metrics");
  await expect(page.getByText("API routes")).toHaveCount(0);
  await expect(page.getByText("Changes to apply by application")).toHaveCount(
    0,
  );

  const calls = page.locator("section", { hasText: "Requests by application" });
  const drifted = calls.getByRole("row", { name: /drifted/ });
  // 6 reads at 300 ms, 2 writes at 900 ms: a 450 ms mean.
  await expect(drifted).toContainText("450ms");
  await expect(
    calls
      .getByRole("row", { name: /broken/ })
      .getByRole("cell")
      .nth(3),
  ).not.toHaveText("0");

  const checks = page.locator("section", {
    hasText: "Check health by application",
  });
  // Failing first.
  await expect(checks.getByRole("row").nth(1)).toContainText("broken");
  await expect(checks.getByRole("row").nth(1)).toContainText(
    "3 failed in a row",
  );
  await expect(checks.getByRole("row", { name: /synced/ })).toContainText(
    "Working",
  );
});

// A connector's card counts failing requests, sampled while the page is open.
test("the overview flags a connector whose requests fail", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const card = page
    .getByRole("main")
    .getByRole("link", { name: /^Connectors/ });
  await expect(card).toBeVisible();
  // Two samples, ten seconds apart, before there is anything to compare.
  await expect(
    page.getByRole("link", { name: /Connector kv: \d+ failed request/ }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(card).toContainText("Working");
});

// A credential's card opens its page, failing ones included: what it is,
// why it does not resolve, and what uses it.
test("a credential card opens the credential's page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/credentials");
  await page.getByRole("link", { name: "cred-store" }).click();
  await expect(page).toHaveURL("/credentials/cred-store");
  await expect(page.locator("header").getByText("Store API")).toBeVisible();
  await expect(
    page.getByText("Env var 'STORE_PASSWORD' not set"),
  ).toBeVisible();
  const apps = page.locator("section", {
    has: page.getByRole("heading", { name: /^Applications / }),
  });
  await expect(
    apps.getByRole("link", { name: "drifted", exact: true }),
  ).toHaveAttribute("href", "/applications/drifted");
  const projects = page.locator("section", {
    has: page.getByRole("heading", { name: /^Projects / }),
  });
  await expect(projects.locator("tbody tr")).toHaveCount(1);
});
