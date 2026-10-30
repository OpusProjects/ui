import type { Page, Route } from "@playwright/test";
import type { components } from "../../../../apps/unified-gitops/src/api/schema";

type Schemas = components["schemas"];

// An invented unified-gitops instance: two projects (one with a token in its
// remote), three API items (one working, one failing that does not run by
// hand, one disabled), two script items (one working that reads its file
// from the other project, one failing), three webhooks (working, failing,
// disabled) and a credential that does not resolve. Typed against the
// generated schema, so an API change that breaks the UI's assumptions breaks
// the typecheck here too. Stateful: a run is added to its item's history,
// a test send to its webhook's.

const now = () => Math.floor(Date.now() / 1000);

export const REVISION = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
export const SCRIPT_REVISION = "9c1e2f00aaaabbbbccccddddeeeeffff00001111";

const health = (failures = 0, error?: string): Schemas["SyncHealthInfo"] => ({
  last_attempt_age_seconds: 20,
  last_success_age_seconds: failures ? 3600 : 20,
  last_error: failures ? (error ?? "failed") : null,
  consecutive_failures: failures,
});

const step = (over: Partial<Schemas["Step"]>): Schemas["Step"] => ({
  file: null,
  action: "update",
  method: null,
  url: null,
  status: null,
  exit_code: null,
  ok: true,
  attempts: 1,
  changed_fields: [],
  error: null,
  output: null,
  body: null,
  duration_ms: 120,
  ...over,
});

const run = (over: Partial<Schemas["Run"]>): Schemas["Run"] => ({
  item: "users",
  kind: "api",
  project: "prj-infra",
  trigger: "change",
  by: null,
  revision: REVISION,
  script_revision: null,
  dry_run: false,
  started_at: now() - 60,
  duration_ms: 340,
  ok: true,
  error: null,
  steps: [],
  ...over,
});

const api = (
  name: string,
  over: Partial<Schemas["ApiSummary"]>,
): Schemas["ApiSummary"] => ({
  name,
  description: null,
  enabled: true,
  project: "prj-infra",
  labels: {},
  paths: [],
  ignore_paths: [],
  on: ["change", "manual"],
  schedule: null,
  debounce_seconds: 0,
  destination: "https://portainer.example.com",
  method: "PUT",
  auth: "bearer",
  per: "file",
  upsert: false,
  compare: false,
  deletes: false,
  on_failure: "continue",
  credentials: [],
  timeout_seconds: 30,
  attempts: 3,
  last: null,
  ...over,
});

const script = (
  name: string,
  over: Partial<Schemas["ScriptSummary"]>,
): Schemas["ScriptSummary"] => ({
  name,
  description: null,
  enabled: true,
  project: "prj-infra",
  labels: {},
  paths: [],
  ignore_paths: [],
  on: ["change", "manual"],
  schedule: null,
  debounce_seconds: 0,
  script_project: "prj-infra",
  file: "run.sh",
  args: [],
  interpreter: null,
  working_dir: null,
  env: [],
  per: "commit",
  stdin: "none",
  success_exit_codes: [0],
  on_failure: "continue",
  credential: null,
  timeout_seconds: 300,
  attempts: 1,
  last: null,
  ...over,
});

const USERS_RUN = run({
  steps: [
    step({
      file: "users/jane.json",
      action: "update",
      method: "PUT",
      url: "https://portainer.example.com/api/users/jane",
      status: 200,
      changed_fields: ["role", "team.name"],
    }),
    step({
      file: "users/joe.json",
      action: "skip",
      method: "GET",
      url: "https://portainer.example.com/api/users/joe",
      status: 200,
    }),
  ],
});

const GROUPS_RUN = run({
  item: "groups",
  started_at: now() - 120,
  ok: false,
  steps: [
    step({
      file: "groups/ops.json",
      action: "create",
      method: "POST",
      url: "https://portainer.example.com/api/groups",
      status: 503,
      ok: false,
      attempts: 3,
      error: "HTTP 503: Service Unavailable",
    }),
  ],
});

const DNS_RUN = run({
  item: "reload-dns",
  kind: "script",
  script_revision: SCRIPT_REVISION,
  steps: [
    step({
      action: "run",
      exit_code: 0,
      output: "zone example.com reloaded\nserial 2026103001\n",
    }),
  ],
});

