import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = process.env.UNIFIED_GITOPS_URL ?? "http://127.0.0.1:8183";
const apiKey = process.env.UNIFIED_GITOPS_KEY;

// A request another website made the browser send: the browser says so in
// Sec-Fetch-Site (and in Origin). The key below must not be lent to it, or
// any page could sync or reload through this dev server as admin: such a
// request goes on without the key, and a write is refused outright. Tools
// like curl send neither header and are treated as this page.
function crossSite(req: import("node:http").IncomingMessage) {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

// Routes the page calls that belong to unified-gitops rather than to the UI.
const proxied = [
  "/api/",
  "/swagger-ui",
  "/api-docs",
  "/metrics",
  "/healthz",
  "/readyz",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Build against the packages' source, so a change there shows up here
    // without publishing or rebuilding the package.
    alias: [
      {
        find: "@opusprojects/unified-ui/style.css",
        replacement: fileURLToPath(
          new URL("./src/no-style.css", import.meta.url),
        ),
      },
      {
        find: "@opusprojects/unified-ui",
        replacement: fileURLToPath(
          new URL("../../packages/ui/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@opusprojects/unified-client",
        replacement: fileURLToPath(
          new URL("../../packages/client/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  server: {
    // The key is added here, server side, so it never reaches the browser.
    proxy: Object.fromEntries(
      proxied.map((path) => [
        path,
        {
          target,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              if (apiKey && !crossSite(req))
                proxyReq.setHeader("X-API-Key", apiKey);
            });
          },
          bypass: (req, res) => {
            const write = req.method !== "GET" && req.method !== "HEAD";
            if (write && crossSite(req) && res) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end('{"error":"Refused: a write from another site"}');
              return false;
            }
            // /metrics is both the UI's Metrics page and Prometheus's endpoint.
            // A browser navigating there asks for HTML and gets the app; a
            // scraper, or the page's own fetch, asks for text and gets the API.
            return path === "/metrics" &&
              req.headers.accept?.includes("text/html")
              ? "/index.html"
              : undefined;
          },
        },
      ]),
    ),
  },
});
