import { Link } from "react-router";
import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  ListToolbar,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  pageStyles as styles,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useConnectors } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  BUILT_IN,
  SUMMARY_LABELS,
  connectorLabels,
  connectorPath,
  connectorState,
  describe,
  noProject,
  pathFact,
  runs,
  stateDetail,
} from "./model";

type Connector = Schemas["ConnectorInfo"];

const searchText = (connector: Connector) =>
  [
    connector.connector_id,
    connector.name,
    describe(connector) ?? "",
    connector.connector_type,
    connector.path ?? "",
    connector.project_id ?? "",
    ...connector.used_by.map((u) => `${u.source_id} ${u.name}`),
  ].join(" ");

export function ConnectorsPage() {
  const connectors = useConnectors();
  const items = connectors.data ?? [];
  const filter = useListFilter(items, connectorState, searchText);
  const remembered = useRememberedCount(
    "connectors",
    connectors.isSuccess ? connectors.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.connectors}
        title="Connectors"
        description="How the sources talk to each kind of system, and how those syncs are going."
      />
      {connectors.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {connectors.isError && (
        <Notice title="Could not load connectors">
          {connectors.error.message}
        </Notice>
      )}
      {connectors.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["connector", "connectors"]}
            labels={SUMMARY_LABELS}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search connectors"
            placeholder="Search by name, type, path, project or source"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No connectors configured"
                  : "No connectors match"
              }
            >
              {items.length === 0
                ? "Declare one under connectors: in the configuration: the script a kind of system is read with, and how."
                : "Clear the search or the filter to see every connector."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((connector) => (
                <ConnectorCard
                  key={connector.connector_id}
                  connector={connector}
                />
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}

// No "Used by" on a card, as on every list card in both apps: the sources
// using a connector are a table on its page. The state pill still says how
// they are doing.
function ConnectorCard({ connector }: { connector: Connector }) {
  const builtIn = connector.built_in
    ? BUILT_IN[connector.connector_id]
    : undefined;

  return (
    <ResourceCard
      title={connector.connector_id}
      description={describe(connector)}
      state={connectorState(connector)}
      stateDetail={stateDetail(connector)}
      labels={connectorLabels(connector)}
      titleLink={(title, className) => (
        <Link to={connectorPath(connector.connector_id)} className={className}>
          {title}
        </Link>
      )}
    >
      <Fact label="Type">
        <code className={styles.mono}>{connector.connector_type}</code>
      </Fact>
      {connector.built_in ? (
        // Three rows, as a script's card has: what it reads, on one line,
        // and in the project's place, that it comes with every instance.
        <>
          <Fact label="Reads">
            <span className={styles.clipText} title={builtIn?.reads}>
              {builtIn?.reads ?? "Built in"}
            </span>
          </Fact>
          {/* Where a script's card names its project: a built-in has none,
              it comes with every instance. */}
          <Fact label="Project">
            <em
              className={styles.soft}
              title="Every instance has it; no item in the configuration defines it."
            >
              Built in
            </em>
          </Fact>
        </>
      ) : (
        <>
          <Fact label={pathFact(connector).label}>
            {/* In a few words; the whole path on hover and on the
                connector's page. */}
            <code
              className={`${styles.mono} ${styles.clipText}`}
              title={runs(connector)}
            >
              {pathFact(connector).value}
            </code>
          </Fact>
          <Fact label="Project">
            {connector.project_id ? (
              <Link
                className={styles.link}
                to={`/projects/${encodeURIComponent(connector.project_id)}`}
              >
                {connector.project_id}
              </Link>
            ) : (
              <em className={styles.soft} title={noProject(connector).why}>
                {noProject(connector).text}
              </em>
            )}
          </Fact>
        </>
      )}
    </ResourceCard>
  );
}