const CLEANUP_RUN = run({
  item: "cleanup",
  kind: "script",
  project: "prj-scripts",
  trigger: "schedule",
  started_at: now() - 300,
  ok: false,
  steps: [
    step({
      action: "run",
      exit_code: 2,
      ok: false,
      error: "exited with 2",
      output: "rm: cannot remove '/srv/tmp/locked': Permission denied\n",
    }),
  ],
});

function state() {
  return {
    apis: [
      api("users", {
        description: "Portainer users",
        paths: ["users/*.json"],
        ignore_paths: ["users/README.md"],
        compare: true,
        credentials: ["cred-store"],
        labels: { team: "platform" },
        last: USERS_RUN,
      }),
      api("groups", {
        description: "Portainer groups",
        paths: ["groups/*.json"],
        on: ["change"],
        method: "POST",
        upsert: true,
        deletes: true,
        on_failure: "stop",
        last: GROUPS_RUN,
      }),
      // No description: the UI must show nothing there, never "null".
      api("audit", {
        enabled: false,
        destination: "https://audit.example.com",
        method: "POST",
        per: "commit",
        auth: "none",
        on: ["schedule"],
        schedule: "0 * * * *",
      }),
    ],
    scripts: [
      script("reload-dns", {
        description: "Reload the DNS zones",
        paths: ["dns/**"],
        script_project: "prj-scripts",
        file: "dns/reload.sh",
        args: ["--zone", "example.com", "$file.name"],
        interpreter: "bash",
        env: ["DNS_SERVER", "DNS_VIEW"],
        per: "file",
        credential: "cred-store",
        last: DNS_RUN,
      }),
      script("cleanup", {
        project: "prj-scripts",
        script_project: "prj-scripts",
        file: "cleanup.py",
        interpreter: "python3",
        on: ["schedule"],
        schedule: "0 3 * * *",
        last: CLEANUP_RUN,
      }),
    ],
    history: {
      "api/users": [USERS_RUN, run({ started_at: now() - 3600 })],
      "api/groups": [GROUPS_RUN],
      "api/audit": [],
      "script/reload-dns": [DNS_RUN],
      "script/cleanup": [CLEANUP_RUN],
    } as Record<string, Schemas["Run"][]>,
  };
}

export const projects: Schemas["ProjectInfo"][] = [
  {
    name: "prj-infra",
    description: "Infrastructure",
    credential: "cred-store",
    // A token in the remote: the UI must never show it.
    git_url: "https://deploy:SECRET-TOKEN@git.example.com/ops/infra.git",
    branch: "main",
    checkout_present: true,
    revision: REVISION,
    sync_interval_seconds: 60,
    sync_on_boot: true,
    schedule: null,
    timeout_seconds: 120,
    used_by: {
      apis: ["audit", "groups", "users"],
      scripts: ["reload-dns"],
      webhooks: ["wh-commits", "wh-failures", "wh-paused"],
    },
    sync_health: health(),
    // A scheduled pull that moved the commit, and one that failed.
    history: [
      {
        started_at: now() - 60,
        age_seconds: 60,
        duration_ms: 640,
        trigger: "scheduled",
        revision_before: "aaaaaaa1111111111111111111111111111111111",
        revision: "bbbbbbb2222222222222222222222222222222222",
      },
      {
        started_at: now() - 3600,
        age_seconds: 3600,
        duration_ms: 30000,
        trigger: "scheduled",
        error: "git fetch: could not resolve host",
      },
    ],
  },
  {
    name: "prj-scripts",
    description: "Ops scripts",
    credential: null,
    git_url: "https://git.example.com/ops/scripts.git",
    branch: "main",
    checkout_present: true,
    revision: SCRIPT_REVISION,
    sync_interval_seconds: 300,
    sync_on_boot: true,
    schedule: null,
    timeout_seconds: 120,
    used_by: { apis: [], scripts: ["cleanup"], webhooks: [] },
    sync_health: health(),
    history: [],
  },
];

const credentials: Schemas["CredentialInfo"][] = [
  {
    name: "cred-store",
    description: "Store API",
    type: "token",
    backend: "env",
    vault_path: null,
    env_vars: ["STORE_TOKEN"],
    secret_file: null,
    secret_keys: ["token"],
    file_keys: [],
    resolves: false,
    error: "Env var 'STORE_TOKEN' not set",
    used_by: {
      credentials: [],
      projects: ["prj-infra"],
      apis: ["users"],
      scripts: ["reload-dns"],
      webhooks: ["wh-failures"],
      ldap: false,
    },
  },
];

