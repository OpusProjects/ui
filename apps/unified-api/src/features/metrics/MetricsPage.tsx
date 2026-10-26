import { MetricsPage as Page } from "@opusprojects/unified-ui";
import {
  BarList,
  KpiRow,
  MetricsRow,
  Panel,
  ProcessPanels,
  RouteTable,
  StatTile,
  compact,
  milliseconds,
  useRequestsPerMinute,
  TrafficPanels,
  formatDuration,
  type Bar,
} from "@opusprojects/unified-ui";
import {
  histogramQuantile,
  select,
  sum,
  type Sample,
  type Scrape,
} from "@opusprojects/unified-client";
import { ICONS } from "../../sections";

export function MetricsPage() {
  return (
    <Page
      icon={ICONS.metrics}
      description="History starts when you open the app and keeps the last 30 minutes; for longer, use Prometheus and Grafana on /metrics."
    >
      {(scrapes) => <MetricsContent scrapes={scrapes} />}
    </Page>
  );
}

function MetricsContent({ scrapes }: { scrapes: Scrape[] }) {
  const latest = scrapes.at(-1)!;
  const samples = latest.samples;
  // Each hostname once across sources; older versions export only the
  // per-source counts, whose sum is then all there is.
  const uniqueSample = select(samples, "unified_api_hosts_unique")[0];
  const hosts = uniqueSample
    ? uniqueSample.value
    : sum(samples, "unified_api_source_hosts");
  // Requests and their speed over the last real minute, as the Overview
  // counts them: from the sample a minute before the newest.
  const requests = useRequestsPerMinute("unified_api");
  const minuteAgo = [...scrapes]
    .reverse()
    .find((s) => latest.at - s.at >= 58_000);
  const responseTime = minuteAgo
    ? histogramQuantile(
        0.95,
        samples,
        "unified_api_http_request_duration_seconds",
        (labels) => labels.path !== "/metrics",
        minuteAgo.samples,
      )
    : null;
  const slowest = slowestSource(samples);

  return (
    <>
      <KpiRow>
        <StatTile
          label="Hosts"
          value={hosts.toLocaleString()}
          hint={
            uniqueSample
              ? "Each hostname once across every source, ignoring case. A machine listed under two names, such as a VM name and its FQDN, counts twice. From unified_api_hosts_unique."
              : "Hosts per source, added up: a host listed by several sources counts once for each."
          }
        />
        <StatTile
          label="Requests"
          value={requests != null ? compact(requests) : "Counting…"}
          hint="Requests this instance answered in the last minute, reads of /metrics left out: the load its consumers put on it. Counting for the first minute after the page opens."
        />
        <StatTile
          label="Response time"
          value={
            responseTime
              ? `${responseTime.below ? "< " : ""}${milliseconds(responseTime.value)}`
              : minuteAgo
                ? "No requests"
                : "Counting…"
          }
          hint="95 of every 100 requests in the last minute were answered within this time; the rest took longer. How long a consumer waits for an answer."
        />
        <StatTile
          label="Sync time"
          value={slowest ? formatDuration(slowest.seconds) : "No syncs yet"}
          hint={`${slowest ? `${slowest.source}, the slowest source: its` : "The slowest source's"} average sync since this instance started. It sets how late new data reaches the consumers, and how long an on-demand refresh of that source makes a caller wait.`}
        />
      </KpiRow>

      <ProcessPanels
        scrapes={scrapes}
        memoryNote="Resident memory, the inventory cache included"
      />
      <TrafficPanels scrapes={scrapes} prefix="unified_api" />

      <MetricsRow>
        <Panel
          title="Sync time by source"
          hint="unified_api_sync_duration_seconds_sum divided by its _count, per source, since the process started. Hover or focus a bar for how many syncs it ran and how many failed."
          description="Average gather time per source since the process started. Top 10."
        >
          <BarList
            label="Average sync duration by source"
            bars={slowestSyncs(samples)}
            format={formatDuration}
            multicolor
            headings={["Source", "Sync time"]}
          />
        </Panel>
        <Panel
          title="API routes"
          hint="unified_api_http_requests_total and the request duration histogram, labelled by the matched route pattern. A p95 of “< 5 ms” means it falls in the lowest bucket, which is as precise as the histogram can be."
          description="The busiest 8, by matched route, never the raw URL."
        >
          <RouteTable samples={samples} prefix="unified_api" />
        </Panel>
      </MetricsRow>
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

// The source whose syncs take longest on average since the process
// started (the duration histogram counts from start), and that average.
// Since start rather than the sampled half hour: a source syncing every six
// hours would otherwise rarely show at all.
function slowestSource(samples: Sample[]) {
  const totals = select(samples, "unified_api_sync_duration_seconds_sum");
  let slowest: { source: string; seconds: number } | null = null;
  for (const total of totals) {
    const source = total.labels.source;
    const count = select(
      samples,
      "unified_api_sync_duration_seconds_count",
      (l) => l.source === source,
    )[0]?.value;
    if (!count) continue;
    const seconds = total.value / count;
    if (!slowest || seconds > slowest.seconds) slowest = { source, seconds };
  }
  return slowest;
}
