import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  AreaCard,
  AreaGrid,
  Fact,
  InstancePanel,
  NeedsAttention,
  Notice,
  OverviewColumns,
  PageHeader,
  RatePanel,
  countStates,
  perMinuteText,
  LiveSpan,
  useRatePerMinute,
  type Issue,
  type RatePart,
} from "@opusprojects/unified-ui";
import {
  CREDENTIAL_LABELS,
  PROJECT_LABELS,
  taskHealth,
  useMetrics,
} from "@opusprojects/unified-client";
import {
  useApplications,
  useConnectors,
  useCredentials,
  useWebhooks,
  useProjects,
  useSettings,
} from "../../api/queries";
import { ICONS } from "../../sections";
import { APP_LABELS, appState } from "../applications/model";
import { credentialState } from "../credentials/model";
import { LABELS as WEBHOOK_LABELS, webhookState } from "../webhooks/model";
import {
  LABELS as CONNECTOR_LABELS,
  connectorRequests,
  requestState,
} from "../connectors/model";

const link = (to: string, content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
);

const appPath = (id: string) => `/applications/${encodeURIComponent(id)}`;

// The front page: whether git and the systems agree, and where they do not.
// Every number comes from the same rules as the page it links to. Areas a
// restricted key may not see (projects, credentials) are left out.
export function OverviewPage() {
  const applications = useApplications();
  // Admin-only, like projects: a restricted key gets no card.
  const connectors = useConnectors();
  const { scrapes } = useMetrics();
  const requests = (connectors.data ?? []).map((c) => ({
    name: c.name,
    requests: connectorRequests(scrapes, c.name),
  }));
  const projects = useProjects();
  const credentials = useCredentials();
  const webhooks = useWebhooks();
  const settings = useSettings();

  const apps = applications.data ?? [];
  const issues: Issue[] = [];
  for (const app of apps) {
    if (app.status === "failed")
      issues.push({
        key: `app-${app.name}`,
        severity: 0,
        text: (
          <>
            Application <b>{app.name}</b> failed
            {app.sync_health?.last_error && `: ${app.sync_health.last_error}`}
          </>
        ),
        to: appPath(app.name),
      });
    else if (app.status === "out_of_sync")
      issues.push({
        key: `app-${app.name}`,
        severity: 1,
        text: (
          <>
            Application <b>{app.name}</b> is out of sync:{" "}
            {app.pending_operations}{" "}
            {app.pending_operations === 1 ? "change" : "changes"} to apply
          </>
        ),
        to: appPath(app.name),
      });
  }
  for (const p of projects.data ?? []) {
    if (taskHealth(p.sync_health) === "failing")
      issues.push({
        key: `project-${p.name}`,
        severity: 0,
        text: (
          <>
            Project <b>{p.name}</b> cannot be pulled
          </>
        ),
        to: "/projects",
      });
  }
  for (const c of credentials.data ?? []) {
    if (!c.resolves)
      issues.push({
        key: `credential-${c.name}`,
        severity: 0,
        text: (
          <>
            Credential <b>{c.name}</b> is missing
            {c.error && `: ${c.error}`}
          </>
        ),
        to: "/credentials",
      });
  }
  for (const n of webhooks.data ?? []) {
    if (n.last && !n.last.ok)
      issues.push({
        key: `webhook-${n.name}`,
        severity: 0,
        text: (
          <>
            Webhook <b>{n.name}</b> could not send
            {n.last.error && `: ${n.last.error}`}
          </>
        ),
        to: `/webhooks/${encodeURIComponent(n.name)}`,
      });
  }
  for (const { name, requests: r } of requests)
    if (r && r.failed > 0)
      issues.push({
        key: `connector-${name}`,
        severity: 0,
        text: (
          <>
            Connector <b>{name}</b>: {r.failed} failed{" "}
            {r.failed === 1 ? "request" : "requests"} in the last {r.minutes}{" "}
            min
          </>
        ),
        to: `/connectors/${encodeURIComponent(name)}`,
      });
  const restart = settings.data?.restart_pending ?? [];
  if (restart.length > 0)
    issues.push({
      key: "restart",
      severity: 1,
      text: <>A restart is needed to apply {restart.join(", ")}</>,
      to: "/config",
    });

  const pending = apps.reduce((n, a) => n + a.pending_operations, 0);

  return (
    <>
      <PageHeader
        icon={ICONS.overview}
        title="Overview"
        description="Whether git and the systems agree, and what needs fixing."
      />
      {applications.isError && (
        <Notice title="Could not check this instance">
          {applications.error.message}
        </Notice>
      )}

      <AreaGrid>
        {applications.isSuccess && (
          <AreaCard
            to="/applications"
            link={link}
            icon={ICONS.applications}
            title="Applications"
            counts={countStates(apps, appState)}
            labels={APP_LABELS}
            goodWord="Synced"
          />
        )}
        {connectors.isSuccess && (
          <AreaCard
            to="/connectors"
            link={link}
            icon={ICONS.connectors}
            title="Connectors"
            counts={countStates(requests, (c) => requestState(c.requests))}
            labels={CONNECTOR_LABELS}
            goodWord="Working"
          />
        )}
        {projects.isSuccess && (
          <AreaCard
            to="/projects"
            link={link}
            icon={ICONS.projects}
            title="Projects"
            counts={countStates(projects.data, (p) =>
              taskHealth(p.sync_health),
            )}
            labels={PROJECT_LABELS}
            goodWord="Synced"
          />
        )}
        {credentials.isSuccess && (
          <AreaCard
            to="/credentials"
            link={link}
            icon={ICONS.credentials}
            title="Credentials"
            // Resolving is what this card counts: an unused credential
            // resolves too (it is only a candidate for removal).
            counts={countStates(credentials.data, (c) =>
              credentialState(c) === "pending" ? "fresh" : credentialState(c),
            )}
            labels={CREDENTIAL_LABELS}
            goodWord="Working"
          />
        )}
        {webhooks.isSuccess && webhooks.data.length > 0 && (
          <AreaCard
            to="/webhooks"
            link={link}
            icon={ICONS.webhooks}
            title="Webhooks"
            counts={countStates(webhooks.data, webhookState)}
            labels={WEBHOOK_LABELS}
            goodWord="Sending"
          />
        )}
      </AreaGrid>

      <OverviewColumns>
        <NeedsAttention
          hint="What needs a person, worst first. Red: something broken (an application that failed, a connector whose requests fail, a project that cannot be pulled, a missing credential, a webhook that could not send). Amber: git and a system disagree and nobody has synced yet, or a restart is needed. Each line opens the page to act on."
          issues={issues}
          link={link}
          failed={
            applications.isError
              ? "the list of applications could not be loaded."
              : undefined
          }
          loading={applications.isPending}
        />
        <ThisInstance
          pending={pending}
          uptime={settings.data?.uptime_seconds}
          at={settings.dataUpdatedAt}
        />
      </OverviewColumns>

      <RatePanel
        title="Requests to applications per minute"
        hint="The requests this instance makes to the applications, through their connectors: list reads a kind, apply writes one change, describe starts each run. From its own /metrics, sampled every ten seconds while the app is open; the app keeps the last half hour."
        metric={CALLS}
        parts={CALL_PARTS}
      />
    </>
  );
}

// The traffic this instance originates: its own HTTP routes are mostly this
// app polling it, so they say nothing about what it does.
const CALLS = "unified_gitops_connector_calls_total";
// Every call is one of the first three, so they add up to the point's
// total; failed is counted within them.
const CALL_PARTS: RatePart[] = [
  { name: ["read", "reads"], filter: (l) => l.command === "list" },
  { name: ["write", "writes"], filter: (l) => l.command === "apply" },
  { name: ["describe", "describes"], filter: (l) => l.command === "describe" },
  {
    name: ["failed", "failed"],
    filter: (l) => l.outcome === "error",
    subset: true,
  },
];

function ThisInstance({
  pending,
  uptime,
  at,
}: {
  pending: number;
  uptime?: number;
  at: number;
}) {
  const perMinute = useRatePerMinute(CALLS);
  return (
    <InstancePanel>
      <Fact label="To apply">
        {pending} {pending === 1 ? "change" : "changes"}
      </Fact>
      <Fact label="Requests sent">{perMinuteText(perMinute)}</Fact>
      {uptime != null && (
        <Fact label="Running for">
          <LiveSpan seconds={uptime} at={at} />
        </Fact>
      )}
    </InstancePanel>
  );
}
