import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("cards say what each instance provides, in words that agree with the number", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/topology");
  const peer = page.locator("article", { hasText: "edge" });
  await expect(peer).toContainText("1 source, 3 hosts, 2 groups, 1 endpoint");
  await expect(peer).toContainText("https://unified-api-edge.example.net");
});

// An edge reads from nobody: its map is the one the central pushed, with the
// central at the root and this instance marked among its peers. Each line is
// green where data gets through and red where it does not.
test("an edge draws the federation its central pushed", async ({ page }) => {
  await mockApi(page);
  const edgeSource = {
    source_id: "src-edge-facts",
    remote_source: "src-ssh-facts",
    cached: true,
    hosts: 40,
    groups: 6,
    age_seconds: 20,
    consecutive_failures: 0,
  };
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { version: "9.9.9", sources: 1, peers: [] } }),
  );
  await page.route(/\/api\/v1\/topology\/federation$/, (route) =>
    route.fulfill({
      json: [
        {
          pushed_by: "key-central",
          url: "https://unified-api-edge.example.net",
          sender_url: "https://unified-api-central.example.net",
          sender: {
            sources: ["src-d42", "src-edge-dc2-facts", "src-edge-facts"],
            hosts: 1250,
            groups: 48,
            endpoints: 6,
            oldest_age_seconds: 300,
          },
          age_seconds: 30,
          topology: {
            version: "9.9.9",
            sources: 30,
            peers: [
              {
                url: "https://unified-api-edge.example.net",
                sources: [edgeSource],
                instance: { version: "9.9.9", sources: 1, peers: [] },
              },
              {
                url: "https://unified-api-dc2.example.net",
                sources: [{ ...edgeSource, source_id: "src-dc2-facts" }],
                error: "unreachable",
              },
            ],
          },
        },
      ],
    }),
  );
  await page.goto("/topology");

  const tree = page.getByRole("list", { name: /federation/i });
  const central = tree.locator("article").first();
  await expect(central).toContainText("central");
  await expect(central).toContainText(
    "https://unified-api-central.example.net",
  );
  // The same facts the central's own page shows on its own card.
  await expect(central).toContainText(
    "3 sources, 1,250 hosts, 48 groups, 6 endpoints",
  );
  await expect(central).not.toContainText("Map sent");
  await expect(tree).toContainText("edge (this instance)");
  await expect(tree.locator('li[data-link="ok"]')).toHaveCount(1);
  await expect(tree.locator('li[data-link="failing"]')).toHaveCount(1);
  // This instance's chips open its own sources, by their names here.
  await expect(
    tree.getByRole("link", { name: "src-ssh-facts" }),
  ).toHaveAttribute("href", "/sources/src-ssh-facts");
});

// A dot crosses a link when data has just moved along it: a pull seconds
// ago sends one; a link last pulled long ago stays still.
for (const [age, moving] of [
  [3, true],
  [600, false],
] as const)
  test(`a link last pulled ${age}s ago ${moving ? "shows" : "shows no"} dot`, async ({
    page,
  }) => {
    await mockApi(page);
    const { topology } = await import("./fixtures/api");
    const peer = topology.peers![0];
    await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          ...topology,
          peers: [
            {
              ...peer,
              sources: peer.sources.map((s) => ({
                ...s,
                last_pull_age_seconds: age,
              })),
            },
          ],
        },
      }),
    );
    await page.goto("/topology");
    // The light: a trail and a head in a group that shows only on a trip.
    const dot = page.locator("ul[aria-label] svg g[opacity]").first();
    await expect(dot).toHaveCount(1);
    await page.waitForTimeout(600);
    const opacity = await dot.evaluate((g) => getComputedStyle(g).opacity);
    expect(opacity).toBe(moving ? "1" : "0");
  });

// A peer swapped for another (as many peers as before) is a new card for
// its line to meet: the line follows it, also when the page resizes.
test("a line follows a peer swapped for another", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  const peer = topology.peers![0];
  let url = peer.url;
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { ...topology, peers: [{ ...peer, url }] } }),
  );
  await page.goto("/topology");
  const tree = page.getByRole("list", { name: /federation/i });
  await expect(tree).toContainText("edge");
  url = "https://unified-api-dc3.example.net";
  await page.clock.fastForward(61_000);
  await expect(tree).toContainText("dc3");
  // Still wide enough for the levels side by side (narrower, they stack).
  await page.setViewportSize({ width: 1500, height: 720 });
  // The line ends at the new card's left edge, halfway down it.
  const card = tree.locator("li li [data-tree-node] > *").first();
  await expect
    .poll(async () => {
      const line = await tree.locator("svg line").first().boundingBox();
      const box = await card.boundingBox();
      return line && box
        ? Math.abs(line.x + line.width - box.x) < 2 &&
            Math.abs(line.y + line.height - (box.y + box.height / 2)) < 2
        : false;
    })
    .toBe(true);
});

