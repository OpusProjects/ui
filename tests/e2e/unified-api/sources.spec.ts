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

// Sync means fresh data, now. A federated source asks its origin to gather
// again (refresh_origin), or it would only copy the origin's cache; a local
// source gathers anyway, and is asked nothing more (the flag would stop it
// reusing a sync already running). Which is which comes with the list, to
// every key: no detail needed, so a Sync pressed early asks the same.
test("Sync asks a federated source's origin to gather, and only it", async ({
  page,
}) => {
  const calls = await mockApi(page);
  const { detail, sources } = await import("./fixtures/api");
  // src-beta reads another instance.
  const listed = sources.map((s) =>
    s.source_id === "src-beta" ? { ...s, federated: true } : s,
  );
  await page.route(/\/api\/v1\/sources(\?.*)?$/, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: listed })
      : route.fallback(),
  );
  const beta = listed.find((s) => s.source_id === "src-beta")!;
  // Its own detail held back: the card's Sync must not need it.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/v1\/sources\/src-beta$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await held;
    await route.fulfill({ json: { ...detail(beta), federated: true } });
  });

  await page.goto("/sources");
  const card = (id: string) =>
    page.locator("article", { has: page.getByRole("heading", { name: id }) });
  await card("src-beta")
    .getByRole("button", { name: "Sync", exact: true })
    .click();
  await expect.poll(() => calls.writes.length).toBe(1);
  expect(calls.writes[0].query).toBe("?refresh_origin=true");
  await card("src-alpha")
    .getByRole("button", { name: "Sync", exact: true })
    .click();
  await expect.poll(() => calls.writes.length).toBe(2);
  expect(calls.writes[1].query).toBe("");

  await page.getByRole("button", { name: "Sync all", exact: true }).click();
  await expect.poll(() => calls.writes.length).toBe(4);
  const all = Object.fromEntries(
    calls.writes.slice(2).map((w) => [w.path, w.query]),
  );
  expect(all).toEqual({
    "/api/v1/sources/src-alpha/sync": "",
    "/api/v1/sources/src-beta/sync": "?refresh_origin=true",
  });
  release();

  // The source's own page reads the same flag from its detail.
  await page.goto("/sources/src-beta");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect.poll(() => calls.writes.length).toBe(5);
  expect(calls.writes[4].query).toBe("?refresh_origin=true");
});

// The button says Syncing… for as long as the sync runs and the new data
// loads, and only then is it pressable again.
test("Sync shows Syncing… until the new data is in", async ({ page }) => {
  await mockApi(page);
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.route("**/api/v1/sources/src-alpha/sync*", async (route) => {
    await answered;
    await route.fulfill({
      json: {
        source_id: "src-alpha",
        success: true,
        total_hosts: 3,
        total_groups: 1,
        duration_ms: 5,
        scope: "full",
        error: null,
        coalesced: false,
      },
    });
  });
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  const busy = page.getByRole("button", { name: "Syncing…" });
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();
  answer();
  await expect(page.getByText("Synced 3 hosts")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sync", exact: true }),
  ).toBeEnabled();
});

// After a Sync, Data from and its meter start again from the age the server
// gives, even when that age is the same number as before (30s in the
// fixture, before and after): each answer is counted from when it came.
test("a Sync resets Data from and its meter", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  const dataFrom = page
    .locator("section", { hasText: "Overview" })
    .locator("dl > div", { has: page.locator("dt", { hasText: "Data from" }) })
    .first();
  await expect(dataFrom).toContainText("30s ago");
  const meter = dataFrom.getByRole("meter");
  const before = Number(await meter.getAttribute("aria-valuenow"));
  // Less than a poll: only the live clock moves it.
  await page.clock.runFor(10_000);
  await expect(dataFrom).toContainText("40s ago");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(dataFrom).toContainText("30s ago");
  await expect
    .poll(async () => Number(await meter.getAttribute("aria-valuenow")))
    .toBe(before);
});

