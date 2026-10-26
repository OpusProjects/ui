import type { ReactNode } from "react";
import {
  useMetrics,
  histogramQuantile,
  rate,
  select,
  sum,
  type Quantile,
  type Sample,
  type Scrape,
} from "@opusprojects/unified-client";
import { compact, DataTable, LineChart, type Column } from "./Charts";
import { Notice, PageHeader, Panel } from "./Page";
import { SkeletonSummary } from "./Skeleton";
import { formatBytes, formatSpan } from "../lib/format";
import common from "./Common.module.css";

// The parts of a unified-* Metrics page that every app has: the process
// (memory, CPU), the traffic it received, and its busiest routes. Each app
// names its own metrics with a prefix (`unified_api`, `unified_gitops`) and
// adds the panels about its own work around these.

// The page's own polling of /metrics would otherwise be most of the traffic
// it reports.
const notSelf = (labels: Record<string, string>) => labels.path !== "/metrics";

const COLLECTING =
  "Collecting: the first point appears after two samples, ten seconds apart.";

export function milliseconds(seconds: number | null) {
  if (seconds === null) return "–";
  const ms = seconds * 1000;
  return ms < 10
    ? `${ms.toFixed(1)}ms`
    : ms < 1000
      ? `${Math.round(ms)}ms`
      : `${(ms / 1000).toFixed(1)}s`;
}

// "< 5 ms" when every request in the window fit the lowest bucket: the
// histogram cannot say more than that, and a precise-looking 4.8 ms would.
function quantile(q: Quantile | null) {
  if (q === null) return "–";
  const text = milliseconds(q.value).replace(".0 ms", " ms");
  return q.below ? `< ${text}` : text;
}

