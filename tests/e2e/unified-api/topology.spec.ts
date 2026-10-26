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
  await page.setViewportSize({ width: 1100, height: 720 });
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
