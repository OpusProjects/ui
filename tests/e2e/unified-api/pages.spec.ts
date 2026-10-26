import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

// Every section opens on its own heading, with no error thrown on the way:
// the cheapest check that a refactor did not break a route or an import.
const PAGES: [string, string][] = [
  ["/", "Overview"],
  ["/sources", "Sources"],
  ["/sources/src-alpha", "src-alpha"],
  ["/connectors", "Connectors"],
  ["/connectors/inventory", "inventory"],
  ["/connectors/remote", "remote"],
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

// "This instance" counts the last real minute, not ten seconds times six:
// nothing until a sample a minute old exists, then the counter's increase.
test("this instance counts requests over the last minute", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/");
  const panel = page
    .locator("section", {
      has: page.getByRole("heading", { name: "This instance" }),
    })
    .last();
  await expect(panel).toContainText("Counting…");
  await page.clock.runFor(70_000);
  await expect(panel).toContainText("in the last minute");
});

// Running for counts on, a second at a time, in exact units.
test("this instance's running time ticks", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/");
  const panel = page
    .locator("section", {
      has: page.getByRole("heading", { name: "This instance" }),
    })
    .last();
  // The mock's uptime is 5400 seconds.
  await expect(panel).toContainText("1h 30m");
  await page.clock.runFor(3_000);
  await expect(panel).toContainText(/1h 30m [3-4]s/);
});

// A fact with several values shows the first, then "+N more" under it,
// which opens the rest; "Show fewer" closes them again.
test("a long list of values opens with +N more", async ({ page }) => {
  const { credentials } = await import("./fixtures/api");
  await mockApi(page);
  const many = {
    ...credentials[0],
    backend: "env",
    env_vars: ["A_URL", "A_USER", "A_PASSWORD", "A_CLIENT", "A_SECRET"],
  };
  await page.route(/\/api\/v1\/credentials$/, (route) =>
    route.fulfill({ json: [many] }),
  );
  await page.goto(`/credentials/${many.credential_id}`);
  const row = page.locator("dd", { hasText: "A_URL" });
  await expect(row.getByText("A_URL")).toBeVisible();
  await expect(row.getByText("A_USER")).toHaveCount(0);
  await row.getByRole("button", { name: "+4 more" }).click();
  await expect(row.getByText("A_SECRET")).toBeVisible();
  await row.getByRole("button", { name: "Show fewer" }).click();
  await expect(row.getByText("A_SECRET")).toHaveCount(0);
});

// The Metrics page opens with how the instance is doing, not how many things
// it has: size, load, speed, and its slowest sync, named.
test("the metrics tiles are hosts, requests, response time and sync time", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/metrics");
  // A tile reads its label first (its info hint's text follows it).
  const tile = (label: string) =>
    page.locator("[data-tone]", { hasText: new RegExp(`^${label}`) });
  for (const label of ["Hosts", "Requests", "Response time", "Sync time"])
    await expect(tile(label)).toHaveCount(1);
  for (const gone of ["Sources", "Endpoints", "Projects"])
    await expect(tile(gone)).toHaveCount(0);
});
