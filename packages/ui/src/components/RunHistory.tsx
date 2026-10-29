import { countOf, formatCount } from "../lib/format";
import { HealthPill } from "./Health";
import { ListSoft, ListTable, type ListColumn } from "./ListTable";
import { LiveAge } from "./LiveAge";
import { formatDuration } from "./Metrics";
import { Commit } from "./Projects";
import detail from "./Detail.module.css";

// One run as both apps report it (RunInfo): a source's sync or a project's
// pull. The fields a kind does not have are absent.
export interface RunLike {
  started_at: number;
  // Seconds since it started, as the server measured them when it answered:
  // absent from an older instance, which leaves the browser's clock.
  age_seconds?: number | null;
  duration_ms: number;
  trigger: string;
  by?: string | null;
  scope?: string | null;
  error?: string | null;
  hosts?: number | null;
  groups?: number | null;
  revision_before?: string | null;
  revision?: string | null;
}

// What started a run, in words: "Manual by key-ops" when the API says who.
const TRIGGERS: Record<string, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  refresh: "Refresh",
  startup: "Startup",
  check: "Before a check",
};
const triggerOf = (run: RunLike) => {
  const word = TRIGGERS[run.trigger] ?? run.trigger;
  return run.by ? `${word} by ${run.by}` : word;
};

// What a sync covered: "Full", "Host web01", "Hosts a, b", "Group racks";
// past a few hosts, "Hosts a, b +38 more", every one of them on hover.
const COVERED_HOSTS = 2;
const hostsOf = (scope?: string | null) => {
  const [kind, target = ""] = (scope ?? "").split(/:(.*)/s);
  return kind === "host" ? target.split(",") : null;
};
const coveredOf = (scope?: string | null) => {
  if (!scope || scope === "full") return "Full";
  const hosts = hostsOf(scope);
  if (hosts) {
    const word = hosts.length === 1 ? "Host" : "Hosts";
    const more = hosts.length - COVERED_HOSTS;
    return more > 1
      ? `${word} ${hosts.slice(0, COVERED_HOSTS).join(", ")} +${formatCount(more)} more`
      : `${word} ${hosts.join(", ")}`;
  }
  const [kind, target = ""] = scope.split(/:(.*)/s);
  return kind === "group" ? `Group ${target}` : scope;
};
// The hover on what it covered: the whole list, when the cell shortened it
// or may be cut short.
const coveredTitle = (scope?: string | null) => {
  if (!scope || scope === "full") return undefined;
  const hosts = hostsOf(scope);
  return hosts
    ? `${countOf(hosts.length, "host")}: ${hosts.join(", ")}`
    : coveredOf(scope);
};

// What a sync that worked brought: "1,234 hosts, 12 groups".
const broughtOf = (run: RunLike) =>
  `${countOf(run.hosts ?? 0, "host")}, ${countOf(run.groups ?? 0, "group")}`;

// The moment it started, in UTC, for the hover on its age.
const startedAt = (unixSeconds: number) =>
  `${new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`;

// A source's last syncs or a project's last pulls, newest first: what the
// health above them sums up, one row per run. The same table in both apps.
// An instance older than the history has no `history` in its answer: the
// callers show no panel at all then, rather than one saying "no syncs"
// beside a recent last success.
export function RunHistory({
  runs,
  kind,
  gitUrl,
  at,
}: {
  runs: RunLike[];
  kind: "sync" | "pull";
  // When the answer holding the runs arrived (its query's dataUpdatedAt):
  // each run's age_seconds is counted on from it, as the facts above are.
  at?: number;
  // A pull's commits link to their page when the repository has one.
  gitUrl?: string;
}) {
  const failed = (run: RunLike) => run.error != null;
  const columns: ListColumn<RunLike>[] = [
    { key: "type", label: "Type", render: triggerOf },
    {
      key: "when",
      label: "When",
      render: (run) => (
        <span title={startedAt(run.started_at)}>
          {run.age_seconds != null ? (
            <LiveAge seconds={run.age_seconds} at={at} />
          ) : (
            <LiveAge since={run.started_at} />
          )}
        </span>
      ),
    },
    ...(kind === "sync"
      ? [
          {
            key: "covered",
            label: "Covered",
            title: (run: RunLike) => coveredTitle(run.scope),
            render: (run: RunLike) => coveredOf(run.scope),
          },
          {
            key: "detail",
            label: "Brought",
            title: (run: RunLike) => run.error ?? broughtOf(run),
            render: (run: RunLike) =>
              failed(run) ? (
                <span className={detail.soft}>{run.error}</span>
              ) : (
                broughtOf(run)
              ),
          },
        ]
      : [
          {
            key: "commit",
            label: "Commit",
            title: (run: RunLike) => run.error ?? undefined,
            render: (run: RunLike) =>
              failed(run) ? (
                <span className={detail.soft}>{run.error}</span>
              ) : run.revision_before &&
                run.revision &&
                run.revision_before !== run.revision ? (
                <>
                  <Commit
                    gitUrl={gitUrl ?? ""}
                    revision={run.revision_before}
                  />
                  {" → "}
                  <Commit gitUrl={gitUrl ?? ""} revision={run.revision} />
                </>
              ) : run.revision ? (
                <>
                  <Commit gitUrl={gitUrl ?? ""} revision={run.revision} />{" "}
                  <ListSoft>
                    {run.revision_before ? "no change" : "cloned"}
                  </ListSoft>
                </>
              ) : (
                <ListSoft>–</ListSoft>
              ),
          },
        ]),
    {
      key: "took",
      label: "Took",
      numeric: true,
      render: (run) => formatDuration(run.duration_ms / 1000),
    },
    {
      key: "result",
      label: "Result",
      role: "state",
      render: (run) =>
        failed(run) ? (
          <HealthPill state="failing" labels={{ failing: "Failed" }} />
        ) : (
          <HealthPill
            state="fresh"
            labels={{ fresh: kind === "sync" ? "Synced" : "Pulled" }}
          />
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={runs}
      // By place: two runs can share their second, trigger and duration
      // (quick refreshes), and the list only ever grows at the top.
      rowKey={(run) => String(runs.indexOf(run))}
      empty={
        kind === "sync"
          ? "No syncs since this instance started."
          : "No pulls since this instance started."
      }
      noun={kind === "sync" ? "syncs" : "pulls"}
    />
  );
}
