import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the list shows each webhook, where it sends and how its last send went", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks");
  const commits = page.locator("article", { hasText: "wh-commits" });
  await expect(commits.getByText("Working", { exact: true })).toBeVisible();
  await expect(commits.getByText("prj-infra", { exact: true })).toBeVisible();
  await expect(commits.getByText("POST hooks.example.com")).toBeVisible();
  await expect(commits.getByText(/^Commit pulled, /)).toBeVisible();

  const failures = page.locator("article", { hasText: "wh-failures" });
  await expect(failures.getByText("Failing", { exact: true })).toBeVisible();
  await expect(
    failures.getByText("HTTP 503: Service Unavailable"),
  ).toBeVisible();
  await expect(failures.getByText("PUT alerts.example.com")).toBeVisible();
  // Send test is on a webhook's own page, not on its card.
  await expect(failures.getByRole("button", { name: "Send test" })).toHaveCount(
    0,
  );
  // The events are on the webhook's page, not on its card.
  await expect(failures.getByText("Events")).toHaveCount(0);

  const paused = page.locator("article", { hasText: "wh-paused" });
  await expect(paused.getByText("Disabled").first()).toBeVisible();
  await expect(paused.getByText("Never", { exact: true })).toBeVisible();
  // Nothing about the old kinds of webhook.
  expect(await page.locator("main").innerText()).not.toMatch(
    /Ascender|AWX|application/i,
  );
});

test("a webhook's page shows its project, events and how it sends, never a value", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks");
  await page.getByRole("link", { name: "wh-failures", exact: true }).click();
  await expect(page).toHaveURL("/webhooks/wh-failures");
  await expect(
    page.locator("header").getByText("Every failure, to the alerts receiver"),
  ).toBeVisible();

  const overview = page.locator("section", { hasText: "Overview" }).first();
  await expect(
    overview.getByRole("link", { name: "prj-infra" }),
  ).toHaveAttribute("href", "/projects/prj-infra");
  await expect(
    overview.getByText("API run failed", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Every commit", { exact: true }),
  ).toBeVisible();
  // A web address is a link out, opened in a new tab.
  const sendsTo = overview.getByRole("link", {
    name: "https://alerts.example.com",
  });
  await expect(sendsTo).toHaveAttribute("href", "https://alerts.example.com");
  await expect(sendsTo).toHaveAttribute("target", "_blank");
  await expect(overview.getByText("PUT", { exact: true })).toBeVisible();
  await expect(
    overview.getByText("Form (URL-encoded), from a template", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("A header of its own", { exact: true }),
  ).toBeVisible();
  await expect(overview.getByText("X-Source")).toBeVisible();
  await expect(overview.getByText("channel", { exact: true })).toBeVisible();
  await expect(overview.getByText("X-Hub-Signature-256")).toBeVisible();
  await expect(
    overview.getByText("Until its condition holds", { exact: true }),
  ).toBeVisible();
  await expect(overview.getByText("10 per 60s", { exact: true })).toBeVisible();
  await expect(
    overview.getByText("10s per attempt", { exact: true }),
  ).toBeVisible();
  await expect(overview.getByText("team=platform")).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");

  // A plain one: no query, no rate limit, the event as it is.
  await page.goto("/webhooks/wh-commits");
  await expect(overview.getByText("dns/**")).toBeVisible();
  await expect(
    overview.getByText("JSON, the event as it is", { exact: true }),
  ).toBeVisible();
  await expect(overview.getByText("Rate limit")).toHaveCount(0);
  await expect(overview.locator("dt", { hasText: /^Query/ })).toHaveCount(0);
});

test("a webhook's sends, newest first, name their project", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks/wh-commits");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Commit pulled");
  await expect(rows.nth(0)).toContainText("HTTP 200");
  await expect(
    rows.nth(0).getByRole("cell", { name: "OK", exact: true }),
  ).toBeVisible();
  await expect(rows.nth(0)).toContainText("Sent");
  await expect(
    rows.nth(0).getByRole("link", { name: "prj-infra" }),
  ).toHaveAttribute("href", "/projects/prj-infra");
  await expect(rows.nth(1)).toContainText("Pull failed");
  await expect(rows.nth(1)).toContainText("No answer, 4 attempts");
  await expect(rows.nth(1)).toContainText("could not connect");
  await expect(rows.nth(1)).toContainText("Failed");
});

test("events stack, the rest behind +N more", async ({ page }) => {
  await mockApi(page);
  await page.goto("/webhooks/wh-failures");
  const events = page
    .locator("section", { hasText: "Overview" })
    .locator("dl > div", { has: page.locator("dt", { hasText: "Events" }) });
  await expect(
    events.getByText("API run failed", { exact: true }),
  ).toBeVisible();
  await expect(
    events.getByText("Script run failed", { exact: true }),
  ).toHaveCount(0);
  await events.getByRole("button", { name: "+2 more" }).click();
  await expect(
    events.getByText("Script run failed", { exact: true }),
  ).toBeVisible();
});

test("send test posts once and adds it to the history", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/webhooks/wh-failures");
  const rows = page
    .locator("section", {
      has: page.getByRole("heading", { name: /^History/ }),
    })
    .locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("HTTP 503");
  await page.getByRole("button", { name: "Send test" }).click();
  await expect(page.getByText("Test sent")).toBeVisible();
  expect(calls.writes.map((w) => w.path)).toEqual([
    "/api/v1/webhooks/wh-failures/test",
  ]);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Test");
  await expect(rows.nth(0)).toContainText("None (a test)");
  await expect(rows.nth(0)).toContainText("Sent");
});

test("an unknown webhook says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/webhooks/nope");
  await expect(page.getByText("No such webhook")).toBeVisible();
});

test("the overview names a webhook that could not send", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByText(
      "Webhook wh-failures could not send: HTTP 503: Service Unavailable",
    ),
  ).toBeVisible();
});

test("the overview shows the webhooks card even with none", async ({
  page,
}) => {
  await mockApi(page);
  await page.route("**/api/v1/webhooks", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Webhooks None", exact: true }),
  ).toBeVisible();
});

test("a restricted key has no webhooks section", async ({ page }) => {
  await mockApi(page, "restricted");
  await page.goto("/apis");
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Webhooks" })).toHaveCount(0);
});
