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
