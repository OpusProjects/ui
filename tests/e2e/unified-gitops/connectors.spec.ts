import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("a connector card's title opens the connector's page", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors");
  const title = page.getByRole("link", { name: "kv", exact: true });
  await expect(title).toHaveAttribute("href", "/connectors/kv");
  await title.click();
  await expect(page).toHaveURL("/connectors/kv");
  await expect(page.locator("h1")).toContainText("kv");
});

test("a connector's page shows its overview and the applications using it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors/kv");
  // The header says what the connector is, in its own words.
  await expect(
    page.locator("header").getByText("Key-value store"),
  ).toBeVisible();
  const overview = page.locator("section", { hasText: "Overview" });
  await expect(overview.getByText("connectors/kv.py")).toBeVisible();
  await expect(
    overview.getByText(/^(Idle|Working|Requests failing)$/),
  ).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "prj-state" }),
  ).toHaveAttribute("href", "/projects/prj-state");
  await expect(overview.getByText("1m", { exact: true })).toBeVisible();
  // Kinds in apply order, each with its key and what it waits for.
  // What a connector manages is the script's to describe, not shown here.
  await expect(page.getByRole("heading", { name: "Object types" })).toHaveCount(
    0,
  );

  const usedBy = page.locator("section", {
    has: page.getByRole("heading", { name: /^Applications / }),
  });
  const rows = usedBy.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(
    usedBy.getByRole("link", { name: "drifted", exact: true }),
  ).toHaveAttribute("href", "/applications/drifted");
  const drifted = rows.filter({ hasText: "drifted" });
  await expect(drifted).toContainText("Drifted settings");
  await expect(drifted).toContainText("Out of sync");
  // The same columns as every table of applications.
  await expect(
    usedBy.getByRole("columnheader", { name: "To apply" }),
  ).toHaveCount(1);
  // The name is the link; the description sits under it.
  await expect(drifted.getByText("drifted", { exact: true })).toBeVisible();
  await usedBy.getByRole("link", { name: "synced", exact: true }).click();
  await expect(page).toHaveURL("/applications/synced");
});

test("a connector from this instance's disk, used by nothing", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/connectors/powerscale");
  await expect(
    page.getByText("None (local file)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No application uses this connector"),
  ).toBeVisible();
});

test("an unknown connector says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/connectors/nope");
  await expect(page.getByText("No such connector")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See every connector" }),
  ).toHaveAttribute("href", "/connectors");
});

test("a restricted key is refused the connector page, with the reason", async ({
  page,
}) => {
  await mockApi(page, "restricted");
  await page.goto("/connectors/kv");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load this connector",
  );
  await expect(page.getByRole("alert")).toContainText("admin");
});