const request = (
  over: Partial<Schemas["RequestInfo"]> = {},
): Schemas["RequestInfo"] => ({
  method: "POST",
  auth: "none",
  headers: [],
  query: [],
  content_type: "json",
  templated: false,
  signature_header: null,
  waits: false,
  rate_limit: null,
  ...over,
});

// One that last sent fine, one whose receiver is failing, and one that is
// disabled, so it has never sent.
export const webhooks = (): Schemas["WebhookSummary"][] => [
  {
    name: "wh-commits",
    description: "Commits to the infrastructure",
    enabled: true,
    project: "prj-infra",
    labels: {},
    events: ["commit_pulled", "pull_failed"],
    paths: ["dns/**"],
    ignore_paths: [],
    destination: "https://hooks.example.com",
    credentials: [],
    timeout_seconds: 30,
    attempts: 3,
    request: request(),
    last: {
      event: "commit_pulled",
      project: "prj-infra",
      at: now() - 120,
      ok: true,
      attempts: 1,
      status: 200,
      error: null,
    },
  },
  {
    name: "wh-failures",
    description: "Every failure, to the alerts receiver",
    enabled: true,
    project: "prj-infra",
    labels: { team: "platform" },
    events: ["api_failed", "script_failed", "api_recovered"],
    paths: [],
    ignore_paths: [],
    destination: "https://alerts.example.com",
    credentials: ["cred-store"],
    timeout_seconds: 10,
    attempts: 4,
    request: request({
      method: "PUT",
      auth: "header",
      headers: ["X-Source", "X-Team"],
      query: ["channel"],
      content_type: "form",
      templated: true,
      signature_header: "X-Hub-Signature-256",
      waits: true,
      rate_limit: "10 per 60s",
    }),
    last: {
      event: "api_failed",
      project: "prj-infra",
      at: now() - 60,
      ok: false,
      attempts: 4,
      status: 503,
      error: "HTTP 503: Service Unavailable",
    },
  },
  {
    name: "wh-paused",
    description: null,
    enabled: false,
    project: "prj-infra",
    labels: {},
    events: ["pull_failed"],
    paths: [],
    ignore_paths: [],
    destination: "https://paused.example.com",
    credentials: [],
    timeout_seconds: 30,
    attempts: 3,
    request: request(),
    last: null,
  },
];

const settings: Schemas["Settings"] = {
  version: "9.9.9",
  uptime_seconds: 3600,
  server: {
    host: "0.0.0.0",
    port: 8183,
    cors_allowed_origins: [],
    metrics_require_auth: false,
    shutdown_grace_seconds: 20,
    max_body_bytes: 1048576,
    ui: { enabled: true, session_ttl_seconds: 3600, ldap: false },
  },
  projects: { dir: "/var/lib/unified-gitops/projects" },
  // No `secrets:` block left in config.yaml: every Vault is a credential,
  // so no outer cache and nothing deprecated.
  secrets: { cache_ttl_seconds: null, deprecated: false, vault: null },
  config_api: { enabled: false },
  restart_pending: [],
};

const authFor = (role: "admin" | "restricted"): Schemas["AuthInfo"] => ({
  me: {
    name: role === "admin" ? "e2e" : "viewer",
    method: "api_key",
    role,
    projects: role === "admin" ? [] : ["prj-infra"],
    csrf_token: "e2e-csrf",
  },
  methods: { api_key: true, ldap: false },
  ldap: null,
  api_keys:
    role === "admin"
      ? [
          { name: "e2e", role: "admin", projects: [] },
          { name: "viewer", role: "restricted", projects: ["prj-infra"] },
        ]
      : null,
});