function percent(value: number) {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

export function formatDuration(value: number) {
  // Under a second, in milliseconds: a quick sync is "30ms", not "0.0s".
  if (value < 1) return milliseconds(value);
  return value < 60
    ? `${value < 10 ? value.toFixed(1) : Math.round(value)}s`
    : formatSpan(value);
}

// Side by side panels sharing the taller one's height.
export function MetricsRow({ children }: { children: ReactNode }) {
  return <div className={common.metricsColumns}>{children}</div>;
}

// Memory and CPU of the process, from the standard process_* gauges.
export function ProcessPanels({
  scrapes,
  memoryNote = "Resident memory",
}: {
  scrapes: Scrape[];
  // What the memory holds, in the description ("Resident memory, the
  // inventory cache included").
  memoryNote?: string;
}) {
  const samples = scrapes.at(-1)?.samples ?? [];
  const memorySamples = select(samples, "process_resident_memory_bytes");
  const memory = memorySamples.length > 0 ? memorySamples[0].value : null;
  // Plotted in MB or GB, whichever the largest sample reads best in, so the
  // axis ticks are round numbers of one unit.
  const memoryBytes = scrapes.flatMap((scrape) =>
    select(scrape.samples, "process_resident_memory_bytes").map((s) => ({
      at: scrape.at,
      value: s.value,
    })),
  );
  const memoryUnit =
    Math.max(0, ...memoryBytes.map((p) => p.value)) >= 768 * 1024 * 1024
      ? "GB"
      : "MB";
  const unitBytes = memoryUnit === "GB" ? 1024 ** 3 : 1024 ** 2;
  const memorySeries = memoryBytes.map((p) => ({
    at: p.at,
    value: p.value / unitBytes,
  }));
  // CPU seconds only grow: CPU use is their rate, as a share of one core.
  const cpuSeries = scrapes.slice(1).flatMap((scrape, i) =>
    select(scrape.samples, "process_cpu_seconds_total").length === 0
      ? []
      : [
          {
            at: scrape.at,
            value: rate(scrapes[i], scrape, "process_cpu_seconds_total") * 100,
          },
        ],
  );
  const cpu = cpuSeries.at(-1)?.value ?? null;

  return (
    <MetricsRow>
      <Panel
        title="Memory"
        hint="process_resident_memory_bytes, read by the service from /proc at each scrape. This page samples it every 10 seconds while the app is open."
        description={
          memory === null ? (
            "This platform does not report it."
          ) : (
            <>
              {memoryNote}: <strong>{formatBytes(memory)}</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={memorySeries}
          series={1}
          label="Memory"
          format={(v) => formatBytes(v * unitBytes)}
          tickFormat={(v) => `${compact(v)} ${memoryUnit}`}
          empty={COLLECTING}
        />
      </Panel>
      <Panel
        title="CPU"
        hint="The rate of process_cpu_seconds_total between samples ten seconds apart. 100% is one full core; a process busy on several cores goes above it."
        description={
          select(samples, "process_cpu_seconds_total").length === 0 ? (
            "This platform does not report it."
          ) : cpu === null ? (
            "Share of one core in use."
          ) : (
            <>
              Share of one core in use: <strong>{percent(cpu)}</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={cpuSeries}
          series={2}
          label="CPU"
          format={(v) => `${percent(v)} of one core`}
          tickFormat={(v) => `${compact(v)}%`}
          empty={COLLECTING}
        />
      </Panel>
    </MetricsRow>
  );
}

// Requests per minute and mean response time, from `<prefix>_http_*`.
export function TrafficPanels({
  scrapes,
  prefix,
}: {
  scrapes: Scrape[];
  prefix: string;
}) {
  const series = scrapes.slice(1).map((scrape, i) => ({
    at: scrape.at,
    value:
      rate(scrapes[i], scrape, `${prefix}_http_requests_total`, notSelf) * 60,
  }));
  // Mean response time over the minute before each sample: time spent
  // answering divided by answers given. A minute with no calls is a gap,
  // bridged rather than drawn as zero.
  const WINDOW_MS = 60_000;
  const latencySeries = scrapes.slice(1).map((scrape, i) => {
    const from =
      scrapes.slice(0, i + 1).find((s) => scrape.at - s.at <= WINDOW_MS) ??
      scrapes[i];
    const growth = (name: string) =>
      sum(scrape.samples, name, notSelf) - sum(from.samples, name, notSelf);
    const count = growth(`${prefix}_http_request_duration_seconds_count`);
    const total = growth(`${prefix}_http_request_duration_seconds_sum`);
    return { at: scrape.at, value: count > 0 ? (total / count) * 1000 : null };
  });
  const latestRate = series.at(-1)?.value ?? null;
  const latestLatency =
    [...latencySeries].reverse().find((p) => p.value !== null)?.value ?? null;

  return (
    <MetricsRow>
      <Panel
        title="Incoming requests per minute"
        hint={`The rate of ${prefix}_http_requests_total between samples, times 60. Requests to /metrics are left out, since this page makes them itself.`}
        description={
          latestRate === null ? (
            "Calls received, excluding this page's own reads."
          ) : (
            <>
              Calls received, excluding this page's own reads:{" "}
              <strong>{compact(latestRate)} per minute</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={series}
          series={3}
          label="Incoming requests per minute"
          format={(v) => `${compact(v)} per minute`}
          empty={COLLECTING}
        />
      </Panel>
      <Panel
        title="Response time"
        hint={`At each sample, the growth of ${prefix}_http_request_duration_seconds_sum over the past minute divided by the growth of its _count. A mean rather than a percentile: nearly every call lands in the histogram's first bucket (under 5 ms), where a percentile cannot be read. A minute without calls is bridged.`}
        description={
          latestLatency === null ? (
            "Mean time to answer those calls over the last minute."
          ) : (
            <>
              Mean time to answer those calls over the last minute:{" "}
              <strong>{milliseconds(latestLatency / 1000)}</strong> now.
            </>
          )
        }
      >
        <LineChart
          points={latencySeries}
          series={7}
          label="Mean response time"
          format={(v) => milliseconds(v / 1000)}
          gapLabel="No calls"
          connectGaps
          tickFormat={(v) => `${compact(v)} ms`}
          empty={COLLECTING}
        />
      </Panel>
    </MetricsRow>
  );
}

interface Route {
  route: string;
  requests: number;
  errors: number;
  mean: number | null;
  p95: Quantile | null;
}

// The busiest routes by matched pattern, with 5xx count, mean and p95.
export function RouteTable({
  samples,
  prefix,
  limit = 8,
}: {
  samples: Sample[];
  prefix: string;
  limit?: number;
}) {
  const routes = new Map<string, Route>();
  for (const sample of select(
    samples,
    `${prefix}_http_requests_total`,
    notSelf,
  )) {
    const route = `${sample.labels.method} ${sample.labels.path}`;
    const row = routes.get(route) ?? {
      route,
      requests: 0,
      errors: 0,
      mean: null,
      p95: null,
    };
    row.requests += sample.value;
    if (Number(sample.labels.status) >= 500) row.errors += sample.value;
    routes.set(route, row);
  }
  for (const row of routes.values()) {
    const [method, path] = row.route.split(" ");
    const match = (l: Record<string, string>) =>
      l.method === method && l.path === path;
    const count = sum(
      samples,
      `${prefix}_http_request_duration_seconds_count`,
      match,
    );
    row.mean =
      count > 0
        ? sum(samples, `${prefix}_http_request_duration_seconds_sum`, match) /
          count
        : null;
    row.p95 = histogramQuantile(
      0.95,
      samples,
      `${prefix}_http_request_duration_seconds`,
      match,
    );
  }

  const columns: Column<Route>[] = [
    {
      key: "route",
      label: "Route",
      render: (r) => <code className={common.mono}>{r.route}</code>,
    },
    {
      key: "requests",
      label: "Requests",
      numeric: true,
      render: (r) => r.requests.toLocaleString(),
    },
    {
      key: "errors",
      label: "5xx",
      numeric: true,
      render: (r) => r.errors.toLocaleString(),
    },
    {
      key: "mean",
      label: "Mean",
      numeric: true,
      render: (r) => milliseconds(r.mean),
    },
    { key: "p95", label: "p95", numeric: true, render: (r) => quantile(r.p95) },
  ];
  const rows = [...routes.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.route} />;
}

// The Metrics page around an app's own panels: what it reads (the scrapes
// sampled since the app opened), and what it says while there are none yet
// or /metrics cannot be read.
export function MetricsPage({
  icon,
  description,
  children,
}: {
  icon: ReactNode;
  description: string;
  children: (scrapes: Scrape[]) => ReactNode;
}) {
  const { scrapes, error } = useMetrics();
  return (
    <>
      <PageHeader icon={icon} title="Metrics" description={description} />
      {error && scrapes.length === 0 && (
        <Notice title="Could not read /metrics">{error}</Notice>
      )}
      {scrapes.length === 0 && !error && <SkeletonSummary />}
      {scrapes.length > 0 && children(scrapes)}
    </>
  );
}
