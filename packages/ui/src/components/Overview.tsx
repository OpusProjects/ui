import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  HEALTH_ORDER,
  rate,
  useMetrics,
  type HealthState,
} from "@opusprojects/unified-client";
import { compact, LineChart, type Series } from "./Charts";
import { lift } from "./Lift";
import { useNow } from "./LiveAge";
import { Panel } from "./Page";
import { formatCount, formatSpan } from "../lib/format";
import styles from "./Overview.module.css";
import skeleton from "./Skeleton.module.css";

// The pieces of a unified-* front page: one card per area with how many of
// its items are healthy, the list of what needs a person, and the traffic
// this instance received. Each app decides what its areas and issues are;
// these decide how they look, so every app's Overview reads alike.

export type StateCounts = Record<HealthState, number>;
type Labels = Partial<Record<HealthState, string>>;
type LinkRender = (
  to: string,
  content: ReactNode,
  className: string,
) => ReactNode;

export function countStates<T>(
  items: T[],
  stateOf: (item: T) => HealthState,
): StateCounts {
  const counts: StateCounts = { fresh: 0, stale: 0, failing: 0, pending: 0 };
  for (const item of items) counts[stateOf(item)] += 1;
  return counts;
}

// `loading`: some card is still a placeholder, said once for the row.
export function AreaGrid({
  children,
  loading,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className={styles.areas} aria-busy={loading || undefined}>
      {children}
    </div>
  );
}

// One area: how many of its items are healthy, a bar of all of their
// states, and the whole card a way into its page.
export function AreaCard({
  to,
  link,
  icon,
  title,
  counts,
  labels,
  empty = "None",
  goodWord,
}: {
  to: string;
  link: LinkRender;
  icon: ReactNode;
  title: string;
  counts: StateCounts;
  labels: Labels;
  empty?: string;
  // What the healthy ones are, said of several ("Working", not a pill's
  // "Resolves"). Defaults to the area's own healthy label. Capitalized, as
  // every status word in both apps is.
  goodWord?: string;
}) {
  const total = HEALTH_ORDER.reduce((sum, state) => sum + counts[state], 0);
  const word = goodWord ?? labels.fresh ?? "Healthy";
  const good = word.charAt(0).toUpperCase() + word.slice(1);
  return link(
    to,
    <>
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
            {formatCount(counts.fresh)}
            <span className={styles.areaOf}> of {formatCount(total)}</span>
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
    </>,
    lift(styles.area),
  );
}

// An area card while its list loads: the same box, with bones where its
// title, count, label and bar will be, so the row keeps its five places
// instead of filling in card by card and reflowing as each one lands.
export function AreaCardSkeleton() {
  // A bone the height of the line it stands in for, so the card is as tall
  // as the one replacing it. The text inside is invisible, only sizing it.
  const bone = (width: number | string, className?: string) => (
    <span className={className}>
      <span
        className={skeleton.bone}
        style={{ display: "inline-block", width, color: "transparent" }}
      >
        &nbsp;
      </span>
    </span>
  );
  return (
    <div className={styles.area} aria-hidden>
      <span className={styles.areaTitle}>
        <span
          className={`${styles.areaIcon} ${skeleton.bone}`}
          style={{ borderRadius: 4 }}
        />
        {bone(88)}
      </span>
      {bone("45%", styles.areaCount)}
      {bone(64, styles.areaLabel)}
      <span className={styles.bar}>
        <span className={skeleton.bone} style={{ flexGrow: 1 }} />
      </span>
    </div>
  );
}

// One thing that needs a person: what, why, and where to go about it.
// Severity orders the list: 0 is broken (red), anything higher is late or
// waiting (amber).
export interface Issue {
  key: string;
  severity: number;
  text: ReactNode;
  to: string;
}

// What needs attention beside the numbers about this instance.
export function OverviewColumns({ children }: { children: ReactNode }) {
  return <div className={styles.columns}>{children}</div>;
}

