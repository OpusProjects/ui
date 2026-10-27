import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  AreaCard,
  AreaGrid,
  countStates as count,
  Fact,
  formatCount,
  InstancePanel,
  LiveSpan,
  NeedsAttention,
  Notice,
  OverviewColumns,
  PageHeader,
  perMinuteText,
  RatePanel,
  RequestsPanel,
  type Issue,
  type RatePart,
  useRatePerMinute,
  useRequestsPerMinute,
} from "@opusprojects/unified-ui";
import { cachedHealth, select, useMetrics } from "@opusprojects/unified-client";
import {
  useConnectors,
  useCredentials,
  useEndpoints,
  useProjects,
  useSettings,
  useSourceList,
  useTopology,
} from "../../api/queries";
import { instanceName } from "../../shared/instances";
import { CREDENTIAL_LABELS, credentialState } from "../credentials/model";
import { ENDPOINT_LABELS, endpointState } from "../endpoints/model";
import { PROJECT_LABELS, projectState } from "../projects/model";
import { allPeers, peerState } from "../topology/model";
import { ICONS } from "../../sections";
import {
  LABELS as CONNECTOR_LABELS,
  connectorState,
} from "../connectors/model";

const SOURCE_LABELS = { fresh: "Fresh" };

const link = (to: string, content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
);

// The front page: whether anything is wrong, and where. Every number comes
// from the same health rules as the page it links to, so the two always
// agree. An area the caller may not see (projects, credentials and the
// configuration are admin-only) is simply left out.
export function OverviewPage() {
  const sources = useSourceList();
  const endpoints = useEndpoints();
  // Admin-only, like projects and credentials: a restricted key gets no
  // card rather than a refusal.
  const connectors = useConnectors();
  const projects = useProjects();
  const credentials = useCredentials();
  const topology = useTopology();
  const settings = useSettings();

  // Views included, as on the Sources page, so the two counts agree.
  const sourceRows = sources.data ?? [];
  const sourceState = (s: (typeof sourceRows)[number]) =>
    cachedHealth(s.cached, s.is_fresh, s.sync_health);
  // Problems are this instance's own: the peers it reads from (an
  // unreachable one is listed under Needs attention).
  const peers = topology.data
    ? allPeers({ topology: topology.data, self: null, measuredAt: 0 })
    : [];

  const issues: Issue[] = [];
  for (const s of sourceRows) {
    const failures = s.sync_health?.consecutive_failures ?? 0;
    if (failures > 0)
      issues.push({
        key: `source-${s.source_id}`,
        severity: 0,
        text: (
          <>
            Source <b>{s.source_id}</b> is failing
            {failures > 1 && `, ${formatCount(failures)} syncs in a row`}
          </>
        ),
        to: `/sources/${encodeURIComponent(s.source_id)}`,
      });
  }
  for (const e of endpoints.data ?? []) {
    if (e.sources_missing.length > 0)
      issues.push({
        key: `endpoint-${e.endpoint_id}`,
        severity: 0,
        text: (
          <>
            Endpoint <b>{e.endpoint_id}</b> is unavailable: no data from{" "}
            {e.sources_missing.join(", ")}
          </>
        ),
        to: `/endpoints/${encodeURIComponent(e.endpoint_id)}`,
      });
  }
  for (const c of credentials.data ?? []) {
    if (!c.resolves)
      issues.push({
        key: `credential-${c.credential_id}`,
        severity: 0,
        text: (
          <>
            Credential <b>{c.credential_id}</b> is missing
            {c.error && `: ${c.error}`}
          </>
        ),
        to: `/credentials/${encodeURIComponent(c.credential_id)}`,
      });
  }
  for (const p of projects.data ?? []) {
    if (projectState(p) === "failing")
      issues.push({
        key: `project-${p.project_id}`,
        severity: 0,
        text: (
          <>
            Project <b>{p.project_id}</b> cannot be pulled
          </>
        ),
        to: `/projects/${encodeURIComponent(p.project_id)}`,
      });
  }
  for (const peer of peers) {
    if (peerState(peer) === "failing")
      issues.push({
        key: `peer-${peer.url}`,
        severity: 0,
        text: (
          <>
            Instance <b>{peer.instance?.name ?? instanceName(peer.url)}</b> is
            unreachable
          </>
        ),
        to: "/topology",
      });
  }
  // Late rather than broken: one line for all of them, not one each.
  const stale = sourceRows.filter(
    (s) =>
      sourceState(s) === "stale" &&
      (s.sync_health?.consecutive_failures ?? 0) === 0,
  ).length;
  if (stale > 0)
    issues.push({
      key: "sources-stale",
      severity: 2,
      text: (
        <>
          {stale} {stale === 1 ? "source is" : "sources are"} stale: older than
          their TTL
        </>
      ),
      to: "/sources",
    });
  const restart = settings.data?.restart_pending ?? [];
  if (restart.length > 0)
    issues.push({
      key: "restart",
      severity: 1,
      text: <>A restart is needed to apply {restart.join(", ")}</>,
      to: "/config",
    });

  const loading = sources.isPending || endpoints.isPending;
  // The two lists every caller may read. If either could not be loaded, an
  // empty list of problems would read as "all is well": say it could not be
  // checked instead. (Projects and credentials are refused to restricted
  // callers on purpose, so their errors are not failures.)
  const failed = [sources, endpoints].find((q) => q.isError)?.error;

  return (
    <>
      <PageHeader
        icon={ICONS.overview}
        title="Overview"
        description="Whether anything needs attention, across everything this instance serves."
      />

      {failed && (
        <Notice title="Could not check this instance">{failed.message}</Notice>
      )}

      <AreaGrid>
        {sources.isSuccess && (
          <AreaCard
            link={link}
            to="/sources"
            icon={ICONS.sources}
            title="Sources"
            counts={count(sourceRows, sourceState)}
            labels={SOURCE_LABELS}
          />
        )}
        {connectors.isSuccess && (
          <AreaCard
            link={link}
            to="/connectors"
            icon={ICONS.connectors}
            title="Connectors"
            counts={count(connectors.data, connectorState)}
            labels={CONNECTOR_LABELS}
            goodWord="Working"
          />
        )}
        {endpoints.isSuccess && (
          <AreaCard
            link={link}
            to="/endpoints"
            icon={ICONS.endpoints}
            title="Endpoints"
            counts={count(endpoints.data, endpointState)}
            labels={ENDPOINT_LABELS}
          />
        )}
        {projects.isSuccess && (
          <AreaCard
            link={link}
            to="/projects"
            icon={ICONS.projects}
            title="Projects"
            counts={count(projects.data, projectState)}
            labels={PROJECT_LABELS}
            goodWord="Synced"
          />
        )}
        {credentials.isSuccess && (
          <AreaCard
            link={link}
            to="/credentials"
            icon={ICONS.credentials}
            title="Credentials"
            // Resolving is what this card counts: an unused credential
            // resolves too (it is only a candidate for removal), as the
            // Configuration page's "7, all working" counts it.
            counts={count(credentials.data, (c) =>
              credentialState(c) === "pending" ? "fresh" : credentialState(c),
            )}
            labels={CREDENTIAL_LABELS}
            goodWord="Working"
          />
        )}
      </AreaGrid>

      <OverviewColumns>
        <NeedsAttention
          hint="Problems across this instance, worst first. Red: something broken (a failing source, an unavailable endpoint, a missing credential, a project that cannot be pulled, an unreachable instance). Amber: something late or waiting (stale sources, a restart needed). Each line opens the page to fix it on."
          issues={issues}
          link={link}
          failed={
            failed && "the list of sources or endpoints could not be loaded."
          }
          loading={loading}
        />
        <ThisInstance
          uptime={settings.data?.uptime_seconds}
          at={settings.dataUpdatedAt}
        />
      </OverviewColumns>

      <RequestsPanel prefix="unified_api" />
      <RatePanel
        title="Outgoing requests (per minute)"
        hint="The calls this instance makes to the external systems' APIs: a connector script syncing a whole source or part of it (a refresh, a host, a group), and an enricher run. One per run, whatever the script asks of its API in it. Federation, ssh and static inventories are left out. From its own /metrics, sampled every ten seconds while the app is open; the app keeps the last half hour."
        metric={OUTGOING}
        parts={OUTGOING_PARTS}
        series={7}
      />
    </>
  );
}

