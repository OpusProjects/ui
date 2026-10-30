import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Every section opens on its own heading, with no error thrown on the way.
const PAGES: [string, string][] = [
  ["/", "Overview"],
  ["/apis", "APIs"],
  ["/apis/users", "users"],
  ["/apis/groups", "groups"],
  ["/apis/audit", "audit"],
  ["/scripts", "Scripts"],
  ["/scripts/reload-dns", "reload-dns"],
  ["/scripts/cleanup", "cleanup"],
  ["/projects", "Projects"],
  ["/projects/prj-infra", "prj-infra"],
  ["/credentials", "Credentials"],
  ["/credentials/cred-store", "cred-store"],
  ["/webhooks", "Webhooks"],
  ["/webhooks/wh-failures", "wh-failures"],
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
  await expect(
    page.getByText("API groups failed: HTTP 503: Service Unavailable"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Script cleanup failed: exited with 2/ }),
  ).toHaveAttribute("href", "/scripts/cleanup");
  await expect(
    page.getByText("Credential cred-store is missing"),
  ).toBeVisible();
  // Working and disabled items are not news.
  await expect(page.getByText(/API users/)).toHaveCount(0);
  await expect(page.getByText(/API audit/)).toHaveCount(0);
});

test("a token in a project's git address is never shown", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("git.example.com/ops/infra")).toBeVisible();
  expect(await page.content()).not.toContain("SECRET-TOKEN");
});

test("a restricted key sees its projects' items and no admin sections", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/scripts");
  // cleanup watches another project.
  await expect(page.locator("article h2")).toHaveText(["reload-dns"]);
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "APIs" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Webhooks" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Credentials" })).toHaveCount(0);
  await page.goto("/scripts/cleanup");
  await expect(page.getByText("No such script")).toBeVisible();
});

test("no menu entry or link leads to the removed applications and connectors", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator("h1").first()).toContainText("Overview");
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Applications" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Connectors" })).toHaveCount(0);
  await expect(page.locator('a[href^="/applications"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/connectors"]')).toHaveCount(0);
  for (const gone of ["/applications", "/connectors/kv"]) {
    await page.goto(gone);
    await expect(page).toHaveURL("/");
  }
});

test("a card's title is the name, with the description under it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/apis");
  await expect(page.locator("article h2")).toHaveText([
    "audit",
    "groups",
    "users",
  ]);
  const users = page.locator("article", { hasText: "users" });
  await expect(users.getByText("Portainer users")).toBeVisible();
  // audit has no description: nothing is drawn for it.
  expect(await page.locator("main").innerText()).not.toContain("null");
  await page.goto("/projects");
  const project = page.locator("article", { hasText: "prj-infra" });
  await expect(project.getByText("Infrastructure")).toBeVisible();
  await expect(project.getByRole("link", { name: "cred-store" })).toBeVisible();
});

// What this instance does, not the UI polling it.
test("the overview charts the runs", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByText("Runs (per minute)")).toBeVisible();
  await expect(page.getByText("Requests per minute")).toHaveCount(0);
  // Each point counts a whole minute, so the first needs a minute of samples.
  await page.clock.runFor(70_000);
  const chart = page.getByLabel(/^Runs \(per minute\), latest/);
  await expect(chart).toBeVisible();
  await chart.focus();
  const tip = page.getByRole("status").filter({ hasText: "in the minute" });
  // API and script runs add up to the total; failed is within them.
  await expect(tip).toContainText("API runs");
  await expect(tip).toContainText("script runs");
  await expect(tip).toContainText("of which");
});

test("the metrics page charts runs, not requests received", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/metrics");
  await expect(page.getByText("Runs (per minute)")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Run time/ })).toBeVisible();
  await expect(page.getByText("Incoming requests (per minute)")).toHaveCount(0);
  // 6 API runs at 300 ms and 2 script runs at 900 ms a sample: 450 ms.
  const chart = page.getByLabel(/^Mean run time, latest/);
  await expect(chart).toBeVisible({ timeout: 25_000 });
  await chart.focus();
  const tip = page.getByRole("status").filter({ hasText: "APIs" });
  await expect(tip).toContainText("450ms");
  await expect(tip).toContainText("scripts 900ms");
});

test("the metrics page has runs by item and pulls by project", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/metrics");
  await expect(page.getByText("API routes")).toHaveCount(0);
  await expect(page.getByText(/application/i)).toHaveCount(0);

  const runs = page.locator("section", { hasText: "Runs by item" });
  const users = runs.getByRole("row", { name: /users/ });
  await expect(users).toContainText("300ms");
  await expect(users).toContainText("API");
  await expect(runs.getByRole("row", { name: /reload-dns/ })).toContainText(
    "Script",
  );
  await expect(
    runs
      .getByRole("row", { name: /groups/ })
      .getByRole("cell")
      .nth(3),
  ).not.toHaveText("0");

  const pulls = page.locator("section", { hasText: "Pull health by project" });
  // Failing first.
  await expect(pulls.getByRole("row").nth(1)).toContainText("prj-scripts");
  await expect(pulls.getByRole("row").nth(1)).toContainText(
    "3 failed in a row",
  );
  await expect(pulls.getByRole("row", { name: /prj-infra/ })).toContainText(
    "Working",
  );
});

