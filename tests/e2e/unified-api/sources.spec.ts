import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("a source's hosts open with their variables", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  // Every fetch answered before the first click: under load, a click that
  // lands while the page is still filling in can be lost to a re-render.
  await page.waitForLoadState("networkidle");
  // The list entry, not the heading of the host it may already show.
  await page.getByRole("option", { name: "web-01.example.net" }).click();
  await expect(page.getByText("192.0.2.10")).toBeVisible();
  await expect(page).toHaveURL(/host=web-01\.example\.net/);
});

// A write from a signed-in browser must carry the session's CSRF token, or
// the API refuses it.
test("Sync sends the CSRF token", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
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

// Every reference on a source's page opens what it names; several
// credentials sit one per line, under the value column.
test("a source's credentials each link to their page, one per line", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  const first = page.getByRole("link", { name: "cred-d42", exact: true });
  const second = page.getByRole("link", {
    name: "cred-inventory",
    exact: true,
  });
  await expect(first).toHaveAttribute("href", "/credentials/cred-d42");
  // The first only, with "+1 more" beside it, which opens the rest under it.
  await expect(second).toHaveCount(0);
  await page.getByRole("button", { name: "+1 more" }).click();
  await expect(second).toHaveAttribute("href", "/credentials/cred-inventory");
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y);
  expect(Math.round(b!.x)).toBe(Math.round(a!.x));
  await expect(
    page.getByRole("link", { name: "prj-inventory" }),
  ).toHaveAttribute("href", "/projects/prj-inventory");
});

// The hosts list's page is in the address too, so a link to page 2 opens
// page 2, and the host it shows first is one from that page.
test("the hosts list opens on the page its link names", async ({ page }) => {
  await mockApi(page);
  const hosts = Array.from(
    { length: 25 },
    (_, i) => `host-${String(i + 1).padStart(2, "0")}.example.net`,
  );
  await page.route(/\/api\/v1\/sources\/src-alpha\/hosts(\?.*)?$/, (route) =>
    route.fulfill({
      json: { source_id: "src-alpha", total_hosts: hosts.length, hosts },
    }),
  );
  await page.goto("/sources/src-alpha?hosts-page=2&hosts-rows=10");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("navigation", { name: "hosts pages" }),
  ).toContainText(/^11–20 of 25/);
  await expect(page).toHaveURL(/host=host-11\.example\.net/);
  await expect(page).toHaveURL(/hosts-page=2/);
});

// Hosts | Groups: the same list and panel, for the source's groups; the
// title, the count and the panel follow, and the choice is in the address.
test("a source's groups show their own variables", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await expect(page).toHaveURL(/list=groups/);
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
  await expect(page.getByText("2 groups")).toBeVisible();
  await page.getByRole("option", { name: "all" }).click();
  await expect(page).toHaveURL(/group=all/);
  const vars = page.getByRole("heading", { name: "all", exact: true });
  await expect(vars).toBeVisible();
  await expect(page.getByText("2 variables, 3 hosts")).toBeVisible();
  await expect(page.getByText("ntp.example.net")).toBeVisible();
  // Back to hosts, where the host chosen before is still chosen.
  await page
    .getByRole("group", { name: "Show" })
    .getByRole("button", { name: "Hosts" })
    .click();
  await expect(page.getByRole("heading", { name: "Hosts" })).toBeVisible();
});

// A group's card shows its hosts instead of its variables: one per line, in
// the same box, searchable and copied as plain lines; YAML | JSON is set aside.
test("a group's card switches between its hosts and its variables", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha?list=groups&group=all");
  await page.waitForLoadState("networkidle");
  const view = page.getByRole("group", { name: "View" });
  const format = page.getByRole("group", { name: "Format" });
  await expect(format.getByRole("button", { name: "YAML" })).toBeEnabled();
  await view.getByRole("button", { name: "Hosts" }).click();
  const list = page.getByLabel("Hosts", { exact: true });
  await expect(list).toBeVisible();
  const lines = (await list.textContent())!.split("\n");
  expect(lines.length).toBeGreaterThan(1);
  expect(lines).toEqual([...lines].sort());
  await expect(format.getByRole("button", { name: "YAML" })).toBeDisabled();
  await page.getByPlaceholder("Search hosts").fill(lines[0]);
  await expect(list).toHaveText(lines[0]);
  await view.getByRole("button", { name: "Variables" }).click();
  await expect(page.getByPlaceholder("Search variables")).toBeVisible();
  await expect(format.getByRole("button", { name: "YAML" })).toBeEnabled();
});

// Hosts and Groups are two lists: each keeps the page size chosen for it.
test("hosts and groups each keep their own page size", async ({ page }) => {
  await mockApi(page);
  const hosts = Array.from(
    { length: 25 },
    (_, i) => `host-${String(i + 1).padStart(2, "0")}.example.net`,
  );
  await page.route(/\/api\/v1\/sources\/src-alpha\/hosts(\?.*)?$/, (route) =>
    route.fulfill({
      json: { source_id: "src-alpha", total_hosts: hosts.length, hosts },
    }),
  );
  await page.route(/\/api\/v1\/sources\/src-alpha\/groups(\?.*)?$/, (route) =>
    route.fulfill({
      json: Array.from({ length: 25 }, (_, i) => ({
        name: `group-${String(i + 1).padStart(2, "0")}`,
        host_count: 1,
        children: [],
        has_vars: false,
      })),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("unified-ui:page-size:source-hosts", "10");
    localStorage.setItem("unified-ui:page-size:source-groups", "20");
  });
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("navigation", { name: "hosts pages" }),
  ).toContainText(/^1–10 of 25/);
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  const groups = page.getByRole("navigation", { name: "groups pages" });
  await expect(groups).toContainText(/^1–20 of 25/);
  await groups.getByRole("combobox").selectOption("50");
  await expect(groups).toContainText(/^1–25 of 25/);
  await page
    .getByRole("group", { name: "Show" })
    .getByRole("button", { name: "Hosts" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "hosts pages" }),
  ).toContainText(/^1–10 of 25/);
});

test("ages keep counting between polls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources");
  const card = page.locator("article").first();
  const attempt = card
    .locator("dt", { hasText: "Last attempt" })
    .locator("xpath=following-sibling::dd[1]");
  const before = await attempt.innerText();
  await expect(attempt).not.toHaveText(before, { timeout: 4000 });
  expect(await attempt.innerText()).toMatch(/^3\ds ago$/);
});
