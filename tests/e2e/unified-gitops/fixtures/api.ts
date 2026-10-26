import type { Page, Route } from "@playwright/test";
import type { components } from "../../../../apps/unified-gitops/src/api/schema";

type Schemas = components["schemas"];

// An invented unified-gitops instance: three applications (one synced, one
// out of sync with a pending plan, an unmanaged object and a local copy of
// its system's settings, one failed), a connector, a project and a credential
// that does not resolve. Typed against the generated schema, so an API change
// that breaks the UI's assumptions breaks the typecheck here too. Stateful:
// a sync applies the pending plan, as the real service would.

const now = () => Math.floor(Date.now() / 1000);

const health = (failures = 0, error?: string): Schemas["SyncHealthInfo"] => ({
  last_attempt_age_seconds: 20,
  last_success_age_seconds: failures ? 3600 : 20,
  last_error: failures ? (error ?? "failed") : null,
  consecutive_failures: failures,
});

const summary = (
  id: string,
  over: Partial<Schemas["ApplicationSummary"]>,
): Schemas["ApplicationSummary"] => ({
  name: id,
  description: null,
  project: "prj-state",
  path: `apps/${id}`,
  connector: "kv",
  credentials: [],
  config_keys: [],
  auto_sync: false,
  prune: false,
  sync_interval_seconds: 300,
  status: "synced",
  revision: "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  last_checked_age_seconds: 20,
  pending_operations: 0,
  unmanaged: 0,
  in_sync: 4,
  sync_health: health(),
  ...over,
});

const PLAN: Schemas["Operation"][] = [
  {
    kind: "entry",
    key: "timeout",
    op: "update",
    object: { name: "timeout", value: "0030" } as never,
    changes: [{ field: "value", from: 9 as never, to: "0030" as never }],
  },
  {
    kind: "entry",
    key: "region",
    op: "create",
    object: { name: "region", value: "eu-west" } as never,
  },
];

const UNMANAGED: Schemas["Operation"][] = [
  {
    kind: "entry",
    key: "hand-made",
    op: "delete",
    object: { name: "hand-made", value: 1 } as never,
  },
];

const run = (over: Partial<Schemas["RunRecord"]>): Schemas["RunRecord"] => ({
  id: 1,
  trigger: "schedule",
  mode: "plan",
  result: "succeeded",
  started_at: now() - 60,
  finished_at: now() - 59,
  revision: "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  planned: 0,
  operations: [],
  applied: [],
  errors: [],
  ...over,
});

function state() {
  const apps = {
    synced: summary("synced", { description: "Synced settings" }),
    drifted: summary("drifted", {
      description: "Drifted settings",
      status: "out_of_sync",
      pending_operations: PLAN.length,
      unmanaged: UNMANAGED.length,
      in_sync: 1,
      credentials: ["cred-store"],
      config_keys: ["url"],
    }),
    // No description: the UI must show nothing there, never "null".
    broken: summary("broken", {
      status: "failed",
      last_checked_age_seconds: null,
      pending_operations: 0,
      in_sync: 0,
      sync_health: health(
        2,
        "settings.yaml: connector 'kv' has no kind 'setting'",
      ),
    }),
  };
  return {
    apps,
    plans: {
      synced: { operations: [], unmanaged: [] },
      drifted: { operations: [...PLAN], unmanaged: [...UNMANAGED] },
      broken: null,
    } as Record<
      string,
      {
        operations: Schemas["Operation"][];
        unmanaged: Schemas["Operation"][];
      } | null
    >,
    // The local copy of each system's settings, by kind. The failed one has
    // never been read.
    copies: {
      synced: { entry: [{ name: "timeout", value: "0030" }] },
      drifted: {
        entry: [
          { name: "timeout", value: 9 },
          { name: "hand-made", value: 1 },
        ],
      },
      broken: {},
    } as Record<string, Record<string, unknown[]>>,
    history: {
      // A sync of an older commit, the one to roll back to.
      synced: [
        run({}),
        run({
          id: 0,
          trigger: "manual",
          mode: "apply",
          revision: OLD_REVISION,
          applied: [{ kind: "entry", key: "timeout", op: "update", ok: true }],
          planned: 1,
          operations: [
            {
              kind: "entry",
              key: "timeout",
              op: "update",
              object: { key: "timeout", value: "0030" },
              changes: [{ field: "value", from: "0060", to: "0030" }],
              file: "apps/demo/entries.yaml",
            } as unknown as Schemas["Operation"],
          ],
        }),
      ],
      drifted: [run({ result: "out_of_sync", planned: 2 })],
      broken: [
        run({
          result: "failed",
          errors: ["settings.yaml: connector 'kv' has no kind 'setting'"],
        }),
      ],
    } as Record<string, Schemas["RunRecord"][]>,
  };
}