// An item whose name is too long for the panel is cut short with its whole
// name on hover; the pills beside it never are, and the table does not
// scroll sideways.
test("a long item name is cut short, whole on hover", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await mockApi(page);
  const { METRICS } = await import("./fixtures/api");
  const long = `groups-${"very-long-item-name-".repeat(8)}end`;
  let scrape = 0;
  await page.route(/\/metrics$/, (route) =>
    route.request().resourceType() === "document"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: METRICS(++scrape).replaceAll('"groups"', `"${long}"`),
        }),
  );
  await page.goto("/metrics");
  const panel = page.locator("section", { hasText: "Runs by item" });
  const name = panel.locator("tbody [data-col]", { hasText: "groups-" });
  await expect(name).toHaveAttribute("title", long);
  await expect(name).toHaveAttribute("data-clip", "true");
  await expect
    .poll(() =>
      panel
        .locator("table")
        .evaluate(
          (t) => t.parentElement!.scrollWidth - t.parentElement!.clientWidth,
        ),
    )
    .toBe(0);
});

// A credential's card opens its page, failing ones included: what it is,
// why it does not resolve, and what uses it.
test("a credential card opens the credential's page", async ({ page }) => {
  await mockApi(page);
  await page.goto("/credentials");
  await page.getByRole("link", { name: "cred-store" }).click();
  await expect(page).toHaveURL("/credentials/cred-store");
  await expect(page.locator("header").getByText("Store API")).toBeVisible();
  await expect(page.getByText("Env var 'STORE_TOKEN' not set")).toBeVisible();
  const panel = (name: RegExp) =>
    page.locator("section", { has: page.getByRole("heading", { name }) });
  await expect(
    panel(/^APIs/).getByRole("link", { name: "users", exact: true }),
  ).toHaveAttribute("href", "/apis/users");
  await expect(
    panel(/^Scripts/).getByRole("link", { name: "reload-dns", exact: true }),
  ).toHaveAttribute("href", "/scripts/reload-dns");
  await expect(
    panel(/^Webhooks/).getByRole("link", { name: "wh-failures", exact: true }),
  ).toHaveAttribute("href", "/webhooks/wh-failures");
  await expect(panel(/^Projects/).locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText(/application/i)).toHaveCount(0);
});

// A detail panel's facts: three columns at most, as Ascender and AWX lay out
// theirs; fewer when the panel is narrower.
for (const [width, columns] of [
  [1920, 3],
  [1440, 3],
  [1100, 2],
] as const) {
  test(`facts sit in ${columns} columns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto("/apis/users");
    const overview = page.locator("section", { hasText: "Overview" }).first();
    await expect(overview.locator("dt").first()).toBeVisible();
    const lefts = await overview
      .locator("dl > div")
      .evaluateAll((items) =>
        items.map((el) => Math.round(el.getBoundingClientRect().left)),
      );
    expect(new Set(lefts).size).toBe(columns);
  });
}

test("the overview charts runs and requests to repositories apart", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Runs (per minute)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Requests sent to repositories (per minute)",
    }),
  ).toBeVisible();
  const instance = page.locator("section", { hasText: "This instance" });
  await expect(instance.getByText("Failing", { exact: true })).toBeVisible();
  await expect(instance.getByText("2 of 5 items")).toBeVisible();
  await expect(instance.getByText("Requests to repositories")).toBeVisible();
});

test("the overview has a card for each area", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const main = page.getByRole("main");
  for (const [name, to] of [
    ["APIs", "/apis"],
    ["Scripts", "/scripts"],
    ["Webhooks", "/webhooks"],
    ["Projects", "/projects"],
    ["Credentials", "/credentials"],
  ])
    await expect(
      main.getByRole("link", { name: new RegExp(`^${name}`) }),
    ).toHaveAttribute("href", to);
});
// While its list loads, each Overview card is a placeholder of its size: the
// row keeps its five places instead of filling in card by card.
test("the overview holds a place for each card while it loads", async ({
  page,
}) => {
  await mockApi(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/v1\/projects$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/");
  const row = page.locator("[aria-busy=true]");
  await expect(row.locator("> div")).toHaveCount(1);
  await expect(row.locator("> *")).toHaveCount(5);
  const placeholder = await row.locator("> div").boundingBox();
  const card = await row.locator("> a").first().boundingBox();
  expect(placeholder?.height).toBe(card?.height);
  release();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await expect(row.locator("> a")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("link", { name: /^Projects/ }),
  ).toBeVisible();
});
