import { formatCount, MetricsPage as Page } from "@opusprojects/unified-ui";
import {
  DataTable,
  HealthPill,
  KpiRow,
  LineChart,
  MetricsRow,
  Panel,
  ProcessPanels,
  StatTile,
  compact,
  formatSpan,
  milliseconds,
  pageStyles as styles,
  type Column,
} from "@opusprojects/unified-ui";
import {
  histogramQuantile,
  rate,
  select,
  sum,
  type Sample,
  type Scrape,
} from "@opusprojects/unified-client";
import { ICONS } from "../../sections";

const PREFIX = "unified_gitops";

export function MetricsPage() {
  return (
    <Page
      icon={ICONS.metrics}
      description="The last 30 minutes, since you opened the app. For longer, scrape /metrics."
    >
      {(scrapes) => <MetricsContent scrapes={scrapes} />}
    </Page>
  );
}

// How many applications are in a status: the gauge is 1 on each
// application's current status and 0 on the others.
const inStatus = (samples: Sample[], status: string) =>
  sum(
    samples,
    `${PREFIX}_application_status`,
    (labels) => labels.status === status,
  );

function MetricsContent({ scrapes }: { scrapes: Scrape[] }) {
  const samples = scrapes.at(-1)!.samples;
  const applications = new Set(
    select(samples, `${PREFIX}_application_status`).map(
      (s) => s.labels.application,
    ),
  ).size;
  const pending = sum(samples, `${PREFIX}_application_pending_operations`);

  return (
    <>
      <KpiRow>
        <StatTile
          label="Applications"
          value={formatCount(applications)}
          hint={`Applications configured, from ${PREFIX}_application_status, one series per application and status.`}
        />
        <StatTile
          label="Synced"
          value={formatCount(inStatus(samples, "synced"))}
          hint="Applications whose last check found every declared object as declared."
        />
        <StatTile
          label="Failed"
          value={formatCount(inStatus(samples, "failed"))}
          hint="Applications whose last check or sync could not finish."
        />
        <StatTile
          label="Changes to apply"
          value={formatCount(pending)}
          hint={`Operations the last checks found and nobody has applied yet, all applications together. From ${PREFIX}_application_pending_operations.`}
        />
      </KpiRow>

      <ProcessPanels scrapes={scrapes} />
      <CallPanels scrapes={scrapes} />

      <MetricsRow>
        <Panel
          title="Requests by application"
          hint={`${CALLS} and ${DURATION}, by application, since this instance started: what it read and wrote on each application, what failed, and how long it took to answer. A p95 of “< 5 ms” falls in the histogram's lowest bucket.`}
          description="Reads, writes and failures on each application, busiest first."
        >
          <CallTable samples={samples} />
        </Panel>
        <Panel
          title="Check health by application"
          hint={`${PREFIX}_application_consecutive_failures and _last_success_age_seconds: checks or syncs that failed in a row, and how long since one finished. Failing applications first.`}
          description="Failed checks in a row, and the last one that worked."
        >
          <CheckTable samples={samples} />
        </Panel>
      </MetricsRow>
    </>
  );
}

const CALLS = `${PREFIX}_connector_calls_total`;
const DURATION = `${PREFIX}_connector_call_duration_seconds`;
const COLLECTING =
  "Collecting: the first point appears after two samples, ten seconds apart.";
type LabelFilter = (labels: Record<string, string>) => boolean;
const reads: LabelFilter = (l) => l.command === "list";
const writes: LabelFilter = (l) => l.command === "apply";
const failed: LabelFilter = (l) => l.outcome === "error";

