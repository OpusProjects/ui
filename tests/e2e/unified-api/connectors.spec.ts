import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the menu lists Connectors right after Sources", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const items = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link");
  const labels = await items.allInnerTexts();
  const sources = labels.indexOf("Sources");
  expect(sources).toBeGreaterThanOrEqual(0);
  expect(labels[sources + 1]).toBe("Connectors");
  await items.filter({ hasText: "Connectors" }).click();
  await expect(page).toHaveURL("/connectors");
  await expect(page.locator("h1")).toContainText("Connectors");
});

test("the list shows a card per connector, built-ins marked", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  const cards = page.locator("article");
  await expect(cards).toHaveCount(3);
  // The configured connector, failing because one of its sources is.
  const inventory = cards.filter({ hasText: "inventory.py" });
  await expect(inventory).toContainText("Inventory database");
  await expect(inventory).toContainText("Sources failing");
  // No "Used by" on a card: the sources are a table on the connector's page.
  await expect(inventory).not.toContainText("1 healthy, 1 failing");
  await expect(inventory.getByText("Built in")).toHaveCount(0);
  await expect(
    inventory.getByRole("link", { name: "prj-inventory" }),
  ).toHaveAttribute("href", "/projects/prj-inventory");
  // The two built-ins: no path; what they read, and "Built in" where a
  // script names its project. Nothing uses them here: Unused, not Idle.
  for (const id of ["remote", "static_inventory"]) {
    const card = cards.filter({
      has: page.getByRole("link", { name: id, exact: true }),
    });
    await expect(card.getByText("Built in", { exact: true })).toBeVisible();
    await expect(card).toContainText("Project");
    await expect(card).toContainText("Unused");
    await expect(card).not.toContainText("File");
  }
  // The header never names the product: the built-ins' own words are used.
  await expect(page.locator("main")).not.toContainText("unified-api");
  await expect(page.getByText("1 of 3 connectors")).toBeVisible();
});

test("search narrows the list and Show all brings it back", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  const cards = page.locator("article");
  await expect(cards).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Search connectors" }).fill("beta");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("inventory");
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(cards).toHaveCount(3);
});

test("a connector card's title opens the connector's page", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  const title = page.getByRole("link", { name: "inventory", exact: true });
  await expect(title).toHaveAttribute("href", "/connectors/inventory");
  await title.click();
  await expect(page).toHaveURL("/connectors/inventory");
  await expect(page.locator("h1")).toContainText("inventory");
});

test("a connector's page shows its facts and the sources using it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors/inventory");
  await expect(
    page.locator("header").getByText("Inventory database"),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("Sources failing")).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "prj-inventory" }),
  ).toHaveAttribute("href", "/projects/prj-inventory");
  await expect(overview.getByText("connectors/inventory.py")).toBeVisible();
  await expect(overview.getByText("--format json")).toBeVisible();
  await expect(overview.getByText("--host", { exact: true })).toBeVisible();
  await expect(overview.getByText("native", { exact: true })).toBeVisible();
  await expect(overview.getByText("5m", { exact: true })).toBeVisible();

  const usedBy = page.locator("section", {
    has: page.getByRole("heading", { name: /^Sources / }),
  });
  const rows = usedBy.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  const beta = rows.filter({ hasText: "src-beta" });
  await expect(beta).toContainText("1m 30s");
  await expect(beta).toContainText("Failing");
  await expect(rows.filter({ hasText: "src-alpha" })).toContainText("5m");
  await usedBy.getByRole("link", { name: "ALPHA" }).click();
  await expect(page).toHaveURL("/sources/src-alpha");
});

test("a built-in connector says what it is instead of a path", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors/remote");
  await expect(
    page.locator("header").getByText("Copies a source from another instance."),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview).toContainText("(built in)");
  await expect(overview).toContainText("A source on another instance");
  await expect(overview).not.toContainText("Path");
  await expect(page.getByText("No source uses this connector")).toBeVisible();
});

test("an unknown connector says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/connectors/nope");
  await expect(page.getByText("No such connector")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See every connector" }),
  ).toHaveAttribute("href", "/connectors");
});