// Each scrape answers with more runs than the last, so the charts have a
// rate to draw: 6 API runs and 2 script runs a scrape, one API run failing.
export const METRICS = (
  scrape: number,
) => `# TYPE unified_gitops_runs_total counter
unified_gitops_runs_total{kind="api",item="users",outcome="success"} ${6 * scrape}
unified_gitops_runs_total{kind="script",item="reload-dns",outcome="success"} ${2 * scrape}
unified_gitops_runs_total{kind="api",item="groups",outcome="error"} ${scrape}
# TYPE unified_gitops_run_duration_seconds histogram
unified_gitops_run_duration_seconds_bucket{kind="api",item="users",le="0.5"} ${6 * scrape}
unified_gitops_run_duration_seconds_bucket{kind="api",item="users",le="1"} ${6 * scrape}
unified_gitops_run_duration_seconds_bucket{kind="api",item="users",le="+Inf"} ${6 * scrape}
unified_gitops_run_duration_seconds_sum{kind="api",item="users"} ${0.3 * 6 * scrape}
unified_gitops_run_duration_seconds_count{kind="api",item="users"} ${6 * scrape}
unified_gitops_run_duration_seconds_bucket{kind="script",item="reload-dns",le="0.5"} 0
unified_gitops_run_duration_seconds_bucket{kind="script",item="reload-dns",le="1"} ${2 * scrape}
unified_gitops_run_duration_seconds_bucket{kind="script",item="reload-dns",le="+Inf"} ${2 * scrape}
unified_gitops_run_duration_seconds_sum{kind="script",item="reload-dns"} ${0.9 * 2 * scrape}
unified_gitops_run_duration_seconds_count{kind="script",item="reload-dns"} ${2 * scrape}
# TYPE unified_gitops_git_requests_total counter
unified_gitops_git_requests_total{project="prj-infra",operation="pull",outcome="success"} ${3 * scrape}
# TYPE unified_gitops_webhooks_total counter
unified_gitops_webhooks_total{webhook="wh-commits",event="commit_pulled",outcome="success"} ${scrape}
unified_gitops_webhooks_total{webhook="wh-failures",event="api_failed",outcome="error"} ${scrape}
# TYPE unified_gitops_project_sync_consecutive_failures gauge
unified_gitops_project_sync_consecutive_failures{project="prj-infra"} 0
unified_gitops_project_sync_consecutive_failures{project="prj-scripts"} 3
# TYPE unified_gitops_project_sync_last_success_age_seconds gauge
unified_gitops_project_sync_last_success_age_seconds{project="prj-infra"} 40
unified_gitops_project_sync_last_success_age_seconds{project="prj-scripts"} 7200
# TYPE unified_gitops_http_requests_total counter
unified_gitops_http_requests_total{method="GET",path="/api/v1/apis",status="200"} 10
`;