const connectors: Schemas["ConnectorInfo"][] = [
  {
    name: "kv",
    description: "Key-value store",
    type: "script",
    project: "prj-state",
    path: "connectors/kv.py",
    timeout_seconds: 60,
    used_by: ["broken", "drifted", "synced"],
  },
  {
    name: "powerscale",
    description: "Dell PowerScale",
    type: "script",
    project: null,
    path: "/opt/connectors/powerscale.py",
    timeout_seconds: 120,
    used_by: [],
  },
];

const projects: Schemas["ProjectInfo"][] = [
  {
    name: "prj-state",
    description: "Desired state",
    credential: "cred-store",
    // A token in the remote: the UI must never show it.
    git_url: "https://deploy:SECRET-TOKEN@git.example.com/ops/state.git",
    branch: "main",
    checkout_present: true,
    sync_interval_seconds: 60,
    sync_on_boot: true,
    schedule: null,
    timeout_seconds: 120,
    used_by: {
      applications: ["broken", "drifted", "synced"],
      connectors: ["kv"],
    },
    sync_health: health(),
  },
];

const credentials: Schemas["CredentialInfo"][] = [
  {
    name: "cred-store",
    description: "Store API",
    type: "username_password",
    backend: "env",
    vault_path: null,
    env_vars: ["STORE_USERNAME", "STORE_PASSWORD"],
    secret_file: null,
    secret_keys: ["username", "password"],
    file_keys: [],
    resolves: false,
    error: "Env var 'STORE_PASSWORD' not set",
    used_by: {
      applications: ["drifted"],
      projects: ["prj-state"],
      ldap: false,
    },
  },
];

