import { Link, useParams } from "react-router";
import { ArrowUpFromLine, SearchCheck } from "lucide-react";
import {
  ChipList,
  ListTable,
  useConfirm,
  EmptyState,
  Fact,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  RunButton,
  SkeletonSummary,
  formatAge,
  formatSpan,
  pageStyles as styles,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useApplication, useAuth } from "../../api/queries";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import {
  RollbackMessage,
  RunChangesButton,
  ViewChangesButton,
  rollbackPreview,
} from "./RollbackPreview";
import { ICONS } from "../../sections";
import {
  appLabels,
  systemRevision,
  afterRun,
  appState,
  refreshApplication,
  rollbackApplication,
  runOutcome,
  shortRevision,
  syncApplication,
} from "./model";

type Run = Schemas["RunRecord"];

// What each fact means, behind its label, starting with its key in
// the application's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Project:
    "project. The git project whose checkout holds this application's desired state. It is pulled before every check.",
  Path: "path. The folder inside the checkout: every .yaml file under it, recursively, is desired state.",
  Connector:
    "connector. The script that lists and changes this system's objects.",
  Credentials:
    "credentials. Handed to the connector as CREDENTIAL_<FIELD> on every run, never shown.",
  Runs: "sync_interval_seconds. How often desired state is compared with the system. That comparison is what notices drift: a change made by hand shows up as out of sync.",
  "Auto-sync":
    "auto_sync. On: a check that finds differences applies them. Off: it only reports them, and waits for Push.",
  Prune:
    "prune. On: objects on the system that git does not declare are deleted. Off: they are listed as unmanaged and left alone.",
  Commit: "The commit of the checkout the last run read.",
  "Last check": "When desired state was last compared with the system.",
};

// A run's result as a status pill, dot included, like every other status.
const RESULT = {
  succeeded: { state: "fresh", label: "Succeeded" },
  out_of_sync: { state: "stale", label: "Out of sync" },
  partial: { state: "failing", label: "Partial" },
  failed: { state: "failing", label: "Failed" },
} as const;

const when = (unixSeconds: number) =>
  formatAge(Math.max(0, Date.now() / 1000 - unixSeconds));

export function ApplicationDetailPage() {
  const { id = "" } = useParams();
  const application = useApplication(id);
  const app = application.data;
  // Connectors, projects and credentials have admin-only pages: a restricted
  // key sees their names, not links it would be refused at.
  const admin = useAuth().data?.me.role !== "restricted";

  return (
    <>
      <PageHeader
        icon={ICONS.applications}
        title={
          <DetailTitle section="Applications" to="/applications">
            {app?.name ?? id}
          </DetailTitle>
        }
        // The application's own description, the way unified-api shows a
        // source's; the generic line only when it has none.
        description={
          app?.description ??
          "How this application stands against git, and what past runs did."
        }
        // On the header's right, as unified-api's detail pages place their
        // actions; keyed by the application so an outcome does not carry over.
        actions={
          app && (
            <div key={id} className={styles.list}>
              <RunButton
                label="Check"
                busyLabel="Checking…"
                icon={<SearchCheck />}
                invalidate={afterRun(id)}
                run={async () => runOutcome(await refreshApplication(id))}
              />
              <RunButton
                label="Push"
                busyLabel="Pushing…"
                icon={<ArrowUpFromLine />}
                outcomeSide="end"
                invalidate={afterRun(id)}
                run={async () => runOutcome(await syncApplication(id))}
              />
            </div>
          )
        }
      />
      {application.isPending && <SkeletonSummary />}
      {application.isError && (
        <Notice title="Could not load the application">
          {application.error.message}
        </Notice>
      )}
      {app && (
        <>
          <Panel
            title="Overview"
            hint="Where this application's desired state comes from, the system it is applied to, and how it is kept in sync. Hover a label for what it means."
            // Top right, where unified-api's detail pages show it.
            aside={<HealthPill state={appState(app)} labels={appLabels(app)} />}
          >
            <dl className={common.facts}>
              {/* Read across, row by row: where desired state comes from,
                  where it goes, then when and how it is enforced. */}
              <Fact label="Project" hint={HINTS["Project"]}>
                {admin ? (
                  <Link
                    className={common.link}
                    to={`/projects/${encodeURIComponent(app.project)}`}
                  >
                    {app.project}
                  </Link>
                ) : (
                  <code className={common.mono}>{app.project}</code>
                )}
              </Fact>
              <Fact label="Path" hint={HINTS["Path"]}>
                <code className={common.mono}>{app.path}</code>
              </Fact>
              <Fact label="Commit" hint={HINTS["Commit"]}>
                <span>
                  <code
                    className={common.mono}
                    title={systemRevision(app) ?? undefined}
                  >
                    {shortRevision(systemRevision(app))}
                  </code>
                </span>
              </Fact>
              <Fact label="Connector" hint={HINTS["Connector"]}>
                {admin ? (
                  <Link
                    className={common.link}
                    to={`/connectors/${encodeURIComponent(app.connector)}`}
                  >
                    {app.connector}
                  </Link>
                ) : (
                  <code className={common.mono}>{app.connector}</code>
                )}
              </Fact>
              <Fact label="Credentials" hint={HINTS["Credentials"]}>
                {app.credentials.length === 0 ? (
                  "None"
                ) : (
                  <ChipList
                    items={app.credentials}
                    limit={3}
                    linkTo={
                      admin
                        ? (credential, className) => (
                            <Link
                              className={className}
                              to={`/credentials/${encodeURIComponent(credential)}`}
                            >
                              {credential}
                            </Link>
                          )
                        : undefined
                    }
                  />
                )}
              </Fact>
              <Fact label="Last check" hint={HINTS["Last check"]}>
                {formatAge(app.last_checked_age_seconds)}
              </Fact>
              <Fact label="Runs" hint={HINTS["Runs"]}>
                Every {formatSpan(app.sync_interval_seconds)}
              </Fact>
              <Fact label="Auto-sync" hint={HINTS["Auto-sync"]}>
                {app.auto_sync ? "On" : "Off"}
              </Fact>
              <Fact label="Prune" hint={HINTS["Prune"]}>
                {app.prune ? "On" : "Off"}
              </Fact>
            </dl>
          </Panel>

          {app.plan && app.plan.errors.length > 0 && (
            <Notice title="The last check could not finish">
              {app.plan.errors.join(" ")}
            </Notice>
          )}
          {!app.plan && app.sync_health?.last_error && (
            <Notice title="The last check failed">
              {app.sync_health.last_error}
            </Notice>
          )}

          {app.rollback && (
            <Notice
              tone="stale"
              title={`Rolled back to ${shortRevision(app.rollback.revision)}, ${formatAge(app.rollback.age_seconds)}`}
            >
              Automatic syncs are paused until the next manual Push, which
              applies the latest commit again.
            </Notice>
          )}

          <Panel
            title="History"
            hint="The last runs of this application, newest first, kept in memory (up to 50; a restart starts over). The commit is what to revert if a change went wrong."
          >
            {app.history.length === 0 ? (
              <EmptyState title="No runs yet" />
            ) : (
              <History
                runs={app.history}
                application={app.name}
                current={systemRevision(app)}
              />
            )}
          </Panel>
        </>
      )}
    </>
  );
}