// The same pull read again a minute later can come back a second or so
// off (ages are whole seconds): no dot for it. A new pull gets one.
for (const [later, moving] of [
  [62, false],
  [2, true],
] as const)
  test(`a refetch reading a pull ${later}s ago ${moving ? "shows" : "shows no"} dot`, async ({
    page,
  }) => {
    await page.clock.install();
    await mockApi(page);
    const { topology } = await import("./fixtures/api");
    const peer = topology.peers![0];
    let age = 3;
    await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          ...topology,
          peers: [
            {
              ...peer,
              sources: peer.sources.map((s) => ({
                ...s,
                last_pull_age_seconds: age,
              })),
            },
          ],
        },
      }),
    );
    const refetched = () => page.waitForResponse(/\/api\/v1\/topology(\?.*)?$/);
    await page.goto("/topology");
    const dot = page.locator("ul[aria-label] svg g[opacity]").first();
    await expect(dot).toHaveCount(1);
    // The first trip, for the pull just before the page opened, ends.
    await page.waitForTimeout(TRIP_MS + 300);
    age = later;
    const next = refetched();
    await page.clock.fastForward(60_000);
    await next;
    await page.waitForTimeout(600);
    const opacity = await dot.evaluate((g) => getComputedStyle(g).opacity);
    expect(opacity).toBe(moving ? "1" : "0");
  });

const TRIP_MS = 2400;

// Where the levels side by side would be wider than the page, the tree
// stacks rather than scrolling sideways; where there is room, it draws its
// lines, and on a wide screen the cards take the room, not the lines.
test("the tree never scrolls sideways, and its lines stay short", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/topology");
  const tree = page.getByRole("list", { name: /federation/i });
  await expect(tree).toContainText("edge");
  await expect(tree).toHaveAttribute("data-stacked", "");
  const overflow = await tree.evaluate((t) => t.scrollWidth - t.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1920, height: 900 });
  await expect(tree).not.toHaveAttribute("data-stacked", "");
  await expect
    .poll(
      async () =>
        (await tree.locator("svg line").first().boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(0);
  const line = await tree.locator("svg line").first().boundingBox();
  // The usual gap plus a little (and the line's round ends): the cards
  // grew instead.
  expect(line!.width).toBeLessThanOrEqual(96 + 64 + 6);
});

// A card's sources are one line: as many chips as fit, then +N more on
// that line, never a second row.
test("a card's sources fit on one line", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/topology");
  const chips = page
    .getByRole("list", { name: /federation/i })
    .locator("dl > div", { has: page.locator("dt", { hasText: "Sources" }) })
    .first()
    .locator("[data-line]");
  await expect(chips).toBeVisible();
  const tops = await chips.evaluate((row) =>
    Array.from(row.children)
      .filter((c) => getComputedStyle(c).visibility !== "hidden")
      .map((c) => Math.round(c.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);
});

// Chips that grow after the first count (a font arriving late) are counted
// again: fewer of them, and "+N more" whole, never clipped at the edge.
test("chips that grow after drawing still leave +N more whole", async ({
  page,
}) => {
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  const peer = topology.peers![0];
  const sources = Array.from({ length: 10 }, (_, i) => ({
    ...peer.sources[0],
    remote_source: `src-edge-dc${i}-fleet`,
  }));
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { ...topology, peers: [{ ...peer, sources }] } }),
  );
  // Wide enough that the line starts with several chips to drop.
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/topology");
  const row = page.locator("[data-line]", { has: page.getByRole("button") });
  await expect(row).toHaveCount(1);
  const before = await row.locator("a, code:not([aria-hidden] *)").count();
  // Every chip a good deal wider, the line's width unchanged.
  await page.addStyleTag({ content: "code, a { letter-spacing: 8px; }" });
  await expect
    .poll(() => row.locator("a, code:not([aria-hidden] *)").count())
    .toBeLessThan(before);
  const fits = await row.evaluate((line) => {
    const button = line.querySelector("button")!;
    return (
      button.getBoundingClientRect().right <=
        line.getBoundingClientRect().right + 0.5 &&
      button.scrollWidth <= button.clientWidth
    );
  });
  expect(fits).toBe(true);
});

