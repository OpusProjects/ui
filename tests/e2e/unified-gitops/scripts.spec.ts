import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("the list shows what each script runs and how its last run went", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/scripts");
  const dns = page.locator("article", { hasText: "reload-dns" });
  await expect(dns.getByText("Working", { exact: true })).toBeVisible();
  // Its file is in another project than the one it watches.
  await expect(dns.getByText("prj-scripts: dns/reload.sh")).toBeVisible();
  await expect(
    dns.getByText("bash dns/reload.sh --zone example.com $file.name"),
  ).toBeVisible();
  await expect(dns.getByText("DNS_SERVER, DNS_VIEW")).toBeVisible();
  await expect(dns.getByText(/once per changed file/)).toBeVisible();

  const cleanup = page.locator("article", { hasText: "cleanup" });
  await expect(cleanup.getByText("Failing", { exact: true })).toBeVisible();
  await expect(cleanup.getByText("exited with 2")).toBeVisible();
  await expect(cleanup.getByText("cleanup.py", { exact: true })).toBeVisible();
});

test("a script's page shows its settings, and its runs' exit codes and output", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/scripts/reload-dns");
  const overview = page.locator("section", { hasText: "Overview" }).first();
  await expect(
    overview.getByRole("link", { name: "prj-scripts" }),
  ).toHaveAttribute("href", "/projects/prj-scripts");
  await expect(overview.getByText("dns/reload.sh")).toBeVisible();
  await expect(overview.getByText("bash", { exact: true })).toBeVisible();
  await expect(overview.getByText("--zone")).toBeVisible();
  await expect(overview.getByText("DNS_SERVER")).toBeVisible();
  await expect(
    overview.getByRole("link", { name: "cred-store" }),
  ).toHaveAttribute("href", "/credentials/cred-store");

  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  await history.getByRole("button", { name: "View steps" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("9c1e2f0")).toBeVisible();
  const step = dialog.locator("tbody tr");
  await expect(step).toContainText("run");
  await expect(
    step.getByRole("cell", { name: "0", exact: true }).first(),
  ).toBeVisible();
  // The output in a monospace block of its own.
  const output = dialog.getByLabel("Output");
  await expect(output).toContainText("zone example.com reloaded");
  await expect(output).toContainText("serial 2026103001");
  expect(
    await output.evaluate((el) => getComputedStyle(el).fontFamily),
  ).toMatch(/mono/i);
});

test("a failed script shows its exit code and why", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scripts/cleanup");
  // It runs on a schedule only: never by hand.
  await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
  await page.getByRole("button", { name: "View steps" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("tbody tr")).toContainText("2");
  await expect(dialog.locator("tbody tr")).toContainText("exited with 2");
  await expect(dialog.getByLabel("Output")).toContainText("Permission denied");
});

test("Dry run shows the command it would run, Run now runs it", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/scripts/reload-dns");
  await page.getByRole("button", { name: "Dry run" }).click();
  const dry = page.locator("section", {
    has: page.getByRole("heading", { name: /^Dry run/ }),
  });
  await expect(dry.getByLabel("Output")).toContainText(
    "would run: bash dns/reload.sh",
  );
  await page.getByRole("button", { name: "Run now" }).click();
  await page
    .getByRole("dialog", { name: "Run reload-dns now?" })
    .getByRole("button", { name: "Run now" })
    .click();
  await expect(page.getByText("Ran: 1 step")).toBeVisible();
  expect(calls.writes.map((w) => w.path)).toEqual([
    "/api/v1/scripts/reload-dns/run?dry_run=true",
    "/api/v1/scripts/reload-dns/run?dry_run=false",
  ]);
  const result = page.locator("section", {
    has: page.getByRole("heading", { name: /^Run\b/ }),
  });
  await expect(result.getByLabel("Output")).toContainText(
    "zone example.com reloaded",
  );
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History/ }),
  });
  await expect(history.locator("tbody tr")).toHaveCount(3);
});

test("an unknown script says so", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scripts/nope");
  await expect(page.getByText("No such script")).toBeVisible();
});
