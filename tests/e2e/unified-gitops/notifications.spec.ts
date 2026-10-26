import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the list shows each notification, what it sends and how its last send went", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/notifications");
  const drift = page.locator("article", { hasText: "ntf-ascender-drift" });
  await expect(drift.getByText("Sent", { exact: true })).toBeVisible();
  await expect(drift.getByText("Ascender job template")).toBeVisible();
  await expect(
    drift.getByText("Job template 12", { exact: true }),
  ).toBeVisible();
  await expect(drift.getByText("Sends to")).toHaveCount(0);

  const failures = page.locator("article", { hasText: "ntf-failures" });
  await expect(failures.getByText("Last send failed")).toBeVisible();
  await expect(
    failures.getByText("HTTP 503: Service Unavailable"),
  ).toBeVisible();
  await expect(failures.getByText("Every application")).toBeVisible();
  await expect(failures.getByText("Events")).toHaveCount(0);
});

test("a notification's page shows its overview, last send and applications", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/notifications");
  await page
    .getByRole("link", { name: "ntf-ascender-drift", exact: true })
    .click();
  await expect(page).toHaveURL("/notifications/ntf-ascender-drift");
  await expect(
    page.locator("header").getByText("Drift report in Ascender"),
  ).toBeVisible();

  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("Ascender job template")).toBeVisible();
  await expect(
    overview.getByText("https://ascender.example.com"),
  ).toBeVisible();
  // The events are on the notification's page, not on its card.
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

test("send test posts once and adds it to the history", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/notifications/ntf-failures");
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
    "/api/v1/notifications/ntf-failures/test",
  ]);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Test");
  await expect(rows.nth(0)).toContainText("None (a test)");
  await expect(rows.nth(0)).toContainText("Sent");
});

test("an unknown notification says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/notifications/nope");
  await expect(page.getByText("No such notification")).toBeVisible();
});

test("the overview names a notification that could not send", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByText(
      "Notification ntf-failures could not send: HTTP 503: Service Unavailable",
    ),
  ).toBeVisible();
});

test("a restricted key has no notifications section", async ({ page }) => {
  await mockApi(page, "restricted");
  await page.goto("/applications");
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Notifications" })).toHaveCount(
    0,
  );
});