export function NeedsAttention({
  hint,
  issues,
  link,
  failed,
  loading,
}: {
  hint: string;
  issues: Issue[];
  link: LinkRender;
  // The lists every caller may read could not be loaded: an empty list of
  // problems would then read as "all is well", so say it was not checked.
  failed?: string;
  loading?: boolean;
}) {
  const sorted = [...issues].sort((a, b) => a.severity - b.severity);
  return (
    <Panel title="Needs attention" hint={hint}>
      {failed ? (
        <p className={styles.allClear}>Not checked: {failed}</p>
      ) : loading ? (
        <p className={styles.allClear}>Checking…</p>
      ) : sorted.length === 0 ? (
        <p className={styles.allClear}>
          Nothing needs attention: everything is healthy.
        </p>
      ) : (
        <ul className={styles.issues}>
          {sorted.map((issue) => (
            <li key={issue.key} data-severity={issue.severity}>
              {link(
                issue.to,
                <>
                  {issue.text}
                  <ExternalLink aria-hidden />
                </>,
                "",
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Calls to the app's own /metrics are the app polling itself, not traffic.
const notSelf = (labels: Record<string, string>) => labels.path !== "/metrics";

type LabelFilter = (labels: Record<string, string>) => boolean;

// The samples are ten seconds apart; one taken this much before the newest
// counts as "a minute ago" (a sample can be a little late).
const MINUTE_MS = 58_000;

// One counter's real count over the last minute: its increase from the
// sample a minute before the newest to the newest, not a ten-second rate
// times six, which jumps with every burst. Undefined for the first minute
// after the page opens, until a sample that old exists.
export function useRatePerMinute(
  metric: string,
  filter?: LabelFilter,
): number | undefined {
  const { scrapes } = useMetrics();
  const latest = scrapes.at(-1);
  const minuteAgo = latest
    ? [...scrapes].reverse().find((s) => latest.at - s.at >= MINUTE_MS)
    : undefined;
  return latest && minuteAgo
    ? Math.round(rate(minuteAgo, latest, metric, filter) * 60)
    : undefined;
}

// What a per-minute fact says: the count, or that the first minute is still
// being counted.
export function perMinuteText(count: number | undefined) {
  return count != null ? `${compact(count)} in the last minute` : "Counting…";
}

// Requests in the last minute, from `<prefix>_http_requests_total`.
export function useRequestsPerMinute(prefix: string): number | undefined {
  return useRatePerMinute(`${prefix}_http_requests_total`, notSelf);
}

// A few numbers about this instance, in one narrow column.
export function InstancePanel({ children }: { children: ReactNode }) {
  return (
    <Panel title="This instance">
      <dl className={styles.instanceFacts}>{children}</dl>
    </Panel>
  );
}

// A part of a rate shown in the tooltip: "2 writes" out of "5 per minute".
export interface RatePart {
  // Singular and plural, as the tooltip line reads: ["read", "reads"].
  name: [string, string];
  filter: LabelFilter;
  // A part of the others rather than beside them ("of which 2 failed"): the
  // parts that are not subsets add up to the total.
  subset?: boolean;
}

// The last half hour of one counter, per minute, as the Metrics page draws
// it: enough to tell normal traffic from traffic that stopped. `parts` split
// each point in the tooltip.
export function RatePanel({
  title,
  hint,
  metric,
  filter,
  parts = [],
  series = 3,
}: {
  title: string;
  hint: string;
  metric: string;
  filter?: LabelFilter;
  parts?: RatePart[];
  // Which of the theme's series colours it draws in, so two rate charts on
  // one page read as two things.
  series?: Series;
}) {
  const { scrapes } = useMetrics();
  // Each point counts the minute up to it, as "This instance" does: the
  // counter's increase from the sample a minute earlier. A ten-second step
  // times six turned one burst into a spike six times its size. The first
  // point comes a minute after the page opens.
  const points = scrapes.flatMap((scrape, i) => {
    const start = scrapes
      .slice(0, i)
      .reverse()
      .find((s) => scrape.at - s.at >= MINUTE_MS);
    if (!start) return [];
    const inMinute = (f?: LabelFilter) =>
      Math.round(
        rate(
          start,
          scrape,
          metric,
          (labels) => (!filter || filter(labels)) && (!f || f(labels)),
        ) * 60,
      );
    return [
      {
        at: scrape.at,
        value: inMinute(),
        details: parts.map((part) => {
          const value = inMinute(part.filter);
          const words = `${compact(value)} ${value === 1 ? part.name[0] : part.name[1]}`;
          return part.subset ? `of which ${words}` : words;
        }),
      },
    ];
  });
  return (
    <Panel title={title} hint={hint} className={styles.requestsCard}>
      <LineChart
        points={points}
        series={series}
        label={title}
        format={(v) => `${compact(v)} in the minute`}
        empty="Collecting: the first point appears a minute after the page opens."
      />
    </Panel>
  );
}

// The calls this instance received.
export function RequestsPanel({ prefix }: { prefix: string }) {
  return (
    <RatePanel
      title="Incoming requests (per minute)"
      hint="Calls this instance received, from its own /metrics sampled every ten seconds while the app is open; reads of /metrics itself are left out. The app keeps the last half hour."
      metric={`${prefix}_http_requests_total`}
      filter={notSelf}
    />
  );
}

// A duration that keeps counting: `seconds` as the server measured it at
// `at` (ms since the epoch, when it was fetched), plus the time since, each
// second. "Running for 43d 23h 4m 3s", and 4s the next second.
export function LiveSpan({
  seconds,
  at,
  ago = false,
}: {
  seconds: number;
  at: number;
  // An age rather than a duration: "2m 13s ago".
  ago?: boolean;
}) {
  const now = useNow();
  const span = formatSpan(seconds + Math.max(0, now - at) / 1000);
  return <>{ago ? `${span} ago` : span}</>;
}
