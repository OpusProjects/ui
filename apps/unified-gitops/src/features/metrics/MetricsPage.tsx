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

function MetricsContent({ scrapes }: { scrapes: Scrape[] }) {
  const samples = scrapes.at(-1)!.samples;
  const runs = sum(samples, RUNS);
  const failedRuns = sum(samples, RUNS, failed);
  const sends = sum(samples, SENDS);
  const failedSends = sum(samples, SENDS, failed);

  return (
    <>
      <KpiRow>
        <StatTile
          label="Runs"
          value={formatCount(runs)}
          hint={`API and script runs since this instance started, dry runs left out. From ${RUNS}.`}
        />
        <StatTile
          label="Failed runs"
          value={formatCount(failedRuns)}
          hint="Runs that failed: a request or an execution that did not work, or a run that could not start."
        />
        <StatTile
          label="Webhook sends"
          value={formatCount(sends)}
          hint={`Messages sent to receivers since this instance started, tests included; retries of one count once. From ${SENDS}.`}
        />
        <StatTile
          label="Failed sends"
          value={formatCount(failedSends)}
          hint="Sends the receiver never took, after every attempt."
        />
      </KpiRow>

      <ProcessPanels scrapes={scrapes} />
      <RunPanels scrapes={scrapes} />

      <MetricsRow>
        <Panel
          title="Runs by item"
          hint={`${RUNS} and ${DURATION}, by item, since this instance started: how often each API and script ran, how many runs failed, and how long one took. A p95 of “< 5 ms” falls in the histogram's lowest bucket.`}
          description="Runs and failures of each item, busiest first."
        >
          <RunTable samples={samples} />
        </Panel>
        <Panel
          title="Pull health by project"
          hint={`${PREFIX}_project_sync_consecutive_failures and _last_success_age_seconds: pulls that failed in a row, and how long since one worked. Failing projects first.`}
          description="Failed pulls in a row, and the last one that worked."
        >
          <PullTable samples={samples} />
        </Panel>
      </MetricsRow>
    </>
  );
}

const RUNS = `${PREFIX}_runs_total`;
const DURATION = `${PREFIX}_run_duration_seconds`;
const SENDS = `${PREFIX}_webhooks_total`;
const COLLECTING =
  "Collecting: the first point appears after two samples, ten seconds apart.";
type LabelFilter = (labels: Record<string, string>) => boolean;
const ofApis: LabelFilter = (l) => l.kind === "api";
const ofScripts: LabelFilter = (l) => l.kind === "script";
const failed: LabelFilter = (l) => l.outcome === "error";

