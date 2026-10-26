import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the list shows each webhook, what it sends and how its last send went", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks");
  const drift = page.locator("article", { hasText: "wh-ascender-drift" });
  await expect(drift.getByText("Sent", { exact: true })).toBeVisible();
  await expect(drift.getByText("Ascender job template")).toBeVisible();
  await expect(
    drift.getByText("Job template 12", { exact: true }),
  ).toBeVisible();
  await expect(drift.getByText("Sends to")).toHaveCount(0);

  const failures = page.locator("article", { hasText: "wh-failures" });
  await expect(failures.getByText("Last send failed")).toBeVisible();
  await expect(
    failures.getByText("HTTP 503: Service Unavailable"),
  ).toBeVisible();
  await expect(failures.getByText("Every application")).toBeVisible();
  // A webhook sends; it starts nothing: its host where a job template's
  // card says what it starts.
  await expect(failures.getByText("alerts.example.com")).toBeVisible();
  await expect(failures.getByText("Starts")).toHaveCount(0);

  // applications left out or []: none, and so never sent.
  const paused = page.locator("article", { hasText: "wh-paused" });
  await expect(paused.getByText("None", { exact: true })).toBeVisible();
  await expect(paused.getByText("Not sent yet")).toBeVisible();
  await expect(failures.getByText("Events")).toHaveCount(0);
});

test("a webhook's page shows its overview, last send and applications", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks");
  await page
    .getByRole("link", { name: "wh-ascender-drift", exact: true })
    .click();
  await expect(page).toHaveURL("/webhooks/wh-ascender-drift");
  await expect(
    page.locator("header").getByText("Drift report in Ascender"),
  ).toBeVisible();

  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("Ascender job template")).toBeVisible();
  await expect(
    overview.getByText("Job template 12", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("ascender_webhook_payload", { exact: true }),
  ).toBeVisible();
  const page_ = overview.getByRole("link", { name: "Open the template" });
  await expect(page_).toHaveAttribute(
    "href",
    "https://ascender.example.com/#/templates/job_template/12/details",
  );
  await expect(page_).toHaveAttribute("target", "_blank");
  await expect(
    overview.getByText("https://ascender.example.com"),
  ).toBeVisible();
  // The events are on the webhook's page, not on its card.
  await expect(
    overview.getByText("Drift detected", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");

  // Its sends, newest first: the last one went through, an older one failed.
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  const rows = history.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Drift detected");
  await expect(rows.nth(0)).toContainText("HTTP 202");
  await expect(
    rows.nth(0).getByRole("cell", { name: "OK", exact: true }),
  ).toBeVisible();
  await expect(rows.nth(0)).toContainText("Sent");
  await expect(
    rows.nth(0).getByRole("link", { name: "drifted" }),
  ).toHaveAttribute("href", "/applications/drifted");
  await expect(rows.nth(1)).toContainText("No answer, 4 attempts");
  await expect(rows.nth(1)).toContainText("could not connect");
  await expect(rows.nth(1)).toContainText("Failed");

  // Only the applications it listens to.
  const apps = page.locator("section", {
    has: page.getByRole("heading", { name: /^Applications/ }),
  });
  await expect(apps.locator("tbody tr")).toHaveCount(1);
  await expect(
    apps.getByRole("link", { name: "drifted", exact: true }),
  ).toBeVisible();
});

test("a webhook's page says how it sends, never with a value", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks/wh-failures");
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("Header X-Alerts-Token")).toBeVisible();
  await expect(overview.getByText("X-Hub-Signature-256")).toBeVisible();
  await expect(overview.getByText("X-Source")).toBeVisible();
  await expect(overview.getByText("10s per attempt")).toBeVisible();
  // A web address is a link out, opened in a new tab.
  const sendsTo = overview.getByRole("link", {
    name: "https://alerts.example.com",
  });
  await expect(sendsTo).toHaveAttribute("href", "https://alerts.example.com");
  await expect(sendsTo).toHaveAttribute("target", "_blank");
  // A job template has none of a webhook's lines.
  await page.goto("/webhooks/wh-ascender-drift");
  await expect(overview.getByText("Authentication")).toHaveCount(0);
  await expect(overview.getByText("30s per attempt")).toBeVisible();
});

test("events and credentials stack, the rest behind +N more", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/webhooks/wh-failures");
  const events = page
    .locator("section", { hasText: "Overview" })
    .locator("dl > div", { has: page.locator("dt", { hasText: "Events" }) });
  await expect(events.getByText("Sync failed", { exact: true })).toBeVisible();
  await expect(events.getByText("Back in sync", { exact: true })).toHaveCount(
    0,
  );
  await events.getByRole("button", { name: "+1 more" }).click();
  await expect(events.getByText("Back in sync", { exact: true })).toBeVisible();
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

test("a restricted key has no webhooks section", async ({ page }) => {
  await mockApi(page, "restricted");
  await page.goto("/applications");
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Webhooks" })).toHaveCount(0);
});