// The chips on the line wider than the copies the count measures (what a
// browser's own font or link style can do): the line still ends on whole
// chips and a whole "+N more", never a name cut short with "…".
test("the line keeps whole chips when they come out wider than measured", async ({
  page,
}) => {
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  const peer = topology.peers![0];
  const sources = Array.from({ length: 10 }, (_, i) => ({
    ...peer.sources[0],
    remote_source: `src-edge-dc${i}-fleet`,
  }));
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { ...topology, peers: [{ ...peer, sources }] } }),
  );
  // Only the chips on the line, not the measured copies.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        "[data-line] > a, [data-line] > code { letter-spacing: 3px; }";
      document.head.append(style);
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/topology");
  const row = page.locator("[data-line]", { has: page.getByRole("button") });
  await expect(row).toHaveCount(1);
  const whole = await row.evaluate((line) => {
    const edge = line.getBoundingClientRect().right;
    const shown = Array.from(line.children).filter(
      (el) => !el.hasAttribute("aria-hidden"),
    );
    return shown.every(
      (el) =>
        el.scrollWidth <= el.clientWidth &&
        el.getBoundingClientRect().right <= edge + 0.5,
    );
  });
  expect(whole).toBe(true);
});

// Topology opens like every section: one card counting its instances, this
// one included, as plain counts (the tree has nothing to filter).
test("topology opens with one summary of its instances", async ({ page }) => {
  await mockApi(page);
  await page.goto("/topology");
  const summary = page.getByRole("region", { name: /instances health/i });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(/instances? (is|are) connected|need/);
  await expect(summary.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Federated host entries")).toHaveCount(0);
});

// A peer with a long list of sources: one count, a step down at most, and
// never React's update limit (one render per chip used to reach it past 50).
test("a peer with 150 sources renders one line of them", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  const peer = topology.peers![0];
  const sources = Array.from({ length: 150 }, (_, i) => ({
    ...peer.sources[0],
    remote_source: `src-edge-dc${i}-fleet`,
  }));
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { ...topology, peers: [{ ...peer, sources }] } }),
  );
  await page.goto("/topology");
  const row = page.locator("[data-line]", { has: page.getByRole("button") });
  await expect(row.getByRole("button")).toHaveText(/^\+\d+ more$/);
  expect(errors.filter((e) => /Maximum update depth/.test(e))).toEqual([]);
});

// This instance is the one answering: never counted unreachable, and with
// no peers there is nothing to sum up ("No peers" says it).
test("the summary never counts this instance as unreachable", async ({
  page,
}) => {
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({ json: { ...topology, peers: [] } }),
  );
  await page.goto("/topology");
  await expect(page.getByText("No peers")).toBeVisible();
  await expect(
    page.getByRole("region", { name: /instances health/i }),
  ).toHaveCount(0);

  const peer = topology.peers![0];
  await page.route(/\/api\/v1\/topology(\?.*)?$/, (route) =>
    route.fulfill({
      json: { ...topology, peers: [{ ...peer, error: "connection refused" }] },
    }),
  );
  await page.reload();
  const summary = page.getByRole("region", { name: /instances health/i });
  await expect(summary).toContainText("1 of 2 instances");
  await expect(summary).toContainText(/1\s*Unreachable/);
  await expect(summary).toContainText(/1\s*Connected/);
});

// Side by side is checked at the cards' own widths: matching them to the
// widest first stacked trees that fit (a 1280px laptop did).
test("a tree that fits at its cards' own widths stays side by side", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/topology");
  const tree = page.getByRole("list", { name: /federation/i });
  await expect(tree).toContainText("edge");
  await expect(tree).not.toHaveAttribute("data-stacked", "");
  const overflow = await tree.evaluate((t) => t.scrollWidth - t.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

// On a map pushed from above, the root is that instance: counted as its own
// card judges it, unreachable once its pushes stop.
test("a stale pushed map counts its root as unreachable", async ({ page }) => {
  await mockApi(page);
  const { topology } = await import("./fixtures/api");
  await page.route(/\/api\/v1\/topology\/federation$/, (route) =>
    route.fulfill({
      json: [
        {
          age_seconds: 900,
          pushed_by: "key-central",
          sender: { endpoints: 0, groups: 1, hosts: 2, sources: ["src-a"] },
          sender_url: "https://central.example.com",
          topology,
          url: topology.peers![0].url,
        },
      ],
    }),
  );
  await page.goto("/topology");
  await expect(page.getByText("This map may be out of date")).toBeVisible();
  const summary = page.getByRole("region", { name: /instances health/i });
  await expect(summary).toContainText(/1\s*Unreachable/);
});

// Stacked on a phone, the root card's longest line wraps instead of
// pushing the page sideways.
test("a phone does not scroll the tree sideways", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto("/topology");
  const tree = page.getByRole("list", { name: /federation/i });
  await expect(tree).toContainText("edge");
  await expect(tree).toHaveAttribute("data-stacked", "");
  const overflow = await tree.evaluate((t) => t.scrollWidth - t.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