// One that last sent fine, one whose receiver is failing, and one that
// names no application, so it has never sent.
const webhooks = (): Schemas["WebhookSummary"][] => [
  {
    name: "wh-ascender-drift",
    description: "Drift report in Ascender",
    type: "ascender",
    events: ["drift_detected"],
    all_applications: false,
    applications: ["drifted"],
    destination: "https://ascender.example.com",
    job_template: 12,
    workflow_job_template: null,
    credentials: ["cred-store"],
    timeout_seconds: 30,
    retries: 3,
    request: null,
    last: {
      event: "drift_detected",
      application: "drifted",
      at: now() - 300,
      ok: true,
      attempts: 1,
      status: 202,
      error: null,
    },
  },
  {
    name: "wh-failures",
    description: "Every failure, to the alerts receiver",
    type: "webhook",
    events: ["sync_failed", "back_in_sync"],
    all_applications: true,
    applications: [],
    destination: "https://alerts.example.com",
    job_template: null,
    workflow_job_template: null,
    credentials: [],
    timeout_seconds: 10,
    retries: 3,
    request: {
      method: "POST",
      auth: "header",
      auth_header: "X-Alerts-Token",
      headers: ["X-Source", "X-Team"],
      templated: true,
      signature_header: "X-Hub-Signature-256",
    },
    last: {
      event: "sync_failed",
      application: "broken",
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
    type: "webhook",
    events: ["drift_detected"],
    all_applications: false,
    applications: [],
    destination: "https://hooks.example.com",
    job_template: null,
    workflow_job_template: null,
    credentials: [],
    timeout_seconds: 30,
    retries: 3,
    request: {
      method: "POST",
      auth: "none",
      auth_header: null,
      headers: [],
      templated: false,
      signature_header: null,
    },
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
  state: { dir: "/var/lib/unified-gitops/state" },
  projects: { dir: "/var/lib/unified-gitops/projects" },
  secrets: { cache_ttl_seconds: 60, vault: null },
  config_api: { enabled: false },
  restart_pending: [],
};

const authFor = (role: "admin" | "restricted"): Schemas["AuthInfo"] => ({
  me: {
    name: role === "admin" ? "e2e" : "viewer",
    method: "api_key",
    role,
    applications: role === "admin" ? [] : ["drifted"],
    csrf_token: "e2e-csrf",
  },
  methods: { api_key: true, ldap: false },
  ldap: null,
  api_keys:
    role === "admin"
      ? [{ name: "e2e", role: "admin", applications: [] }]
      : null,
});

// Each scrape answers with more calls made to the systems than the last, so
// the overview's chart has a rate to draw: 6 reads and 2 writes a scrape.
const METRICS = (
  scrape: number,
) => `# TYPE unified_gitops_connector_calls_total counter
unified_gitops_connector_calls_total{application="drifted",connector="kv",command="list",outcome="success"} ${6 * scrape}
unified_gitops_connector_calls_total{application="drifted",connector="kv",command="apply",outcome="success"} ${2 * scrape}
# TYPE unified_gitops_connector_call_duration_seconds histogram
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="list",le="0.5"} ${6 * scrape}
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="list",le="1"} ${6 * scrape}
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="list",le="+Inf"} ${6 * scrape}
unified_gitops_connector_call_duration_seconds_sum{application="drifted",connector="kv",command="list"} ${0.3 * 6 * scrape}
unified_gitops_connector_call_duration_seconds_count{application="drifted",connector="kv",command="list"} ${6 * scrape}
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="apply",le="0.5"} 0
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="apply",le="1"} ${2 * scrape}
unified_gitops_connector_call_duration_seconds_bucket{application="drifted",connector="kv",command="apply",le="+Inf"} ${2 * scrape}
unified_gitops_connector_call_duration_seconds_sum{application="drifted",connector="kv",command="apply"} ${0.9 * 2 * scrape}
unified_gitops_connector_call_duration_seconds_count{application="drifted",connector="kv",command="apply"} ${2 * scrape}
unified_gitops_connector_calls_total{application="broken",connector="kv",command="describe",outcome="error"} ${scrape}
# TYPE unified_gitops_application_consecutive_failures gauge
unified_gitops_application_consecutive_failures{application="drifted"} 0
unified_gitops_application_consecutive_failures{application="synced"} 0
unified_gitops_application_consecutive_failures{application="broken"} 3
# TYPE unified_gitops_application_last_success_age_seconds gauge
unified_gitops_application_last_success_age_seconds{application="drifted"} 40
unified_gitops_application_last_success_age_seconds{application="synced"} 70
# TYPE unified_gitops_application_last_check_age_seconds gauge
unified_gitops_application_last_check_age_seconds{application="drifted"} 40
unified_gitops_application_last_check_age_seconds{application="synced"} 70
unified_gitops_application_last_check_age_seconds{application="broken"} 20
# TYPE unified_gitops_http_requests_total counter
unified_gitops_http_requests_total{method="GET",path="/api/v1/applications",status="200"} 10
# TYPE unified_gitops_application_status gauge
unified_gitops_application_status{application="drifted",status="out_of_sync"} 1
unified_gitops_application_status{application="synced",status="synced"} 1
unified_gitops_application_status{application="broken",status="failed"} 1
# TYPE unified_gitops_application_pending_operations gauge
unified_gitops_application_pending_operations{application="drifted"} 2
`;

export const OLD_REVISION = "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export interface Calls {
  writes: { method: string; path: string; headers: Record<string, string> }[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

export async function mockApi(
  page: Page,
  role: "admin" | "restricted" = "admin",
  // Older scheduled checks appended to the synced application's history,
  // for a history long enough to page.
  olderRuns = 0,
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
              event: "sync_failed",
              application: "broken",
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
  for (let i = 0; i < olderRuns; i++)
    s.history.synced.push(
      run({ id: -1 - i, started_at: now() - 3600 - 120 * i }),
    );
  const visible = (id: string) =>
    role === "admin" || authFor(role).me.applications.includes(id);
  const adminOnly = (route: Route, body: unknown) =>
    role === "admin"
      ? json(route, body)
      : json(route, { error: "this route needs an admin API key" }, 403);

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
    const path = new URL(request.url()).pathname;
    const app = /^\/api\/v1\/applications\/([^/]+)(\/(sync|refresh))?$/.exec(
      path,
    );

    // What a rollback would change: nothing is written, so not a "write".
    const preview =
      /^\/api\/v1\/applications\/([^/]+)\/rollback\/preview$/.exec(path);
    if (request.method() === "POST" && preview) {
      const revision = (request.postDataJSON() as { revision: string })
        .revision;
      return json(route, {
        checked_at: now(),
        revision,
        operations: [
          {
            kind: "entry",
            key: "timeout",
            op: "update",
            object: { name: "timeout", value: "0030" },
            changes: [{ field: "value", from: "0031", to: "0030" }],
          },
        ],
        unmanaged: [],
        in_sync: 1,
        errors: [],
        // The spec types a JSON value as an empty object; any value is fine.
      } as unknown as Schemas["PlanSnapshot"]);
    }

    // Rollback: applies the older commit, marks the application rolled
    // back; the next sync (below) ends it.
    const back = /^\/api\/v1\/applications\/([^/]+)\/rollback$/.exec(path);
    if (request.method() === "POST" && back) {
      calls.writes.push({ method: "POST", path, headers: request.headers() });
      const id = back[1];
      const revision = (request.postDataJSON() as { revision: string })
        .revision;
      const a = s.apps[id as keyof typeof s.apps];
      const record = run({
        trigger: "rollback",
        mode: "apply",
        revision,
        planned: 1,
        applied: [{ kind: "entry", key: "timeout", op: "update", ok: true }],
      });
      a.revision = revision;
      a.rollback = { revision, age_seconds: 0 };
      s.history[id] = [
        { ...record, id: s.history[id].length + 1 },
        ...s.history[id],
      ];
      return json(route, record);
    }

    if (request.method() === "POST" && app?.[3]) {
      calls.writes.push({
        method: "POST",
        path,
        headers: request.headers(),
      });
      const id = app[1];
      const plan = s.plans[id];
      const record =
        id === "broken"
          ? run({
              trigger: "manual",
              mode: app[3] === "sync" ? "apply" : "plan",
              result: "failed",
              errors: ["settings.yaml: connector 'kv' has no kind 'setting'"],
            })
          : app[3] === "refresh"
            ? run({
                trigger: "manual",
                result: plan?.operations.length ? "out_of_sync" : "succeeded",
                planned: plan?.operations.length ?? 0,
                operations: (plan?.operations ?? []) as Schemas["Operation"][],
              })
            : run({
                trigger: "manual",
                mode: "apply",
                planned: plan?.operations.length ?? 0,
                operations: (plan?.operations ?? []) as Schemas["Operation"][],
                applied: (plan?.operations ?? []).map((o) => ({
                  kind: o.kind,
                  key: o.key,
                  op: o.op,
                  ok: true,
                })),
              });
      if (app[3] === "sync") {
        const a = s.apps[id as keyof typeof s.apps];
        a.rollback = undefined;
        a.revision = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
      }
      if (app[3] === "sync" && plan) {
        plan.operations = [];
        const a = s.apps[id as keyof typeof s.apps];
        a.status = "synced";
        a.pending_operations = 0;
      }
      s.history[id] = [
        { ...record, id: s.history[id].length + 1 },
        ...s.history[id],
      ];
      return json(route, record);
    }
    // Pulling a project: admin-only, and always works here.
    const pull = /^\/api\/v1\/projects\/([^/]+)\/sync$/.exec(path);
    if (request.method() === "POST" && pull) {
      calls.writes.push({ method: "POST", path, headers: request.headers() });
      return adminOnly(route, {
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
        application: null,
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

    if (path === "/api/v1/applications")
      return json(
        route,
        Object.values(s.apps).filter((a) => visible(a.name)),
      );
    if (app) {
      const id = app[1];
      const a = s.apps[id as keyof typeof s.apps];
      if (!a)
        return json(
          route,
          { error: `application '${id}' is not configured` },
          404,
        );
      if (!visible(id))
        return json(route, { error: "this API key may not access it" }, 403);
      const plan = s.plans[id];
      return json(route, {
        ...a,
        state: Object.entries(s.copies[id]).map(([kind, items]) => ({
          application: id,
          kind,
          items: items.length,
          written_at: now() - 20,
        })),
        plan: plan && {
          checked_age_seconds: 20,
          revision: a.revision,
          in_sync: a.in_sync,
          errors: [],
          ...plan,
        },
        history: s.history[id],
      } satisfies Schemas["ApplicationDetail"]);
    }
    // Scoped like the application: a restricted key reads its own.
    const copy = /^\/api\/v1\/applications\/([^/]+)\/state\/([^/]+)$/.exec(
      path,
    );
    if (copy) {
      const [, id, kind] = copy;
      if (!visible(id))
        return json(route, { error: "this API key may not access it" }, 403);
      const items = s.copies[id]?.[kind];
      if (!items)
        return json(route, { error: `no local copy of ${kind} yet` }, 404);
      return json(route, {
        application: id,
        kind,
        // `Object` in the spec: free-form objects, typed as never.
        items: items as never[],
        written_at: now() - 20,
      } satisfies Schemas["Snapshot"]);
    }
    // Over the local copies, as the service searches: a key that contains
    // the text first, then a value that does (naming its field); scoped like
    // the applications. An object git does not declare is not managed.
    if (path === "/api/v1/search") {
      const url = new URL(request.url());
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      if (!q) return json(route, { error: "q must not be empty" }, 400);
      const byKey: Schemas["FoundObject"][] = [];
      const byValue: Schemas["FoundObject"][] = [];
      for (const [application, kinds] of Object.entries(s.copies)) {
        if (!visible(application)) continue;
        const unmanaged = (s.plans[application]?.unmanaged ?? []).map(
          (o) => o.key,
        );
        for (const [kind, items] of Object.entries(kinds)) {
          for (const item of items as Record<string, unknown>[]) {
            const key = String(item.name);
            const found = {
              application,
              kind,
              key,
              managed: !unmanaged.includes(key),
              written_at: now() - 20,
            };
            if (key.toLowerCase().includes(q)) byKey.push(found);
            else {
              const field = Object.keys(item).find((f) =>
                String(item[f]).toLowerCase().includes(q),
              );
              if (field) byValue.push({ ...found, field });
            }
          }
        }
      }
      return json(route, [...byKey, ...byValue]);
    }
    const fixed: Record<string, unknown> = {
      "/api/v1/": { version: "9.9.9" },
      "/api/v1/auth": authFor(role),
    };
    const admin: Record<string, unknown> = {
      "/api/v1/connectors": connectors,
      "/api/v1/projects": projects,
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
