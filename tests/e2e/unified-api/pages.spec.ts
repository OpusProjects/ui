import { expect, test } from "@playwright/test";
import { credentials, mockApi } from "./fixtures/api";

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

// What it receives and what it sends to the systems' APIs, apart.
test("the overview charts incoming and outgoing requests apart", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Incoming requests (per minute)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Outgoing requests (per minute)" }),
  ).toBeVisible();
  const instance = page.locator("section", { hasText: "This instance" });
  await expect(
    instance.getByText("Incoming requests", { exact: true }),
  ).toBeVisible();
  await expect(
    instance.getByText("Outgoing requests", { exact: true }),
  ).toBeVisible();
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

// A fact with several values shows the first, with "+N more" beside it,
// which opens the rest; "Show fewer", on a line after them, closes them.
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
  // On the value's own line, to its right: no line of its own.
  const value = await row.getByText("A_URL").boundingBox();
  const more = await row.getByRole("button", { name: "+4 more" }).boundingBox();
  expect(
    Math.abs(more!.y + more!.height / 2 - (value!.y + value!.height / 2)),
  ).toBeLessThan(4);
  expect(more!.x).toBeGreaterThan(value!.x + value!.width);
  await row.getByRole("button", { name: "+4 more" }).click();
  await expect(row.getByText("A_SECRET")).toBeVisible();
  const last = await row.getByText("A_SECRET").boundingBox();
  const fewer = await row
    .getByRole("button", { name: "Show fewer" })
    .boundingBox();
  expect(fewer!.y).toBeGreaterThanOrEqual(last!.y + last!.height - 1);
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

// A Vault is a credential: Configuration lists each in the Secrets card (name,
// address, cache), and its own page lists the credentials read from it.
test("each Vault is a row of the Secrets card, with its readers on its page", async ({
  page,
}) => {
  await mockApi(page);
  const vault = {
    ...credentials[0],
    credential_id: "cred-vault",
    name: "Team Vault",
    type: "vault",
    backend: "vault",
    env_vars: ["VAULT_TOKEN"],
    secret_keys: ["token"],
    vault: null,
    vault_connection: {
      address: "https://vault.example.net:8200",
      mount: "secret",
      auth: "token",
      kubernetes_role: null,
      token_env: "VAULT_TOKEN",
      timeout_seconds: 10,
      cache_ttl_seconds: 300,
    },
    used_by: {
      credentials: ["cred-d42"],
      sources: [],
      projects: [],
      ldap: false,
    },
  };
  const reader = {
    ...credentials[0],
    credential_id: "cred-d42",
    name: "Device42",
    backend: "vault",
    vault: "cred-vault",
    vault_path: "infra/d42",
    env_vars: [],
  };
  await page.route(/\/api\/v1\/credentials$/, (route) =>
    route.fulfill({ json: [...credentials, vault, reader] }),
  );

  await page.goto("/config");
  const secrets = page.locator("section", { hasText: "Secrets" }).last();
  const row = secrets.getByRole("row", { name: /Team Vault/ });
  await expect(row).toContainText("https://vault.example.net:8200");
  await expect(row).toContainText("5m");

  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/credentials\/cred-vault$/);
  await expect(page.getByText("VAULT_TOKEN")).toBeVisible();
  const readerRow = page.getByRole("row", { name: /Device42/ });
  await expect(readerRow).toContainText("infra/d42");
  await expect(readerRow.getByRole("link", { name: "cred-d42" })).toBeVisible();
});
