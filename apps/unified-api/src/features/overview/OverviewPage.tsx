import type { ReactNode } from "react";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import {
  Fact,
  Notice,
  PageHeader,
  Panel,
  formatSpan,
  lift,
  compact,
  LineChart,
} from "@opusprojects/unified-ui";
import {
  HEALTH_ORDER,
  cachedHealth,
  rate,
  select,
  type HealthState,
  useMetrics,
} from "@opusprojects/unified-client";
import {
  useCredentials,
  useEndpoints,
  useProjects,
  useSettings,
  useSourceList,
  useTopology,
} from "../../api/queries";
import { common } from "../../shared/Detail";
import { instanceName } from "../../shared/instances";
import { CREDENTIAL_LABELS, credentialState } from "../credentials/model";
import { ENDPOINT_LABELS, endpointState } from "../endpoints/model";
import { PEER_LABELS, allPeers, peerState } from "../topology/model";
import { PROJECT_LABELS, projectState } from "../projects/model";
import { ICONS } from "../../sections";
import styles from "./OverviewPage.module.css";

type Counts = Record<HealthState, number>;
type Labels = Partial<Record<HealthState, string>>;

const SOURCE_LABELS = { fresh: "fresh" };

function count<T>(items: T[], state: (item: T) => HealthState): Counts {
  const counts: Counts = { fresh: 0, stale: 0, failing: 0, pending: 0 };
  for (const item of items) counts[state(item)] += 1;
  return counts;
}

// One thing that needs a person: what, why, and where to go about it.
// Severity orders the list: what is broken before what is late.
interface Issue {
  key: string;
  severity: number;
  text: ReactNode;
  to: string;
}

