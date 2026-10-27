import {
  CardGrid,
  EmptyState,
  Fact,
  FreshnessMeter,
  HealthSummary,
  LiveAge,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  formatEvery,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { cachedHealth } from "@opusprojects/unified-client";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { syncNow, syncSource } from "./sync";
import { useSources, type SourceRow } from "../../api/queries";
import { ListToolbar } from "@opusprojects/unified-ui";
import { RunAllButton } from "@opusprojects/unified-ui";
import { RunButton } from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import { ICONS } from "../../sections";
import { pageStyles as styles } from "@opusprojects/unified-ui";

const stateOf = ({ summary }: SourceRow) =>
  cachedHealth(summary.cached, summary.is_fresh, summary.sync_health);

const searchText = ({ summary, detail }: SourceRow) =>
  `${summary.source_id} ${detail?.name ?? ""}`;

export function SourcesPage() {
  const sources = useSources();
  const filter = useListFilter(sources.rows, stateOf, searchText);
  const remembered = useRememberedCount(
    "sources",
    sources.isSuccess ? sources.rows.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.sources}
        title="Sources"
        description="Where the data comes from, and whether each one is keeping up."
      />
      {sources.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {sources.isError && (
        <Notice title="Could not load sources">{sources.error.message}</Notice>
      )}
      {sources.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["source", "sources"]}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search sources"
            placeholder="Search by name or id"
          >
            {/* Views are left out: they do not sync. */}
            <RunAllButton
              ids={filter.visible
                .filter(({ summary }) => summary.kind !== "view")
                .map(({ summary }) => summary.source_id)}
              filtered={filter.visible.length !== sources.rows.length}
              words={{
                verb: "Sync",
                busy: "Syncing…",
                done: "synced",
                noun: ["source", "sources"],
              }}
              invalidate={[["sources"], ["source"]]}
              run={async (id) => (await syncSource(id)).success}
            />
          </ListToolbar>
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                sources.rows.length === 0
                  ? "No sources configured"
                  : "No sources match"
              }
            >
              {sources.rows.length === 0
                ? "Declare one under sources: in the configuration and it appears here after the next reload."
                : "Clear the search or the filter to see every source."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((row) => (
                <SourceCard key={row.summary.source_id} row={row} />
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}

function SourceCard({ row }: { row: SourceRow }) {
  const { summary, detail } = row;
  const state = stateOf(row);
  const health = summary.sync_health;
  const gathering = detail?.gathering;
  const isView = summary.kind === "view";
  const failures = health?.consecutive_failures ?? 0;

  const schedule = gathering?.schedule ? (
    <code className={styles.mono}>{gathering.schedule}</code>
  ) : (
    formatEvery(gathering?.sync_interval_seconds)
  );

  return (
    <ResourceCard
      title={detail?.name ?? summary.source_id}
      id={summary.source_id}
      titleLink={(title, className) => (
        <Link
          to={`/sources/${encodeURIComponent(summary.source_id)}`}
          className={className}
        >
          {title}
        </Link>
      )}
      tag={isView ? "view" : undefined}
      state={state}
      stateDetail={failures > 1 ? `${failures} in a row` : undefined}
      error={health?.last_error}
      footer={
        <>
          {summary.cached && (
            <a
              className={styles.link}
              href={summary.related.dataset}
              target="_blank"
              rel="noreferrer"
            >
              Open dataset
              <ExternalLink aria-hidden />
            </a>
          )}
          {!isView && (
            <RunButton
              label="Sync"
              busyLabel="Syncing…"
              invalidate={[["sources"], ["source", summary.source_id]]}
              run={() => syncNow(summary.source_id)}
            />
          )}
        </>
      }
    >
      <Fact label="Hosts">
        {/* One phrase, one element: a word gap, not the fact's item gap. */}
        <span>
          <strong>{summary.total_hosts ?? "None yet"}</strong>
          {detail?.total_groups != null && (
            <>
              {" "}
              <span className={styles.soft}>
                in {detail.total_groups} groups
              </span>
            </>
          )}
        </span>
      </Fact>
      <Fact label="Data from">
        {summary.age_seconds != null && detail ? (
          <>
            <span>
              <LiveAge seconds={summary.age_seconds} />
            </span>
            <FreshnessMeter
              ageSeconds={summary.age_seconds}
              ttlSeconds={detail.ttl_seconds}
              state={state}
            />
          </>
        ) : (
          <span className={styles.soft}>
            {summary.cached ? (
              <LiveAge seconds={summary.age_seconds} />
            ) : (
              "No data yet"
            )}
          </span>
        )}
      </Fact>
      {isView ? (
        <Fact label="Members">{detail?.members?.length ?? "…"}</Fact>
      ) : (
        <>
          <Fact label="Last attempt">
            <LiveAge seconds={health?.last_attempt_age_seconds} />
          </Fact>
          {schedule && <Fact label="Syncs">{schedule}</Fact>}
          {gathering && (
            <Fact label="Connector">
              {/* One phrase, one element: "inventory (script)" with a word
                  gap, as the source's page writes it. */}
              <span>
                <Link
                  className={styles.link}
                  to={`/connectors/${encodeURIComponent(gathering.connector)}`}
                  title={gathering.script_path}
                >
                  {gathering.connector}
                </Link>{" "}
                <span className={styles.soft}>
                  ({gathering.connector_type})
                </span>
              </span>
            </Fact>
          )}
        </>
      )}
    </ResourceCard>
  );
}
