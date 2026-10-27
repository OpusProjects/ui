import type { Page, Route } from "@playwright/test";
import type { components } from "../../../../apps/unified-api/src/api/schema";

type Schemas = components["schemas"];

// An invented instance: two sources (one healthy, one failing), a view, an
// endpoint over both, a connector, a project, a credential and one peer.
// Typed against the generated schema, so an API change that breaks the UI's
// assumptions breaks the typecheck here too.

const health = (failures = 0): Schemas["SyncHealthInfo"] => ({
  last_attempt_age_seconds: 30,
  last_success_age_seconds: failures ? 7200 : 30,
  last_error: failures ? "connector exited with status 1" : null,
  consecutive_failures: failures,
});

const related = (id: string) => ({
  dataset: `/api/v1/sources/${id}/dataset`,
  evict: `/api/v1/sources/${id}/cache`,
  groups: `/api/v1/sources/${id}/groups`,
  hosts: `/api/v1/sources/${id}/hosts`,
  scope: `/api/v1/sources/${id}/scope`,
  status: `/api/v1/sources/${id}/status`,
  sync: `/api/v1/sources/${id}/sync`,
});

export const sources: Schemas["CachedSourceInfo"][] = [
  {
    source_id: "src-alpha",
    url: "/api/v1/sources/src-alpha",
    kind: "source",
    cached: true,
    federated: false,
    is_fresh: true,
    age_seconds: 30,
    total_hosts: 3,
    sync_health: health(),
    related: related("src-alpha"),
  },
  {
    source_id: "src-beta",
    url: "/api/v1/sources/src-beta",
    kind: "source",
    cached: true,
    federated: false,
    is_fresh: false,
    age_seconds: 7200,
    total_hosts: 2,
    sync_health: health(2),
    related: related("src-beta"),
  },
];

const HOSTS: Record<string, string[]> = {
  "src-alpha": [
    "web-01.example.net",
    "web-02.example.net",
    "db-01.example.net",
  ],
  "src-beta": ["db-01.example.net", "cache-01.example.net"],
};

export const detail = (
  s: Schemas["CachedSourceInfo"],
): Schemas["SourceDetail"] => ({
  ...s,
  name: s.source_id.replace("src-", "").toUpperCase(),
  ttl_seconds: 3600,
  total_groups: 2,
  dataset_bytes: 2048,
  // A manual sync that worked, and a scheduled one before it that failed.
  history: [
    {
      started_at: Math.floor(Date.now() / 1000) - 120,
      duration_ms: 4210,
      trigger: "manual",
      by: "key-ops",
      scope: "full",
      hosts: 1234,
      groups: 12,
    },
    {
      started_at: Math.floor(Date.now() / 1000) - 3600,
      duration_ms: 300000,
      trigger: "scheduled",
      scope: "full",
      error: "sync timed out after 300s",
    },
  ],
  gathering: {
    connector: "inventory",
    connector_type: "script",
    project_id: "prj-inventory",
    script_path: "connectors/inventory.py",
    sync_mode: "replace",
    timeout_seconds: 300,
    sync_interval_seconds: 600,
    schedule: null,
    credential_ids: ["cred-d42", "cred-inventory"],
    allow_on_demand_refresh: true,
    remote_url: null,
    config_keys: [],
    location: null,
    inline_script: false,
  },
});

export const endpoints: Schemas["EndpointInfo"][] = [
  {
    endpoint_id: "ep-all",
    name: "Everything",
    source_ids: ["src-alpha", "src-beta"],
    sources_ready: 2,
    sources_missing: [],
    transform: {
      output: "builtin:ansible",
      script_path: null,
      script_args: [],
      project_id: null,
      timeout_seconds: null,
      limit_hosts_from: "union",
      config_keys: [],
    },
  },
];