// The traffic this instance sends to the systems it inventories.
const OUTGOING = "unified_api_source_requests_total";
// Every request is one of the first three, so they add up to the point's
// total; failed is counted within them.
const OUTGOING_PARTS: RatePart[] = [
  { name: ["full sync", "full syncs"], filter: (l) => l.operation === "full" },
  {
    name: ["partial sync", "partial syncs"],
    filter: (l) => l.operation === "partial",
  },
  {
    name: ["enricher run", "enricher runs"],
    filter: (l) => l.operation === "enrich",
  },
  {
    name: ["failed", "failed"],
    filter: (l) => l.outcome === "error",
    subset: true,
  },
];

// A few numbers about this instance itself, from what the app already
// samples: no request of its own.
function ThisInstance({ uptime, at }: { uptime?: number; at: number }) {
  const { scrapes } = useMetrics();
  const latest = scrapes.at(-1);
  const unique = latest
    ? select(latest.samples, "unified_api_hosts_unique")[0]?.value
    : undefined;
  const incoming = useRequestsPerMinute("unified_api");
  const outgoing = useRatePerMinute(OUTGOING);

  return (
    <InstancePanel>
      <Fact label="Hosts">{unique != null ? formatCount(unique) : "…"}</Fact>
      <Fact label="Incoming requests">{perMinuteText(incoming)}</Fact>
      <Fact label="Outgoing requests">{perMinuteText(outgoing)}</Fact>
      {uptime != null && (
        <Fact label="Running for">
          <LiveSpan seconds={uptime} at={at} />
        </Fact>
      )}
    </InstancePanel>
  );
}