// A card is titled by the item's name, as the page it opens is, with the
// description under it: sources and endpoints read like every other card.
test("source and endpoint cards are titled by name", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources");
  const alpha = page.locator("article", { hasText: "src-alpha" });
  await expect(alpha.getByRole("heading")).toHaveText("src-alpha");
  await expect(alpha.getByText("ALPHA", { exact: true })).toBeVisible();

  await page.goto("/endpoints");
  const all = page.locator("article", { hasText: "ep-all" });
  await expect(all.getByRole("heading")).toHaveText("ep-all");
  await expect(all.getByText("Everything", { exact: true })).toBeVisible();
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
  await expect(page.getByText("2 groups", { exact: true })).toBeVisible();
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

// A source whose ssh connector writes its script inline says so, as its
// connector's page does, and shows no blank Script.
test("a source with an inline ssh script says so", async ({ page }) => {
  await mockApi(page);
  const { detail, sources } = await import("./fixtures/api");
  const alpha = sources.find((s) => s.source_id === "src-alpha")!;
  await page.route(/\/api\/v1\/sources\/src-alpha$/, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            ...detail(alpha),
            gathering: {
              ...detail(alpha).gathering!,
              connector_type: "ssh",
              project_id: null,
              script_path: "",
              location: null,
              inline_script: true,
            },
          },
        })
      : route.fallback(),
  );
  await page.goto("/sources/src-alpha");
  // What a reader sees in each fact row (its hint stays out of it).
  await expect
    .poll(() => page.locator("dl > div").allInnerTexts())
    .toEqual(
      expect.arrayContaining([
        "Script\nInline script",
        "Project\nInline script",
      ]),
    );
});

// The host variables column fits a 1024px window: its search box shrinks
// and its controls wrap rather than pushing Copy past the edge.
test("a source page fits a 1024px window", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/sources/src-alpha");
  await page.waitForLoadState("networkidle");
  await page.getByRole("option", { name: "web-01.example.net" }).click();
  await expect(page.getByText("192.0.2.10")).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

// Counts group thousands with a comma whatever the browser's language: in
// Spanish, toLocaleString() wrote 1023 with no separator at all.
test.describe("in a Spanish browser", () => {
  test.use({ locale: "es-ES" });

  test("a count of thousands reads 1,023", async ({ page }) => {
    await mockApi(page);
    const { detail, sources } = await import("./fixtures/api");
    const listed = sources.map((s) =>
      s.source_id === "src-alpha" ? { ...s, total_hosts: 1023 } : s,
    );
    const alpha = listed.find((s) => s.source_id === "src-alpha")!;
    await page.route(/\/api\/v1\/sources(\?.*)?$/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: listed })
        : route.fallback(),
    );
    await page.route(/\/api\/v1\/sources\/src-alpha$/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: { ...detail(alpha), total_hosts: 1023, total_groups: 12000 },
          })
        : route.fallback(),
    );

    await page.goto("/sources");
    const card = page.locator("article", {
      has: page.getByRole("heading", { name: "src-alpha" }),
    });
    await expect(card).toContainText("1,023");
    await expect(card).toContainText("12,000 groups");
    await expect(card).not.toContainText("1023");

    await page.goto("/sources/src-alpha");
    await expect(
      page.getByText("1,023", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("12,000", { exact: true }).first(),
    ).toBeVisible();
  });
});

// A cron schedule reads in words, as an interval does ("every 10m"), the
// expression itself on hover: on a source's card and page, and a project's.
test("cron schedules read in words", async ({ page }) => {
  await mockApi(page);
  const { detail, sources, projects } = await import("./fixtures/api");
  const alpha = sources.find((s) => s.source_id === "src-alpha")!;
  const scheduled = detail(alpha);
  scheduled.gathering = {
    ...scheduled.gathering!,
    schedule: "15 4 * * *",
    sync_interval_seconds: null,
  };
  await page.route(/\/api\/v1\/sources\/src-alpha$/, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: scheduled })
      : route.fallback(),
  );
  const pulled = projects.map((p) =>
    p.project_id === "prj-inventory"
      ? { ...p, schedule: "0 */4 * * *", sync_interval_seconds: null }
      : p,
  );
  await page.route(/\/api\/v1\/projects(\?.*)?$/, (route) =>
    route.fulfill({ json: pulled }),
  );
  await page.route(/\/api\/v1\/projects\/prj-inventory$/, (route) =>
    route.fulfill({ json: pulled[0] }),
  );

  await page.goto("/sources");
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "src-alpha" }),
  });
  const words = card.getByText("daily at 04:15 UTC");
  await expect(words).toBeVisible();
  await expect(words).toHaveAttribute("title", "cron (UTC): 15 4 * * *");
  await expect(card).not.toContainText("15 4 * * *");

  await page.goto("/sources/src-alpha");
  await expect(page.getByText("daily at 04:15 UTC")).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByText("every 4h").first()).toBeVisible();
  await page.goto("/projects/prj-inventory");
  await expect(page.getByText("every 4h").first()).toHaveAttribute(
    "title",
    "cron (UTC): 0 */4 * * *",
  );
});

