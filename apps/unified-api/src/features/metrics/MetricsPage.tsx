import {
  BarList,
  DataTable,
  KpiRow,
  LineChart,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  StatTile,
  compact,
  formatBytes,
  formatSpan,
  type Bar,
  type Column,
} from "@opusprojects/unified-ui";
import {
  histogramQuantile,
  rate,
  select,
  sum,
  type Quantile,
  type Sample,
  type Scrape,
  useMetrics,
} from "@opusprojects/unified-client";
import { useEndpoints, useProjects } from "../../api/queries";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

// The page's own polling of /metrics would otherwise be most of the traffic
// it reports.
const notSelf = (labels: Record<string, string>) => labels.path !== "/metrics";

function milliseconds(seconds: number | null) {
  if (seconds === null) return "–";
  const ms = seconds * 1000;
  return ms < 10
    ? `${ms.toFixed(1)} ms`
    : ms < 1000
      ? `${Math.round(ms)} ms`
      : `${(ms / 1000).toFixed(2)} s`;
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

function seconds(value: number) {
  return value < 60
    ? `${value < 10 ? value.toFixed(1) : Math.round(value)} s`
    : formatSpan(value);
}

export function MetricsPage() {
  const { scrapes, error } = useMetrics();

  return (
    <>
      <PageHeader
        icon={ICONS.metrics}
        title="Metrics"
        description="History starts when you open the app and keeps the last 30 minutes; for longer, use Prometheus and Grafana on /metrics."
      />
      {error && scrapes.length === 0 && (
        <Notice title="Could not read /metrics">{error}</Notice>
      )}
      {scrapes.length === 0 && !error && <SkeletonSummary />}
      {scrapes.length > 0 && <MetricsContent scrapes={scrapes} />}
    </>
  );
}

function MetricsContent({ scrapes }: { scrapes: Scrape[] }) {
  const latest = scrapes.at(-1)!;
  const samples = latest.samples;

  // Requests per minute between consecutive scrapes: the chart and the tile.
  const series = scrapes.slice(1).map((scrape, i) => ({
    at: scrape.at,
    value:
      rate(scrapes[i], scrape, "unified_api_http_requests_total", notSelf) * 60,
  }));
  // Resident memory is a gauge; CPU seconds only grow, so CPU use is their
  // rate: seconds of CPU per second of wall clock, as a share of one core.
  const memorySamples = select(samples, "process_resident_memory_bytes");
  const memory = memorySamples.length > 0 ? memorySamples[0].value : null;
  // Plotted in MB or GB, whichever the largest sample reads best in, so the
  // axis ticks are round numbers of one unit (0.5 GB, not 512 MB or "1K MB").
  const memoryBytes = scrapes.flatMap((scrape) =>
    select(scrape.samples, "process_resident_memory_bytes").map((s) => ({
      at: scrape.at,
      value: s.value,
    })),
  );
  // GB from three quarters of one up: past that the top tick rounds to 1000
  // MB, which would print as "1K MB".
  const memoryUnit =
    Math.max(0, ...memoryBytes.map((p) => p.value)) >= 768 * 1024 * 1024
      ? "GB"
      : "MB";
  const unitBytes = memoryUnit === "GB" ? 1024 ** 3 : 1024 ** 2;
  const memorySeries = memoryBytes.map((p) => ({
    at: p.at,
    value: p.value / unitBytes,
  }));
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
  // Mean response time over the minute before each sample: time spent
  // answering divided by answers given. A rolling minute rather than one
  // ten-second interval, so a quiet API still has calls to average; a minute
  // with none at all is a gap, and the line is drawn across it (the mean
  // does not drop to zero because nobody called).
  const WINDOW_MS = 60_000;
  const latencySeries = scrapes.slice(1).map((scrape, i) => {
    const from =
      scrapes.slice(0, i + 1).find((s) => scrape.at - s.at <= WINDOW_MS) ??
      scrapes[i];
    const growth = (name: string) =>
      sum(scrape.samples, name, notSelf) - sum(from.samples, name, notSelf);
    const count = growth("unified_api_http_request_duration_seconds_count");
    const total = growth("unified_api_http_request_duration_seconds_sum");
    return { at: scrape.at, value: count > 0 ? (total / count) * 1000 : null };
  });
  // Configured, cached or not: unified_api_source_cached has one series per
  // configured source (views, being composites of them, are not counted).
  const configuredSources = select(samples, "unified_api_source_cached").length;
  // Endpoints appear in /metrics only once called, so the count comes from
  // the API, as on the Endpoints page.
  const endpoints = useEndpoints();
  // From the API too: a project shows in /metrics only after its first pull.
  // Admin-only route, so a restricted key sees "–".
  const projects = useProjects();
  const hostRecords = sum(samples, "unified_api_source_hosts");
  // Older versions do not export the unique count; the sum of entries is
  // then all there is, and the tile's label says which one is shown.
  const uniqueSample = select(samples, "unified_api_hosts_unique")[0];
  const uniqueHosts = uniqueSample ? uniqueSample.value : null;

  // The newest value of each line, repeated in its card's description and
  // refreshed with every sample.
  const latestRate = series.at(-1)?.value ?? null;
  const latestLatency =
    [...latencySeries].reverse().find((p) => p.value !== null)?.value ?? null;

  return (
    <>
      <KpiRow>
        <StatTile
          label="Sources"
          value={String(configuredSources)}
          hint="Sources configured on this instance, with or without data yet. Views are not counted. From unified_api_source_cached, one series per source."
        />
        <StatTile
          label="Endpoints"
          value={endpoints.data ? String(endpoints.data.length) : "–"}
          hint="Endpoints configured, from /api/v1/endpoints. They only appear in /metrics once they have been called."
        />
        <StatTile
          label="Projects"
          value={projects.data ? String(projects.data.length) : "–"}
          hint="Git projects configured, from /api/v1/projects. That route is for admin keys only; a restricted key sees a dash."
        />
        {/* Without the unique count (older versions), the sum is all there
            is, and the label says it counts entries rather than hosts. */}
        <StatTile
          label={uniqueHosts === null ? "Host entries" : "Unique hostnames"}
          value={(uniqueHosts ?? hostRecords).toLocaleString()}
          hint={
            uniqueHosts === null
              ? "Hosts per source, added up: a host listed by several sources counts once for each."
              : "Each hostname once across every source, ignoring case. A machine listed under two names, such as a VM name and its FQDN, counts twice. From unified_api_hosts_unique."
          }
        />
      </KpiRow>

      <div className={styles.metricsColumns}>
        <Panel
          title="Memory"
          hint="process_resident_memory_bytes, read by the service from /proc at each scrape. This page samples it every 10 seconds while the app is open."
          description={
            memory === null ? (
              "This platform does not report it."
            ) : (
              <>
                Resident memory, the inventory cache included:{" "}
                <strong>{formatBytes(memory)}</strong> now.
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
            empty="Collecting: the first point appears after two samples, ten seconds apart."
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
            empty="Collecting: the first point appears after two samples, ten seconds apart."
          />
        </Panel>
      </div>

      <div className={styles.metricsColumns}>
        <Panel
          title="Incoming requests per minute"
          hint="The rate of unified_api_http_requests_total between samples, times 60. Requests to /metrics are left out, since this page makes them itself."
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
            empty="Collecting: the first point appears after two samples, ten seconds apart."
          />
        </Panel>
        <Panel
          title="Response time"
          hint="At each sample, the growth of unified_api_http_request_duration_seconds_sum over the past minute divided by the growth of its _count. A mean rather than a percentile: nearly every call lands in the histogram's first bucket (under 5 ms), where a percentile cannot be read. A minute without calls is bridged."
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
            empty="Collecting: the first point appears after two samples, ten seconds apart."
          />
        </Panel>
      </div>

      <div className={styles.metricsColumns}>
        <Panel
          title="Sync time by source"
          hint="unified_api_sync_duration_seconds_sum divided by its _count, per source, since the process started. Hover or focus a bar for how many syncs it ran and how many failed."
          description="Average gather time per source since the process started. Top 10."
        >
          <BarList
            label="Average sync duration by source"
            bars={slowestSyncs(samples)}
            format={seconds}
            multicolor
            headings={["Source", "Sync time"]}
          />
        </Panel>
        <Panel
          title="API routes"
          hint="unified_api_http_requests_total and the request duration histogram, labelled by the matched route pattern. A p95 of “< 5 ms” means it falls in the lowest bucket, which is as precise as the histogram can be."
          description="The busiest 8, by matched route, never the raw URL."
        >
          <RouteTable samples={samples} />
        </Panel>
      </div>
    </>
  );
}

function slowestSyncs(samples: Sample[]): Bar[] {
  return (
    select(samples, "unified_api_sync_duration_seconds_sum")
      .map((total) => {
        const source = total.labels.source;
        const count = sum(
          samples,
          "unified_api_sync_duration_seconds_count",
          (l) => l.source === source,
        );
        const failed = sum(
          samples,
          "unified_api_sync_total",
          (l) => l.source === source && l.result !== "success",
        );
        return {
          key: source,
          label: source,
          value: count > 0 ? total.value / count : 0,
          details: [
            `${count} ${count === 1 ? "sync" : "syncs"}`,
            failed > 0 ? `${failed} failed` : "None failed",
          ],
        };
      })
      .filter((bar) => bar.value > 0)
      .sort((a, b) => b.value - a.value)
      // Ten: one per hue of the series palette, every bar its own colour.
      .slice(0, 10)
  );
}

interface Route {
  route: string;
  requests: number;
  errors: number;
  mean: number | null;
  p95: Quantile | null;
}

function RouteTable({ samples }: { samples: Sample[] }) {
  const routes = new Map<string, Route>();
  for (const sample of select(
    samples,
    "unified_api_http_requests_total",
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
      "unified_api_http_request_duration_seconds_count",
      match,
    );
    row.mean =
      count > 0
        ? sum(samples, "unified_api_http_request_duration_seconds_sum", match) /
          count
        : null;
    row.p95 = histogramQuantile(
      0.95,
      samples,
      "unified_api_http_request_duration_seconds",
      match,
    );
  }

  const columns: Column<Route>[] = [
    {
      key: "route",
      label: "Route",
      render: (r) => <code className={styles.mono}>{r.route}</code>,
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
  // The busiest eight, so the table sits level with the sync chart beside it.
  const rows = [...routes.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 8);
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.route} />;
}