// What this instance does: its API and script runs. Its own HTTP routes are
// mostly this app polling it; these runs are its work.
function RunPanels({ scrapes }: { scrapes: Scrape[] }) {
  const runs = scrapes.slice(1).map((scrape, i) => {
    const perMinute = (filter?: LabelFilter) =>
      rate(scrapes[i], scrape, RUNS, filter) * 60;
    const line = (value: number, one: string, many: string) =>
      `${compact(value)} ${value === 1 ? one : many}`;
    return {
      at: scrape.at,
      value: perMinute(),
      details: [
        line(perMinute(ofApis), "API run", "API runs"),
        line(perMinute(ofScripts), "script run", "script runs"),
        line(perMinute(failed), "failed", "failed"),
      ],
    };
  });
  // Mean time per run over the minute before each sample: time spent in
  // runs divided by runs made. A minute without runs is a gap, bridged.
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
    const apis = mean(ofApis);
    const scripts = mean(ofScripts);
    return {
      at: scrape.at,
      value: all === null ? null : all * 1000,
      details: [
        ...(apis === null ? [] : [`APIs ${milliseconds(apis)}`]),
        ...(scripts === null ? [] : [`scripts ${milliseconds(scripts)}`]),
      ],
    };
  });
  const latestRate = runs.at(-1)?.value ?? null;
  const latestDuration =
    [...durations].reverse().find((p) => p.value !== null)?.value ?? null;

  return (
    <MetricsRow>
      <Panel
        title="Runs (per minute)"
        hint={`The rate of ${RUNS} between samples, times 60: every run of an API or script item, dry runs left out. The tooltip splits it into API runs, script runs and failures.`}
        description={
          latestRate === null ? (
            "Runs of the API and script items."
          ) : (
            <>
              Runs of the API and script items:{" "}
              <strong>{compact(latestRate)} per minute</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={runs}
          series={3}
          label="Runs (per minute)"
          format={(v) => `${compact(v)} per minute`}
          empty={COLLECTING}
        />
      </Panel>
      <Panel
        title="Run time"
        hint={`At each sample, the growth of ${DURATION}_sum over the past minute divided by the growth of its _count: how long a run took, every request or execution in it together. The tooltip splits APIs from scripts. A minute without runs is bridged.`}
        description={
          latestDuration === null ? (
            "Mean time a run took over the last minute."
          ) : (
            <>
              Mean time a run took over the last minute:{" "}
              <strong>{milliseconds(latestDuration / 1000)}</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={durations}
          series={7}
          label="Mean run time"
          format={(v) => milliseconds(v / 1000)}
          gapLabel="No runs"
          connectGaps
          tickFormat={(v) => `${compact(v)} ms`}
          empty={COLLECTING}
        />
      </Panel>
    </MetricsRow>
  );
}

interface RunRow {
  item: string;
  kind: string;
  runs: number;
  failed: number;
  mean: number | null;
  p95: ReturnType<typeof histogramQuantile>;
}

// "< 5 ms" when every run fit the lowest bucket: the histogram cannot say
// more, and a precise-looking 4.8 ms would.
function p95Text(q: RunRow["p95"]) {
  if (q === null) return "–";
  const text = milliseconds(q.value).replace(".0 ms", " ms");
  return q.below ? `< ${text}` : text;
}

const KIND_WORDS: Record<string, string> = { api: "API", script: "Script" };

// The outgoing equivalent of an API routes table: per item, how often it
// ran, what failed, and how long it took.
function RunTable({ samples }: { samples: Sample[] }) {
  const items = new Map(
    select(samples, RUNS).map((s) => [
      `${s.labels.kind}/${s.labels.item}`,
      { kind: s.labels.kind, item: s.labels.item },
    ]),
  );
  const rows: RunRow[] = [...items.values()].map(({ kind, item }) => {
    const of: LabelFilter = (l) => l.kind === kind && l.item === item;
    const count = sum(samples, `${DURATION}_count`, of);
    return {
      item,
      kind,
      runs: sum(samples, RUNS, of),
      failed: sum(samples, RUNS, (l) => of(l) && failed(l)),
      mean: count > 0 ? sum(samples, `${DURATION}_sum`, of) / count : null,
      p95: histogramQuantile(0.95, samples, DURATION, of),
    };
  });
  rows.sort((a, b) => b.runs - a.runs || a.item.localeCompare(b.item));
  const columns: Column<RunRow>[] = [
    {
      key: "item",
      label: "Item",
      title: (r) => r.item,
      render: (r) => <code className={styles.mono}>{r.item}</code>,
    },
    {
      key: "kind",
      label: "Kind",
      render: (r) => KIND_WORDS[r.kind] ?? r.kind,
    },
    {
      key: "runs",
      label: "Runs",
      numeric: true,
      render: (r) => formatCount(r.runs),
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
        No runs yet: a commit that changes what an item watches starts one.
      </p>
    );
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.kind}/${r.item}`}
    />
  );
}

interface PullRow {
  project: string;
  failures: number;
  lastSuccess: number | null;
}

// Is anything quietly stuck? Projects whose pulls keep failing, and how
// long since one last worked: their changes reach nothing meanwhile.
function PullTable({ samples }: { samples: Sample[] }) {
  const FAILURES = `${PREFIX}_project_sync_consecutive_failures`;
  const AGE = `${PREFIX}_project_sync_last_success_age_seconds`;
  const value = (name: string, project: string) => {
    const found = select(samples, name).find(
      (s) => s.labels.project === project,
    );
    return found ? found.value : null;
  };
  const projects = new Set(
    select(samples, FAILURES).map((s) => s.labels.project),
  );
  const rows: PullRow[] = [...projects].map((project) => ({
    project,
    failures: value(FAILURES, project) ?? 0,
    lastSuccess: value(AGE, project),
  }));
  rows.sort(
    (a, b) => b.failures - a.failures || a.project.localeCompare(b.project),
  );
  const ago = (seconds: number | null) =>
    seconds === null ? "–" : `${formatSpan(seconds)} ago`;
  const columns: Column<PullRow>[] = [
    {
      key: "project",
      label: "Project",
      title: (r) => r.project,
      render: (r) => <code className={styles.mono}>{r.project}</code>,
    },
    {
      key: "state",
      label: "Pulls",
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
      key: "lastSuccess",
      label: "Last success",
      numeric: true,
      render: (r) => ago(r.lastSuccess),
    },
  ];
  if (rows.length === 0)
    return <p className={styles.soft}>No projects configured.</p>;
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.project} />;
}