// Order: a menu after the toolbar's buttons. Worst first by default (the
// health order, in the page's own words), A to Z and the rest on a click,
// remembered for the list.
test("the order menu reorders the cards and remembers it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources");
  const titles = () => page.locator("article h2, article h3").allInnerTexts();
  const order = page.getByRole("button", { name: "Order" });
  await expect(order).toHaveAttribute("aria-expanded", "false");

  // src-beta is stale: worst first, it leads.
  await expect.poll(titles).toEqual(["src-beta", "src-alpha"]);
  await order.click();
  const menu = page.getByRole("menu", { name: "Order" });
  await expect(menu.getByRole("menuitemradio")).toHaveText([
    "A to Z",
    "Z to A",
    "Fresh to Stale",
    "Stale to Fresh",
  ]);
  await expect(
    menu.getByRole("menuitemradio", { name: "Stale to Fresh" }),
  ).toHaveAttribute("aria-checked", "true");

  await menu.getByRole("menuitemradio", { name: "A to Z" }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(titles).toEqual(["src-alpha", "src-beta"]);

  // Remembered for this list.
  await page.reload();
  await expect.poll(titles).toEqual(["src-alpha", "src-beta"]);

  // The keyboard: arrows move, Enter picks, Escape closes back on the button.
  await order.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitemradio", { name: "A to Z" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(titles).toEqual(["src-alpha", "src-beta"]);
  await order.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(order).toBeFocused();
});

test("other lists order by name only, A to Z first", async ({ page }) => {
  await mockApi(page);
  await page.goto("/credentials");
  await page.getByRole("button", { name: "Order" }).click();
  const items = page
    .getByRole("menu", { name: "Order" })
    .getByRole("menuitemradio");
  await expect(items).toHaveText(["A to Z", "Z to A"]);
  await expect(items.first()).toHaveAttribute("aria-checked", "true");
});

// A source's last syncs, newest first: why and by whom, what each covered
// and brought, or why it failed.
test("a source's page lists its last syncs", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sources/src-alpha");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Manual by key-ops");
  await expect(rows.nth(0)).toContainText("Full");
  await expect(rows.nth(0)).toContainText("1,234 hosts, 12 groups");
  await expect(rows.nth(0)).toContainText("4.2s");
  await expect(rows.nth(0)).toContainText("Synced");
  await expect(rows.nth(1)).toContainText("Scheduled");
  await expect(rows.nth(1)).toContainText("sync timed out after 300s");
  await expect(rows.nth(1)).toContainText("Failed");
});

test("a project's page lists its last pulls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects/prj-inventory");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Manual by key-ops");
  await expect(rows.nth(0)).toContainText("1111111 → 2222222");
  await expect(rows.nth(0)).toContainText("Pulled");
  await expect(rows.nth(1)).toContainText("1111111 no change");
});

// The History panel keeps the space panels keep between them, after the
// hosts as after "No data yet".
for (const cached of [true, false]) {
  test(`History keeps its space from what is above it${cached ? "" : ", no data yet"}`, async ({
    page,
  }) => {
    await mockApi(page);
    if (!cached) {
      const { detail, sources } = await import("./fixtures/api");
      const alpha = sources.find((s) => s.source_id === "src-alpha")!;
      await page.route(/\/api\/v1\/sources\/src-alpha$/, (route) =>
        route.fulfill({ json: { ...detail(alpha), cached: false } }),
      );
    }
    await page.goto("/sources/src-alpha");
    const history = page.locator("section", {
      has: page.getByRole("heading", { name: /^History/ }),
    });
    await history.waitFor();
    const gap = await history.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.previousElementSibling!.getBoundingClientRect().bottom,
    );
    expect(gap).toBeGreaterThanOrEqual(16);
  });
}
