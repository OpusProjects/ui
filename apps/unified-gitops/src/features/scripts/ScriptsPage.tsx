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
import { useScripts } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  LABELS,
  actionLabels,
  actionState,
  onText,
  stepsText,
  watchesText,
} from "../../shared/runs";
import { PER_WORDS, commandText, fileText, searchText } from "./model";

export function ScriptsPage() {
  const scripts = useScripts();
  const items = scripts.data ?? [];
  const filter = useListFilter(items, actionState, searchText, {
    name: (a) => a.name,
    key: "scripts",
    orders: ["az", "za"],
  });
  const remembered = useRememberedCount(
    "scripts",
    scripts.isSuccess ? scripts.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.scripts}
        title="Scripts"
        description="When a commit changes the files an item watches, it runs a script from a repository, with what changed in its environment."
      />
      {scripts.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {scripts.isError && (
        <Notice title="Could not load scripts">{scripts.error.message}</Notice>
      )}
      {scripts.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["script", "scripts"]}
            labels={LABELS}
            good="working"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            orders={orderOptions()}
            label="Search scripts"
            placeholder="Search by name, description, project, file, argument, path or label"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No scripts configured"
                  : "No scripts match"
              }
            >
              {items.length === 0
                ? "Declare one under scripts: in the configuration: the project to watch, the files that matter, and the file to run."
                : "Clear the search or the filter to see every script."}
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
                      to={`/scripts/${encodeURIComponent(a.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                >
                  <Fact label="Project">{a.project}</Fact>
                  <Fact label="Script">
                    <code className={styles.mono} title={fileText(a)}>
                      {fileText(a)}
                    </code>
                  </Fact>
                  <Fact label="Command">
                    <code className={styles.mono} title={commandText(a)}>
                      {commandText(a)}
                    </code>
                  </Fact>
                  {a.env.length > 0 && (
                    <Fact label="Environment">
                      <code className={styles.mono}>{a.env.join(", ")}</code>
                    </Fact>
                  )}
                  <Fact label="Watches">
                    <code className={styles.mono}>{watchesText(a)}</code>
                  </Fact>
                  <Fact label="Runs on">
                    {onText(a)}; {PER_WORDS[a.per].toLowerCase()}
                  </Fact>
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