export interface Calls {
  writes: { method: string; path: string; headers: Record<string, string> }[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

// What a run started from the page returns: an API's requests (with their
// bodies for a dry run), a script's output (or, dry, its command line).
function manualRun(
  kind: Schemas["Kind"],
  item: Schemas["ApiSummary"] | Schemas["ScriptSummary"],
  dryRun: boolean,
): Schemas["Run"] {
  const base = {
    item: item.name,
    kind,
    project: item.project,
    trigger: "manual" as const,
    by: "e2e",
    dry_run: dryRun,
    started_at: now(),
  };
  if (kind === "api")
    return run({
      ...base,
      steps: [
        step({
          file: "users/jane.json",
          action: "update",
          method: "PUT",
          url: "https://portainer.example.com/api/users/jane",
          status: dryRun ? null : 200,
          attempts: dryRun ? 0 : 1,
          changed_fields: ["role"],
          body: dryRun ? { name: "jane", role: "admin" } : null,
        }),
      ],
    });
  return run({
    ...base,
    script_revision: SCRIPT_REVISION,
    steps: [
      step({
        action: "run",
        exit_code: dryRun ? null : 0,
        attempts: dryRun ? 0 : 1,
        output: dryRun
          ? "would run: bash dns/reload.sh --zone example.com\nwith: DNS_SERVER, DNS_VIEW, GITOPS_COMMIT"
          : "zone example.com reloaded\n",
      }),
    ],
  });
}

export async function mockApi(
  page: Page,
  role: "admin" | "restricted" = "admin",
): Promise<Calls> {
  const calls: Calls = { writes: [] };
  const s = state();
  const sent = webhooks();
  // Each one's sends, newest first: its last, and an older one that failed.
  const history: Record<string, Schemas["Delivery"][]> = Object.fromEntries(
    sent.map((n) => [
      n.name,
      n.last
        ? [
            n.last,
            {
              event: "pull_failed",
              project: "prj-infra",
              at: now() - 7200,
              ok: false,
              attempts: 4,
              status: null,
              error: "could not connect: connection refused",
            },
          ]
        : [],
    ]),
  );
  const me = authFor(role).me;
  // A restricted key sees the items of its projects; another's reads as
  // absent, as the service answers.
  const visible = (project: string) =>
    role === "admin" || me.projects.includes(project);
  const adminOnly = (route: Route, body: unknown) =>
    role === "admin"
      ? json(route, body)
      : json(route, { error: "this route needs an admin API key" }, 403);
  const items = (kind: Schemas["Kind"]) =>
    kind === "api"
      ? (s.apis as (Schemas["ApiSummary"] | Schemas["ScriptSummary"])[])
      : s.scripts;

  let scrape = 0;
  await page.route(/\/metrics$/, (route) =>
    route.request().resourceType() === "document"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: METRICS(++scrape),
        }),
  );
  await page.route(/\/api\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    // Run now and Dry run: kept in the item's history and as its last.
    const runPath = /^\/api\/v1\/(apis|scripts)\/([^/]+)\/run$/.exec(path);
    if (request.method() === "POST" && runPath) {
      calls.writes.push({
        method: "POST",
        path: `${path}${url.search}`,
        headers: request.headers(),
      });
      const kind = runPath[1] === "apis" ? "api" : "script";
      const name = decodeURIComponent(runPath[2]);
      const item = items(kind).find((i) => i.name === name);
      if (!item || !visible(item.project))
        return json(route, { error: `'${name}' is not configured` }, 404);
      const dryRun = url.searchParams.get("dry_run") === "true";
      if (!dryRun && !item.on.includes("manual"))
        return json(route, { error: `'${name}' does not run by hand` }, 409);
      const result = manualRun(kind, item, dryRun);
      item.last = result;
      s.history[`${kind}/${name}`].unshift(result);
      return json(route, result);
    }
    // Pulling a project: always works here.
    const pull = /^\/api\/v1\/projects\/([^/]+)\/sync$/.exec(path);
    if (request.method() === "POST" && pull) {
      calls.writes.push({ method: "POST", path, headers: request.headers() });
      return json(route, {
        name: pull[1],
        success: true,
        duration_ms: 120,
      } satisfies Schemas["ProjectSyncResult"]);
    }
    // A test send: always accepted here, and kept as the last send.
    const test = /^\/api\/v1\/webhooks\/([^/]+)\/test$/.exec(path);
    if (request.method() === "POST" && test) {
      calls.writes.push({ method: "POST", path, headers: request.headers() });
      const n = sent.find((x) => x.name === decodeURIComponent(test[1]));
      if (!n) return json(route, { error: "not configured" }, 404);
      n.last = {
        event: "test",
        project: null,
        at: now(),
        ok: true,
        attempts: 1,
        status: 202,
        error: null,
      };
      history[n.name]!.unshift(n.last);
      return adminOnly(route, n.last);
    }
    if (request.method() !== "GET")
      return json(route, { error: "not mocked" }, 405);

    const one = /^\/api\/v1\/webhooks\/([^/]+)$/.exec(path);
    if (one) {
      const n = sent.find((x) => x.name === decodeURIComponent(one[1]));
      if (!n)
        return json(
          route,
          { error: `webhook '${one[1]}' is not configured` },
          404,
        );
      return adminOnly(route, {
        ...n,
        history: history[n.name],
      } satisfies Schemas["WebhookDetail"]);
    }

    const item = /^\/api\/v1\/(apis|scripts)\/([^/]+)$/.exec(path);
    if (item) {
      const kind = item[1] === "apis" ? "api" : "script";
      const name = decodeURIComponent(item[2]);
      const found = items(kind).find((i) => i.name === name);
      if (!found || !visible(found.project))
        return json(route, { error: `'${name}' is not configured` }, 404);
      return json(route, {
        ...found,
        history: s.history[`${kind}/${name}`],
      });
    }
    if (path === "/api/v1/apis")
      return json(
        route,
        s.apis.filter((a) => visible(a.project)),
      );
    if (path === "/api/v1/scripts")
      return json(
        route,
        s.scripts.filter((a) => visible(a.project)),
      );
    if (path === "/api/v1/projects")
      return json(
        route,
        projects.filter((p) => visible(p.name)),
      );

    const fixed: Record<string, unknown> = {
      "/api/v1/": { version: "9.9.9" },
      "/api/v1/auth": authFor(role),
    };
    const admin: Record<string, unknown> = {
      "/api/v1/credentials": credentials,
      "/api/v1/webhooks": sent,
      "/api/v1/settings": settings,
    };
    if (path in fixed) return json(route, fixed[path]);
    if (path in admin) return adminOnly(route, admin[path]);
    return json(route, { error: `no fixture for ${path}` }, 404);
  });
  return calls;
}