// Why a past run cannot be rolled back to, or null when it can: it must have
// applied, and to a commit other than the one the application is on now.
function rollbackBlocked(run: Run, current: string | null): string | null {
  if (run.mode !== "apply") return "A check changed nothing to go back to.";
  if (run.result !== "succeeded" && run.result !== "partial")
    return "This sync did not apply.";
  if (run.revision == null) return "The commit of this run is not known.";
  if (run.revision === current) return "This is the current commit.";
  return null;
}

// "Check (scheduled)", "Push", "Rollback": what started a run, and what it did.
const runType = (r: Run) =>
  r.trigger === "rollback"
    ? "Rollback"
    : `${r.mode === "apply" ? "Push" : "Check"}${r.trigger === "schedule" ? " (scheduled)" : ""}`;

function History({
  runs,
  application,
  current,
}: {
  runs: Run[];
  application: string;
  current: string | null;
}) {
  const confirm = useConfirm();
  // The shared list layout: facts in even steps. The result reads with when
  // the run happened; the actions on it (view, roll back) end the row.
  const columns: ListColumn<Run>[] = [
    {
      key: "what",
      label: "Type",
      render: runType,
    },
    {
      key: "when",
      label: "When",
      render: (r) => when(r.started_at),
    },
    {
      key: "result",
      label: "Result",
      render: (r) => {
        const { state, label } = RESULT[r.result];
        return <HealthPill state={state} labels={{ [state]: label }} />;
      },
    },
    {
      key: "commit",
      label: "Commit",
      render: (r) => (
        <code className={styles.mono} title={r.revision ?? undefined}>
          {shortRevision(r.revision)}
        </code>
      ),
    },
    {
      key: "changes",
      label: "Changes",
      numeric: true,
      render: (r) =>
        r.mode === "apply" && r.applied.length > 0
          ? `${r.applied.filter((a) => a.ok).length} of ${r.applied.length} applied`
          : r.planned === 0
            ? "None"
            : `${r.planned} to apply`,
    },
    {
      key: "view",
      label: "View",
      render: (r) => (
        <RunChangesButton
          run={r}
          application={application}
          latest={r.id === runs[0]?.id}
          title={`Changes in the ${runType(r).toLowerCase()}, ${when(r.started_at)}, commit ${shortRevision(r.revision)}`}
        />
      ),
    },
    {
      key: "rollback",
      label: "Rollback",
      role: "state",
      render: (r) => (
        <RunButton
          disabled={rollbackBlocked(r, current) !== null}
          reason={rollbackBlocked(r, current) ?? undefined}
          label="Rollback"
          busyLabel="Rolling back…"
          invalidate={afterRun(application)}
          // A write to a production system that git does not ask for:
          // worth one explicit yes, in the app's own dialog.
          ask={async () => {
            const revision = r.revision!;
            const preview = rollbackPreview(application, revision);
            return confirm({
              title: `Roll ${application} back to ${shortRevision(revision)}?`,
              message: (
                <RollbackMessage
                  application={application}
                  short={shortRevision(revision)}
                />
              ),
              extra: (
                <ViewChangesButton
                  store={preview}
                  title={`Changes in rolling ${application} back to ${shortRevision(revision)}`}
                />
              ),
              confirmLabel: "Roll back",
            });
          }}
          run={async () =>
            runOutcome(await rollbackApplication(application, r.revision!))
          }
        />
      ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={runs}
      rowKey={(r) => String(r.id)}
      empty="No runs yet"
      noun="runs"
      name="history"
    />
  );
}