// The front page: whether anything is wrong, and where. Every number comes
// from the same health rules as the page it links to, so the two always
// agree. An area the caller may not see (projects, credentials and the
// configuration are admin-only) is simply left out.
export function OverviewPage() {
  const sources = useSourceList();
  const endpoints = useEndpoints();
  const projects = useProjects();
  const credentials = useCredentials();
  const topology = useTopology();
  const settings = useSettings();

  // Views included, as on the Sources page, so the two counts agree.
  const sourceRows = sources.data ?? [];
  const sourceState = (s: (typeof sourceRows)[number]) =>
    cachedHealth(s.cached, s.is_fresh, s.sync_health);
  const peers = topology.data ? allPeers(topology.data) : [];

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
            {failures > 1 && `, ${failures} syncs in a row`}
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
    const state = peerState(peer);
    if (state === "failing" || state === "stale")
      issues.push({
        key: `peer-${peer.url}`,
        severity: state === "failing" ? 0 : 1,
        text: (
          <>
            Instance <b>{instanceName(peer.url)}</b> is{" "}
            {state === "failing" ? "unreachable" : "failing to provide data"}
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
  issues.sort((a, b) => a.severity - b.severity);

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

      <div className={styles.areas}>
        {sources.isSuccess && (
          <Area
            to="/sources"
            icon={ICONS.sources}
            title="Sources"
            counts={count(sourceRows, sourceState)}
            labels={SOURCE_LABELS}
          />
        )}
        {endpoints.isSuccess && (
          <Area
            to="/endpoints"
            icon={ICONS.endpoints}
            title="Endpoints"
            counts={count(endpoints.data, endpointState)}
            labels={ENDPOINT_LABELS}
          />
        )}
        {projects.isSuccess && (
          <Area
            to="/projects"
            icon={ICONS.projects}
            title="Projects"
            counts={count(projects.data, projectState)}
            labels={PROJECT_LABELS}
          />
        )}
        {credentials.isSuccess && (
          <Area
            to="/credentials"
            icon={ICONS.credentials}
            title="Credentials"
            // Resolving is what this card counts: an unused credential
            // resolves too (it is only a candidate for removal), as the
            // Configuration page's "7, all resolve" counts it.
            counts={count(credentials.data, (c) =>
              credentialState(c) === "pending" ? "fresh" : credentialState(c),
            )}
            labels={CREDENTIAL_LABELS}
            goodWord="resolve"
          />
        )}
        {topology.isSuccess && (
          <Area
            to="/topology"
            icon={ICONS.topology}
            title="Instances"
            counts={count(peers, peerState)}
            labels={PEER_LABELS}
            empty="No peers"
          />
        )}
      </div>

      <div className={styles.columns}>
        <Panel
          title="Needs attention"
          hint="Problems across this instance, worst first. Red: something broken (a failing source, an unavailable endpoint, a missing credential, a project that cannot be pulled, an unreachable instance). Amber: something late or waiting (stale sources, a restart needed). Each line opens the page to fix it on."
        >
          {failed ? (
            <p className={common.soft}>
              Not checked: the list of sources or endpoints could not be loaded.
            </p>
          ) : loading ? (
            <p className={common.soft}>Checking…</p>
          ) : issues.length === 0 ? (
            <p className={styles.allClear}>
              Nothing needs attention: everything is healthy.
            </p>
          ) : (
            <ul className={styles.issues}>
              {issues.map((issue) => (
                <li key={issue.key} data-severity={issue.severity}>
                  <Link to={issue.to}>
                    {issue.text}
                    <ExternalLink aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <ThisInstance uptime={settings.data?.uptime_seconds} />
      </div>

      <RequestsCard />
    </>
  );
}

// One area: how many of its items are healthy, a bar of all of their
// states, and the whole card a way into its page.
function Area({
  to,
  icon,
  title,
  counts,
  labels,
  empty = "None",
  goodWord,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  counts: Counts;
  labels: Labels;
  empty?: string;
  // What the healthy ones are, said of several: "resolve", not the pill's
  // "Resolves". Defaults to the area's own healthy label.
  goodWord?: string;
}) {
  const total = HEALTH_ORDER.reduce((sum, state) => sum + counts[state], 0);
  const good = goodWord ?? (labels.fresh ?? "healthy").toLowerCase();
  return (
    <Link to={to} className={lift(styles.area)}>
      <span className={styles.areaTitle}>
        <span className={styles.areaIcon} aria-hidden>
          {icon}
        </span>
        {title}
      </span>
      {total === 0 ? (
        <span className={styles.areaEmpty}>{empty}</span>
      ) : (
        <>
          <span className={styles.areaCount}>
            {counts.fresh}
            <span className={styles.areaOf}> of {total}</span>
          </span>
          <span className={styles.areaLabel}>{good}</span>
          <span className={styles.bar} aria-hidden>
            {HEALTH_ORDER.filter((s) => counts[s] > 0).map((state) => (
              <span
                key={state}
                data-state={state}
                style={{ flexGrow: counts[state] }}
              />
            ))}
          </span>
        </>
      )}
    </Link>
  );
}

// The last half hour of calls this instance received, as the Metrics page
// draws it: enough to tell normal traffic from traffic that stopped (a
// consumer such as an inventory sync no longer calling).
function RequestsCard() {
  const { scrapes } = useMetrics();
  const points = scrapes.slice(1).map((scrape, i) => ({
    at: scrape.at,
    value:
      rate(scrapes[i], scrape, "unified_api_http_requests_total", notSelf) * 60,
  }));
  return (
    <Panel
      title="Requests per minute"
      hint="Calls this instance received, from its own /metrics sampled every ten seconds while the app is open; reads of /metrics itself are left out. The app keeps the last half hour."
      className={styles.requestsCard}
    >
      <LineChart
        points={points}
        series={3}
        label="Requests per minute"
        format={(v) => `${compact(v)} per minute`}
        empty="Collecting: the first point appears after two samples, ten seconds apart."
      />
    </Panel>
  );
}

const notSelf = (labels: Record<string, string>) => labels.path !== "/metrics";

// A few numbers about this instance itself, from what the app already
// samples: no request of its own.
function ThisInstance({ uptime }: { uptime?: number }) {
  const { scrapes } = useMetrics();
  const latest = scrapes.at(-1);
  const previous = scrapes.at(-2);
  const unique = latest
    ? select(latest.samples, "unified_api_hosts_unique")[0]?.value
    : undefined;
  const perMinute =
    latest && previous
      ? rate(previous, latest, "unified_api_http_requests_total", notSelf) * 60
      : undefined;

  return (
    <Panel title="This instance">
      <dl className={styles.instanceFacts}>
        <Fact label="Hosts">
          {unique != null ? unique.toLocaleString() : "…"}
        </Fact>
        <Fact label="Requests">
          {perMinute != null ? `${compact(perMinute)} a minute` : "…"}
        </Fact>
        {uptime != null && (
          <Fact label="Running for">{formatSpan(uptime)}</Fact>
        )}
      </dl>
    </Panel>
  );
}