// What this instance does to the systems, through their connectors. Its own
// HTTP routes are mostly this app polling it; these calls are its work.
function CallPanels({ scrapes }: { scrapes: Scrape[] }) {
  const calls = scrapes.slice(1).map((scrape, i) => {
    const perMinute = (filter?: LabelFilter) =>
      rate(scrapes[i], scrape, CALLS, filter) * 60;
    const line = (value: number, one: string, many: string) =>
      `${compact(value)} ${value === 1 ? one : many}`;
    return {
      at: scrape.at,
      value: perMinute(),
      details: [
        line(perMinute(reads), "read", "reads"),
        line(perMinute(writes), "write", "writes"),
        line(perMinute(failed), "failed", "failed"),
      ],
    };
  });
  // Mean time per call over the minute before each sample: time spent in
  // connectors divided by calls made. A minute without calls is a gap, bridged.
  const WINDOW_MS = 60_000;
  const durations = scrapes.slice(1).map((scrape, i) => {
    const from =
      scrapes.slice(0, i + 1).find((s) => scrape.at - s.at <= WINDOW_MS) ??
      scrapes[i];
    const growth = (name: string, filter?: LabelFilter) =>
      sum(scrape.samples, name, filter) - sum(from.samples, name, filter);
    const mean = (filter?: LabelFilter) => {
      const count = growth(`${DURATION}_count`, filter);
      return count > 0 ? growth(`${DURATION}_sum`, filter) / count : null;
    };
    const all = mean();
    const read = mean(reads);
    const write = mean(writes);
    return {
      at: scrape.at,
      value: all === null ? null : all * 1000,
      details: [
        ...(read === null ? [] : [`reads ${milliseconds(read)}`]),
        ...(write === null ? [] : [`writes ${milliseconds(write)}`]),
      ],
    };
  });
  const latestRate = calls.at(-1)?.value ?? null;
  const latestDuration =
    [...durations].reverse().find((p) => p.value !== null)?.value ?? null;

  return (
    <MetricsRow>
      <Panel
        title="Requests sent to applications (per minute)"
        hint={`The rate of ${CALLS} between samples, times 60: every request this instance made to an application through its connector. list reads one kind, apply writes one change, describe starts each run. The tooltip splits it into reads, writes and failures.`}
        description={
          latestRate === null ? (
            "Requests made to the applications, through their connectors."
          ) : (
            <>
              Requests made to the applications, through their connectors:{" "}
              <strong>{compact(latestRate)} per minute</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={calls}
          series={3}
          label="Requests sent to applications (per minute)"
          format={(v) => `${compact(v)} per minute`}
          empty={COLLECTING}
        />
      </Panel>
      <Panel
        title="Connector response time"
        hint={`At each sample, the growth of ${DURATION}_sum over the past minute divided by the growth of its _count: how long an application took to answer, script start-up included. The tooltip splits reads from writes. A minute without requests is bridged.`}
        description={
          latestDuration === null ? (
            "Mean time a request took over the last minute."
          ) : (
            <>
              Mean time a request took over the last minute:{" "}
              <strong>{milliseconds(latestDuration / 1000)}</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={durations}
          series={7}
          label="Mean connector response time"
          format={(v) => milliseconds(v / 1000)}
          gapLabel="No requests"
          connectGaps
          tickFormat={(v) => `${compact(v)} ms`}
          empty={COLLECTING}
        />
      </Panel>
    </MetricsRow>
  );
}

interface CallRow {
  application: string;
  reads: number;
  writes: number;
  failed: number;
  mean: number | null;
  p95: ReturnType<typeof histogramQuantile>;
}

// "< 5 ms" when every call fit the lowest bucket: the histogram cannot say
// more, and a precise-looking 4.8 ms would.
function p95Text(q: CallRow["p95"]) {
  if (q === null) return "–";
  const text = milliseconds(q.value).replace(".0 ms", " ms");
  return q.below ? `< ${text}` : text;
}

// The outgoing equivalent of an API routes table: per application, what was
// done to its system and how the system answered.
function CallTable({ samples }: { samples: Sample[] }) {
  const apps = new Set(select(samples, CALLS).map((s) => s.labels.application));
  const rows: CallRow[] = [...apps].map((application) => {
    const of: LabelFilter = (l) => l.application === application;
    const count = sum(samples, `${DURATION}_count`, of);
    return {
      application,
      reads: sum(samples, CALLS, (l) => of(l) && reads(l)),
      writes: sum(samples, CALLS, (l) => of(l) && writes(l)),
      failed: sum(samples, CALLS, (l) => of(l) && failed(l)),
      mean: count > 0 ? sum(samples, `${DURATION}_sum`, of) / count : null,
      p95: histogramQuantile(0.95, samples, DURATION, of),
    };
  });
  rows.sort(
    (a, b) =>
      b.reads + b.writes - (a.reads + a.writes) ||
      a.application.localeCompare(b.application),
  );
  const columns: Column<CallRow>[] = [
    {
      key: "application",
      label: "Application",
      title: (r) => r.application,
      render: (r) => <code className={styles.mono}>{r.application}</code>,
    },
    {
      key: "reads",
      label: "Reads",
      numeric: true,
      render: (r) => formatCount(r.reads),
    },
    {
      key: "writes",
      label: "Writes",
      numeric: true,
      render: (r) => formatCount(r.writes),
    },
    {
      key: "failed",
      label: "Failed",
      numeric: true,
      render: (r) => formatCount(r.failed),
    },
    {
      key: "mean",
      label: "Mean",
      numeric: true,
      render: (r) => milliseconds(r.mean),
    },
    { key: "p95", label: "p95", numeric: true, render: (r) => p95Text(r.p95) },
  ];
  if (rows.length === 0)
    return (
      <p className={styles.soft}>
        No requests yet: the first check of each application makes them.
      </p>
    );
  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.application} />
  );
}

interface CheckRow {
  application: string;
  failures: number;
  lastSuccess: number | null;
  lastCheck: number | null;
}

// Is anything quietly stuck? Applications whose checks keep failing, and how
// long since one last worked.
function CheckTable({ samples }: { samples: Sample[] }) {
  const value = (name: string, application: string) => {
    const found = select(samples, name).find(
      (s) => s.labels.application === application,
    );
    return found ? found.value : null;
  };
  const apps = new Set(
    select(samples, `${PREFIX}_application_status`).map(
      (s) => s.labels.application,
    ),
  );
  const rows: CheckRow[] = [...apps].map((application) => ({
    application,
    failures:
      value(`${PREFIX}_application_consecutive_failures`, application) ?? 0,
    lastSuccess: value(
      `${PREFIX}_application_last_success_age_seconds`,
      application,
    ),
    lastCheck: value(
      `${PREFIX}_application_last_check_age_seconds`,
      application,
    ),
  }));
  rows.sort(
    (a, b) =>
      b.failures - a.failures || a.application.localeCompare(b.application),
  );
  const ago = (seconds: number | null) =>
    seconds === null ? "–" : `${formatSpan(seconds)} ago`;
  const columns: Column<CheckRow>[] = [
    {
      key: "application",
      label: "Application",
      title: (r) => r.application,
      render: (r) => <code className={styles.mono}>{r.application}</code>,
    },
    {
      key: "state",
      label: "Runs",
      render: (r) =>
        r.failures > 0 ? (
          <HealthPill
            state="failing"
            labels={{ failing: `${formatCount(r.failures)} failed in a row` }}
          />
        ) : (
          <HealthPill state="fresh" labels={{ fresh: "Working" }} />
        ),
    },
    {
      key: "lastCheck",
      label: "Last check",
      numeric: true,
      render: (r) => ago(r.lastCheck),
    },
    {
      key: "lastSuccess",
      label: "Last success",
      numeric: true,
      render: (r) => ago(r.lastSuccess),
    },
  ];
  if (rows.length === 0)
    return <p className={styles.soft}>No applications configured.</p>;
  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.application} />
  );
}
