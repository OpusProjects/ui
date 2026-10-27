import { formatCount } from "../lib/format";
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

// What a sync covered: "Full", "Host web01", "Group racks".
const coveredOf = (scope?: string | null) => {
  if (!scope || scope === "full") return "Full";
  const [kind, target] = scope.split(/:(.*)/s);
  return kind === "host"
    ? `Host ${target}`
    : kind === "group"
      ? `Group ${target}`
      : scope;
};

// The moment it started, in UTC, for the hover on its age.
const startedAt = (unixSeconds: number) =>
  `${new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`;

// A source's last syncs or a project's last pulls, newest first: what the
// health above them sums up, one row per run. The same table in both apps.
// An instance older than the history (no `history` in its answer) reads as
// none yet: callers pass `?? []`.
export function RunHistory({
  runs,
  kind,
  gitUrl,
}: {
  runs: RunLike[];
  kind: "sync" | "pull";
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
          <LiveAge since={run.started_at} />
        </span>
      ),
    },
    ...(kind === "sync"
      ? [
          {
            key: "covered",
            label: "Covered",
            render: (run: RunLike) => coveredOf(run.scope),
          },
          {
            key: "detail",
            label: "Brought",
            title: (run: RunLike) => run.error ?? undefined,
            render: (run: RunLike) =>
              failed(run) ? (
                <span className={detail.soft}>{run.error}</span>
              ) : (
                `${formatCount(run.hosts ?? 0)} hosts, ${formatCount(run.groups ?? 0)} groups`
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
      rowKey={(run) => `${run.started_at}-${run.trigger}-${run.duration_ms}`}
      empty={
        kind === "sync"
          ? "No syncs since this instance started."
          : "No pulls since this instance started."
      }
      noun={kind === "sync" ? "syncs" : "pulls"}
    />
  );
}