test("a source's page links to its connector", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview).toContainText("(script)");
  const link = overview.getByRole("link", { name: "inventory", exact: true });
  await expect(link).toHaveAttribute("href", "/connectors/inventory");
  await link.click();
  await expect(page).toHaveURL("/connectors/inventory");
});

test("a source's card links to its connector", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources");
  const card = page.locator("article", { hasText: "src-alpha" });
  await expect(
    card.getByRole("link", { name: "inventory", exact: true }),
  ).toHaveAttribute("href", "/connectors/inventory");
});

test("a project's page lists the connectors using it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects/prj-inventory");
  const panel = page.locator("section", {
    has: page.getByRole("heading", { name: /^Connectors / }),
  });
  const row = panel.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("script");
  await expect(row).toContainText("Sources failing");
  await expect(
    row.getByRole("link", { name: "inventory", exact: true }),
  ).toHaveAttribute("href", "/connectors/inventory");
});

// An ssh connector says what it runs: files on the host (Runs, *On the
// host*), a script here (File, its project), or its own inline script (in a
// few words, never a fragment cut at its last "/").
test("an ssh connector shows where its path is", async ({ page }) => {
  await mockApi(page);
  const { connectors } = await import("./fixtures/api");
  const ssh = (
    connector_id: string,
    location: string | null,
    path: string | null,
    project_id: string | null = null,
    script: string | null = null,
  ) => ({
    ...connectors[0],
    connector_id,
    name: connector_id,
    connector_type: "ssh",
    location,
    path,
    project_id,
    script,
    script_args: [],
    host_args: [],
    output_format: null,
    used_by: [],
    health: { sources: 0, healthy: 0, failing: 0, never_synced: 0 },
  });
  const all = [
    ...connectors,
    ssh("ssh-py", null, null, null, "#!/usr/bin/env -S python3 -u\nprint(1)"),
    ssh("ssh-facts", "host", "/etc/ansible/facts.d/*.fact"),
    ssh("ssh-osinfo", "instance", "ssh/osinfo.sh", "prj-inventory"),
    ssh(
      "ssh-inline",
      null,
      null,
      null,
      "j(){ printf '%s' \"$1\" | tr -d '\"\\\\'; }\nuname -r\nhostname",
    ),
  ];
  await page.route(/\/api\/v1\/connectors(\/[^/?]+)?(\?.*)?$/, (route) => {
    const id = /\/api\/v1\/connectors\/([^/?]+)/.exec(route.request().url());
    return route.fulfill({
      json: id ? all.find((c) => c.connector_id === id[1]) : all,
    });
  });
  await page.goto("/connectors");
  const card = (id: string) =>
    page.locator("article", { has: page.getByRole("heading", { name: id }) });

  const facts = card("ssh-facts");
  await expect(facts.getByText("Runs", { exact: true })).toBeVisible();
  await expect(
    facts.getByText("/etc/ansible/facts.d/*.fact", { exact: true }),
  ).toBeVisible();
  await expect(facts.getByText("On the host", { exact: true })).toBeVisible();

  const script = card("ssh-osinfo");
  await expect(script.getByText("File", { exact: true })).toBeVisible();
  await expect(script.getByText("osinfo.sh", { exact: true })).toBeVisible();
  await expect(
    script.getByRole("link", { name: "prj-inventory" }),
  ).toBeVisible();

  const inline = card("ssh-inline");
  await expect(
    inline.getByText("Shell script, 3 lines", { exact: true }),
  ).toBeVisible();
  await expect(
    inline.getByText("Inline script", { exact: true }),
  ).toBeVisible();

  // Named after the interpreter its #! line names.
  await expect(
    card("ssh-py").getByText("Python script, 2 lines", { exact: true }),
  ).toBeVisible();

  // Found by what it runs.
  await page
    .getByRole("searchbox")
    .or(page.getByPlaceholder(/search/i))
    .first()
    .fill("hostname");
  await expect(card("ssh-inline")).toBeVisible();
  await expect(card("ssh-facts")).toHaveCount(0);

  // Its page: the whole script, and no warning: inline is a choice.
  await page.goto("/connectors/ssh-inline");
  await expect(page.getByText("Written inline")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: /command run on each host/i })
      .or(page.getByLabel("Command run on each host")),
  ).toContainText("hostname");
});