export const projects: Schemas["ProjectInfo"][] = [
  {
    project_id: "prj-inventory",
    name: "Inventory scripts",
    // A token in the remote, as a clone URL may carry: the UI must never show it.
    git_url: "https://deploy:SECRET-TOKEN@git.example.com/ops/inventory.git",
    branch: "main",
    checkout_present: true,
    sync_interval_seconds: 3600,
    sync_on_boot: true,
    schedule: null,
    timeout_seconds: 120,
    used_by: {
      sources: ["src-alpha", "src-beta"],
      connectors: ["inventory"],
      endpoints: [],
      enrichers: [],
    },
    sync_health: health(),
    // A pull that moved the checkout, and one that found nothing new.
    history: [
      {
        started_at: Math.floor(Date.now() / 1000) - 60,
        duration_ms: 820,
        trigger: "manual",
        by: "key-ops",
        revision_before: "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        revision: "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        started_at: Math.floor(Date.now() / 1000) - 1800,
        duration_ms: 310,
        trigger: "scheduled",
        revision_before: "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        revision: "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    ],
  },
];

// One configured connector used by both sources (one of them failing),
// and the two built-ins every instance has, unused here.
const builtIn = (
  connector_id: string,
  name: string,
): Schemas["ConnectorInfo"] => ({
  connector_id,
  name,
  connector_type: connector_id,
  built_in: true,
  project_id: null,
  path: null,
  script_args: [],
  host_args: [],
  timeout_seconds: null,
  used_by: [],
  health: { sources: 0, healthy: 0, failing: 0, never_synced: 0 },
});

export const connectors: Schemas["ConnectorInfo"][] = [
  {
    connector_id: "inventory",
    name: "Inventory database",
    connector_type: "script",
    built_in: false,
    project_id: "prj-inventory",
    path: "connectors/inventory.py",
    script_args: ["--format", "json"],
    host_args: ["--host"],
    timeout_seconds: 300,
    used_by: [
      {
        source_id: "src-alpha",
        name: "ALPHA",
        timeout_seconds: 300,
        failing: false,
        synced: true,
      },
      {
        source_id: "src-beta",
        name: "BETA",
        timeout_seconds: 90,
        failing: true,
        synced: true,
      },
    ],
    health: { sources: 2, healthy: 1, failing: 1, never_synced: 0 },
  },
  builtIn("remote", "Another unified-api instance"),
  builtIn("static_inventory", "Ansible YAML inventory in a project checkout"),
];

export const credentials: Schemas["CredentialInfo"][] = [
  {
    credential_id: "cred-inventory",
    name: "Inventory reader",
    type: "username_password",
    backend: "env",
    vault_path: null,
    env_vars: ["INVENTORY_USERNAME", "INVENTORY_PASSWORD"],
    secret_file: null,
    secret_keys: ["username", "password"],
    file_keys: [],
    resolves: true,
    error: null,
    used_by: {
      credentials: [],
      sources: ["src-alpha", "src-beta"],
      projects: [],
      ldap: false,
    },
  },
];

export const topology: Schemas["Topology"] = {
  version: "9.9.9",
  sources: 2,
  peers: [
    {
      url: "https://unified-api-edge.example.net",
      sources: [
        {
          source_id: "src-alpha",
          remote_source: "src-local",
          cached: true,
          hosts: 3,
          groups: 2,
          age_seconds: 30,
          consecutive_failures: 0,
        },
      ],
      instance: { version: "9.9.9", sources: 1, peers: [] },
    },
  ],
};

const settings: Schemas["Settings"] = {
  version: "9.9.9",
  uptime_seconds: 5400,
  server: {
    host: "0.0.0.0",
    port: 8182,
    cors_allowed_origins: [],
    readyz_require_all_sources: false,
    metrics_require_auth: false,
    refresh_timeout_seconds: 60,
    refresh_max_concurrent: 4,
    shutdown_grace_seconds: 20,
    max_body_bytes: 1048576,
    ui: { enabled: true, session_ttl_seconds: 3600, ldap: false },
  },
  cache: {
    persistence_path: null,
    persistence_interval_seconds: null,
    last_saved_age_seconds: null,
    consecutive_failures: 0,
  },
  projects: { dir: "/var/lib/unified-api/projects" },
  secrets: { cache_ttl_seconds: 60, vault: null },
  config_api: { enabled: false },
  restart_pending: [],
};

const auth: Schemas["AuthInfo"] = {
  me: {
    name: "e2e",
    method: "api_key",
    role: "admin",
    sources: [],
    endpoints: [],
    csrf_token: "e2e-csrf",
  },
  methods: { api_key: true, ldap: false },
  ldap: null,
  api_keys: [{ name: "e2e", role: "admin", sources: [], endpoints: [] }],
};

const METRICS = `# TYPE unified_api_http_requests_total counter
unified_api_http_requests_total{method="GET",path="/api/v1/sources",status="200"} 10
# TYPE unified_api_hosts_unique gauge
unified_api_hosts_unique 4
# TYPE unified_api_source_requests_total counter
unified_api_source_requests_total{source="src-a",operation="full",outcome="success"} 6
`;

// What each call that left the page asked for, so a test can check a write
// was made (and with what).
export interface Calls {
  writes: {
    method: string;
    path: string;
    // The query string, "" when there is none.
    query: string;
    headers: Record<string, string>;
  }[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

// Answers every API call the app makes. Anything not listed is a 404 with
// the API's own error shape, so a missing fixture shows up as an error on
// the page rather than a hang.
export async function mockApi(page: Page): Promise<Calls> {
  const calls: Calls = { writes: [] };
  // /metrics is also the Metrics page: a navigation there loads the app
  // (Vite serves it to a browser asking for HTML); only the page's own
  // scrape is answered here.
  await page.route(/\/metrics$/, (route) =>
    route.request().resourceType() === "document"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: METRICS,
        }),
  );
  await page.route(/\/api\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") {
      calls.writes.push({
        method: request.method(),
        path,
        query: url.search,
        headers: request.headers(),
      });
      return json(route, { status: "accepted" }, 202);
    }
    const source = /^\/api\/v1\/sources\/([^/]+)(\/.*)?$/.exec(path);
    if (source) {
      const summary = sources.find((s) => s.source_id === source[1]);
      if (!summary)
        return json(
          route,
          { error: `source '${source[1]}' is not configured` },
          404,
        );
      const hosts = HOSTS[summary.source_id];
      switch (source[2] ?? "") {
        case "":
          return json(route, detail(summary));
        case "/groups":
          return json(route, [
            {
              name: "web",
              host_count: hosts.length - 1,
              children: [],
              has_vars: false,
            },
            {
              name: "all",
              host_count: hosts.length,
              children: ["web"],
              has_vars: true,
            },
          ]);
        case "/groups/all":
          return json(route, {
            name: "all",
            host_count: hosts.length,
            children: ["web"],
            vars: { ntp_server: "ntp.example.net", env: "prod" },
          });
        case "/groups/web":
          return json(route, {
            name: "web",
            host_count: hosts.length - 1,
            children: [],
            vars: {},
          });
        case "/hosts":
          return json(route, {
            source_id: summary.source_id,
            total_hosts: hosts.length,
            hosts,
          });
        case "/dataset": {
          const host = url.searchParams.get("host") ?? "";
          return json(route, {
            hostvars: { [host]: { ansible_host: "192.0.2.10", role: "web" } },
          });
        }
      }
    }
    if (path === "/api/v1/hosts/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const found = [...new Set(Object.values(HOSTS).flat())]
        .filter((h) => h.includes(q))
        .map((host) => ({
          host,
          sources: Object.entries(HOSTS)
            .filter(([, list]) => list.includes(host))
            .map(([source_id]) => ({ source_id, age_seconds: 30 })),
          endpoints: ["ep-all"],
        }));
      return json(route, { hosts: found, total: found.length });
    }
    const connector = /^\/api\/v1\/connectors\/([^/]+)$/.exec(path);
    if (connector) {
      const found = connectors.find(
        (c) => c.connector_id === decodeURIComponent(connector[1]),
      );
      return found
        ? json(route, found)
        : json(
            route,
            { error: `connector '${connector[1]}' is not configured` },
            404,
          );
    }
    const counts = /^\/api\/v1\/endpoints\/([^/]+)\/counts$/.exec(path);
    if (counts)
      return json(route, { hosts: 4, groups: 2, missing_sources: [] });
    const fixed: Record<string, unknown> = {
      "/api/v1/": { version: "9.9.9" },
      "/api/v1/auth": auth,
      "/api/v1/sources": sources,
      "/api/v1/endpoints": endpoints,
      "/api/v1/projects": projects,
      "/api/v1/connectors": connectors,
      "/api/v1/credentials": credentials,
      "/api/v1/settings": settings,
      "/api/v1/topology": topology,
      "/api/v1/topology/federation": [],
    };
    if (path in fixed) return json(route, fixed[path]);
    return json(route, { error: `no fixture for ${path}` }, 404);
  });
  return calls;
}
