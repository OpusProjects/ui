import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("a project card's title opens the project's page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  const title = page.getByRole("link", { name: "prj-infra", exact: true });
  await expect(title).toHaveAttribute("href", "/projects/prj-infra");
  await title.click();
  await expect(page).toHaveURL("/projects/prj-infra");
  await expect(page.locator("h1")).toContainText("prj-infra");
});

test("a project's page shows its overview, never its token", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/projects/prj-infra");
  // The header says what the project is, in its own words.
  await expect(
    page.locator("header").getByText("Infrastructure", { exact: true }),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(
    overview.getByRole("link", { name: "git.example.com/ops/infra" }),
  ).toHaveAttribute("href", "https://git.example.com/ops/infra");
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");
  await expect(overview.getByText("On disk", { exact: true })).toHaveCount(0);
  await expect(overview.getByText("Synced")).toBeVisible();
  expect(await page.content()).not.toContain("SECRET-TOKEN");
});

test("Pull pulls the project, with the CSRF token", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/projects/prj-infra");
  // A page action, beside the title.
  await page
    .locator("main > header, main header")
    .first()
    .getByRole("button", { name: "Pull", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Pulled");
  expect(calls.writes[0].path).toBe("/api/v1/projects/prj-infra/sync");
  expect(calls.writes[0].headers["x-csrf-token"]).toBe("e2e-csrf");
});

test("a project's page lists the APIs, scripts and webhooks acting on it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/projects/prj-infra");
  const panel = (name: RegExp) =>
    page.locator("section", { has: page.getByRole("heading", { name }) });
  // One table per kind, as unified-api lists a project's sources.
  const apis = panel(/^APIs/).locator("tbody tr");
  await expect(apis).toHaveCount(3);
  const groups = apis.filter({ hasText: "groups" });
  await expect(groups).toContainText("Failing");
  await expect(groups).toContainText("POST https://portainer.example.com");
  // The name is the link, the description over it.
  await expect(
    groups.getByRole("link", { name: "groups", exact: true }),
  ).toHaveAttribute("href", "/apis/groups");
  await expect(groups.getByText("Portainer groups")).toBeVisible();
  await expect(apis.filter({ hasText: "audit" })).toContainText("Disabled");

  const scripts = panel(/^Scripts/).locator("tbody tr");
  await expect(scripts).toHaveCount(1);
  await expect(scripts).toContainText("prj-scripts: dns/reload.sh");
  await expect(
    scripts.getByRole("link", { name: "reload-dns", exact: true }),
  ).toHaveAttribute("href", "/scripts/reload-dns");

  const hooks = panel(/^Webhooks/).locator("tbody tr");
  await expect(hooks).toHaveCount(3);
  await expect(hooks.filter({ hasText: "wh-failures" })).toContainText(
    "alerts.example.com",
  );
  // History stays the last table.
  await expect
    .poll(() =>
      page
        .locator("main section h2, main section h3")
        .last()
        .evaluate((h) => h.firstChild?.textContent ?? h.textContent),
    )
    .toBe("History");
});

test("a project nothing acts on says so", async ({ page }) => {
  await mockApi(page);
  const { projects } = await import("./fixtures/api");
  await page.route(/\/api\/v1\/projects$/, (route) =>
    route.fulfill({
      json: projects.map((p) => ({
        ...p,
        used_by: { apis: [], scripts: [], webhooks: [] },
      })),
    }),
  );
  await page.goto("/projects/prj-infra");
  await expect(
    page.getByText("Nothing acts on this project's changes"),
  ).toBeVisible();
});

test("an unknown project says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects/nope");
  await expect(page.getByText("No such project")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See every project" }),
  ).toHaveAttribute("href", "/projects");
});

test("a restricted key sees its own projects only", async ({ page }) => {
  await mockApi(page, "restricted");
  await page.goto("/projects");
  await expect(page.locator("article h2")).toHaveText(["prj-infra"]);
  await page.goto("/projects/prj-scripts");
  await expect(page.getByText("No such project")).toBeVisible();
});

// A pull restarts the project's ages from the new answer, even when it
// reports the same age as the last one did: without when the answer came,
// two equal ages look like one and the count ran on from the first.
test("a Pull restarts Last attempt and Last success", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/projects/prj-infra");
  await page.waitForLoadState("networkidle");
  const fact = (label: string) =>
    page
      .locator("section", { hasText: "Overview" })
      .locator("dl > div", { has: page.locator("dt", { hasText: label }) })
      .first();
  await expect(fact("Last success")).toContainText("20s ago");
  // Less than a poll: only the live clock moves them.
  await page.clock.runFor(10_000);
  await expect(fact("Last success")).toContainText("30s ago");
  await expect(fact("Last attempt")).toContainText("30s ago");
  await page
    .locator("main > header, main header")
    .first()
    .getByRole("button", { name: "Pull", exact: true })
    .click();
  // The fixture answers 20 again: the count starts over from it.
  await expect(fact("Last success")).toContainText("20s ago");
  await expect(fact("Last attempt")).toContainText("20s ago");
});

// Pull all does what each card's Pull does, for every project shown: the
// same route, the same refresh, so each card's Last pull starts over.
test("Pull all pulls every project and restarts their Last pull", async ({
  page,
}) => {
  await page.clock.install();
  const calls = await mockApi(page);
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const lastPull = page
    .locator("article", {
      has: page.getByRole("heading", { name: "prj-infra" }),
    })
    .locator("dl > div", { has: page.locator("dt", { hasText: "Last pull" }) });
  await expect(lastPull).toContainText("20s ago");
  await page.clock.runFor(10_000);
  await expect(lastPull).toContainText("30s ago");

  await page.getByRole("button", { name: "Pull all" }).click();
  await expect(page.getByRole("status").first()).toContainText("2 projects");
  expect(calls.writes.map((w) => w.path).sort()).toEqual([
    "/api/v1/projects/prj-infra/sync",
    "/api/v1/projects/prj-scripts/sync",
  ]);
  await expect(lastPull).toContainText("20s ago");
});

// A project's last pulls: why each ran, the commits it moved between, and
// why one failed.
test("a project's page lists its last pulls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects/prj-infra");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Scheduled");
  await expect(rows.nth(0)).toContainText("aaaaaaa → bbbbbbb");
  await expect(rows.nth(1)).toContainText("could not resolve host");
  await expect(rows.nth(1)).toContainText("Failed");
});
