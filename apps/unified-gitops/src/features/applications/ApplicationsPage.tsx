import { Link } from "react-router";
import { ArrowUpFromLine, SearchCheck } from "lucide-react";
import {
  CardGrid,
  countOf,
  EmptyState,
  Fact,
  formatCount,
  formatEvery,
  HealthSummary,
  ListToolbar,
  LiveAge,
  Notice,
  PageHeader,
  pageStyles as styles,
  ResourceCard,
  RunAllButton,
  RunButton,
  SkeletonGrid,
  SkeletonSummary,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useApplications } from "../../api/queries";
import { ICONS } from "../../sections";
import { PendingChangesButton } from "./RollbackPreview";
import {
  APP_LABELS,
  appLabels,
  systemRevision,
  afterRun,
  appState,
  pending,
  refreshApplication,
  runOutcome,
  shortRevision,
  syncApplication,
} from "./model";

type App = Schemas["ApplicationSummary"];

const searchText = (app: App) =>
  `${app.name} ${app.description ?? ""} ${app.project} ${app.path} ${app.connector}`;

function mode(app: App) {
  const words = [app.auto_sync ? "auto-sync" : "manual sync"];
  if (app.prune) words.push("prune");
  return words.join(", ");
}

export function ApplicationsPage() {
  const applications = useApplications();
  const items = applications.data ?? [];
  const filter = useListFilter(items, appState, searchText);
  const remembered = useRememberedCount(
    "applications",
    applications.isSuccess ? applications.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.applications}
        title="Applications"
        description="Each system against its desired state in git. Check compares state; Push applies changes."
      />
      {applications.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {applications.isError && (
        <Notice title="Could not load applications">
          {applications.error.message}
        </Notice>
      )}
      {applications.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["application", "applications"]}
            labels={APP_LABELS}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search applications"
            placeholder="Search by name, description, path or connector"
          >
            <RunAllButton
              ids={filter.visible.map((a) => a.name)}
              filtered={filter.visible.length !== items.length}
              words={{
                verb: "Check",
                busy: "Checking…",
                done: "checked",
                noun: ["application", "applications"],
              }}
              invalidate={[["applications"], ["application"]]}
              run={async (id) =>
                (await refreshApplication(id)).result !== "failed"
              }
            />
            <RunAllButton
              ids={filter.visible.map((a) => a.name)}
              filtered={filter.visible.length !== items.length}
              words={{
                verb: "Push",
                busy: "Pushing…",
                done: "pushed",
                noun: ["application", "applications"],
              }}
              icon={<ArrowUpFromLine />}
              // Writes to every system shown: one explicit yes first.
              confirm={(count) => ({
                title: `Push ${countOf(count, "application")}?`,
                message:
                  "What each one's check finds is applied to its system now. Applications with nothing to apply are left as they are.",
                confirmLabel: `Push ${formatCount(count)}`,
              })}
              invalidate={[["applications"], ["application"]]}
              run={async (id) =>
                !["failed", "partial"].includes(
                  (await syncApplication(id)).result,
                )
              }
            />
          </ListToolbar>
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No applications configured"
                  : "No applications match"
              }
            >
              {items.length === 0
                ? "Declare one under applications: in the configuration: a system, its connector, and a folder of desired state in git."
                : "Clear the search or the filter to see every application."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((app) => (
                <ResourceCard
                  key={app.name}
                  title={app.name}
                  description={app.description}
                  state={appState(app)}
                  labels={appLabels(app)}
                  note={
                    app.rollback && (
                      <>
                        <p>
                          Rolled back to{" "}
                          <code className={styles.mono}>
                            {shortRevision(app.rollback.revision)}
                          </code>
                          .
                        </p>
                        <p>
                          Automatic syncs are paused until the next manual Push.
                        </p>
                      </>
                    )
                  }
                  error={app.sync_health?.last_error}
                  titleLink={(title, className) => (
                    <Link
                      to={`/applications/${encodeURIComponent(app.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                  footer={
                    <>
                      <RunButton
                        label="Check"
                        busyLabel="Checking…"
                        icon={<SearchCheck />}
                        invalidate={afterRun(app.name)}
                        run={async () =>
                          runOutcome(await refreshApplication(app.name))
                        }
                      />
                      <PendingChangesButton
                        application={app.name}
                        pending={
                          // Out of sync, a rollback's pause included (its
                          // badge says so too), with something to apply.
                          (app.status === "out_of_sync" ||
                            app.status === "rolled_back") &&
                          app.pending_operations > 0
                        }
                      />
                      <RunButton
                        label="Push"
                        busyLabel="Pushing…"
                        icon={<ArrowUpFromLine />}
                        outcomeSide="end"
                        invalidate={afterRun(app.name)}
                        run={async () =>
                          runOutcome(await syncApplication(app.name))
                        }
                      />
                    </>
                  }
                >
                  <Fact label="To apply">{pending(app)}</Fact>
                  {app.unmanaged > 0 && (
                    <Fact label="Unmanaged">
                      {app.unmanaged}{" "}
                      {app.unmanaged === 1 ? "object" : "objects"} not in git
                    </Fact>
                  )}
                  <Fact label="Connector">
                    <code className={styles.mono}>{app.connector}</code>
                  </Fact>
                  <Fact label="Commit">
                    <span>
                      <code className={styles.mono}>
                        {shortRevision(systemRevision(app))}
                      </code>
                    </span>
                  </Fact>
                  <Fact label="Last check">
                    <LiveAge seconds={app.last_checked_age_seconds} />
                  </Fact>
                  <Fact label="Runs">
                    {formatEvery(app.sync_interval_seconds)}, {mode(app)}
                  </Fact>
                </ResourceCard>
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}
