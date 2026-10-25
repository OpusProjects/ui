import { defineConfig, devices } from "@playwright/test";

// The app against a mocked API: every /api and /metrics call is answered in
// the browser from fixtures/ (invented data), so the suite needs no
// unified-api and never touches a real inventory. Vite serves the app as in
// development; its proxy is never reached.
const PORT = 18292;

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -w unified-api-ui -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Pointed nowhere on purpose: a call the fixtures miss fails loudly
    // instead of reaching whatever API happens to run on this machine.
    env: { UNIFIED_API_URL: "http://127.0.0.1:9" },
  },
});
