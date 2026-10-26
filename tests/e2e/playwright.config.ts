import { defineConfig, devices } from "@playwright/test";

// Each app against a mocked API: every /api and /metrics call is answered in
// the browser from that app's fixtures/ (invented data), so the suite needs
// no backend and never touches a real system. Vite serves each app as in
// development; its proxy is never reached.
const API_PORT = 18292;
const GITOPS_PORT = 18293;

// Pointed nowhere on purpose: a call the fixtures miss fails loudly instead
// of reaching whatever service happens to run on this machine.
const NOWHERE = "http://127.0.0.1:9";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "unified-api",
      testDir: "./unified-api",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${API_PORT}`,
      },
    },
    {
      name: "unified-gitops",
      testDir: "./unified-gitops",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${GITOPS_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npx -w unified-api-ui vite --host 127.0.0.1 --port ${API_PORT} --strictPort`,
      cwd: "../..",
      url: `http://127.0.0.1:${API_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { UNIFIED_API_URL: NOWHERE },
    },
    {
      command: `npx -w unified-gitops-ui vite --host 127.0.0.1 --port ${GITOPS_PORT} --strictPort`,
      cwd: "../..",
      url: `http://127.0.0.1:${GITOPS_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { UNIFIED_GITOPS_URL: NOWHERE },
    },
  ],
});
