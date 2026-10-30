import { Link } from "react-router";
import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  ListToolbar,
  LiveAge,
  Notice,
  orderOptions,
  PageHeader,
  pageStyles as styles,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import { useApis } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  LABELS,
  actionLabels,
  actionState,
  onText,
  stepsText,
  watchesText,
} from "../../shared/runs";
import { callText, searchText } from "./model";

export function ApisPage() {
  const apis = useApis();
  const items = apis.data ?? [];
  const filter = useListFilter(items, actionState, searchText, {
    name: (a) => a.name,
    key: "apis",
    orders: ["az", "za"],
  });
  const remembered = useRememberedCount(
    "apis",
    apis.isSuccess ? apis.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.apis}
        title="APIs"
        description="When a commit changes the files an item watches, it calls an API with them: one request per file, or one per commit."
      />
      {apis.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {apis.isError && (
        <Notice title="Could not load APIs">{apis.error.message}</Notice>
      )}
      {apis.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["API", "APIs"]}
            labels={LABELS}
            good="working"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            orders={orderOptions()}
            label="Search APIs"
            placeholder="Search by name, description, project, destination, path or label"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0 ? "No APIs configured" : "No APIs match"
              }
            >
              {items.length === 0
                ? "Declare one under apis: in the configuration: the project to watch, the files that matter, and the request to send with each."
                : "Clear the search or the filter to see every API."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((a) => (
                <ResourceCard
                  key={a.name}
                  title={a.name}
                  description={a.description}
                  state={actionState(a)}
                  labels={actionLabels(a)}
                  error={
                    a.last && !a.last.ok
                      ? (a.last.error ??
                        a.last.steps.find((s) => !s.ok)?.error ??
                        null)
                      : null
                  }
                  titleLink={(title, className) => (
                    <Link
                      to={`/apis/${encodeURIComponent(a.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                >
                  <Fact label="Project">{a.project}</Fact>
                  <Fact label="Calls">
                    <code className={styles.mono} title={callText(a)}>
                      {callText(a)}
                    </code>
                  </Fact>
                  <Fact label="Watches">
                    <code className={styles.mono}>{watchesText(a)}</code>
                  </Fact>
                  <Fact label="Runs on">{onText(a)}</Fact>
                  <Fact label="Last run">
                    {a.last ? (
                      <>
                        {a.last.dry_run ? "Dry run, " : ""}
                        {stepsText(a.last)},{" "}
                        <LiveAge since={a.last.started_at} />
                      </>
                    ) : (
                      "Never"
                    )}
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
