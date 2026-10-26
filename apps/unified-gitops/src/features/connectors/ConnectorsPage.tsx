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
  formatSpan,
  pageStyles as styles,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useConnectors } from "../../api/queries";
import { ICONS } from "../../sections";
import { SUMMARY_LABELS, connectorLabels, useConnectorState } from "./model";

type Connector = Schemas["ConnectorInfo"];

const searchText = (connector: Connector) =>
  `${connector.name} ${connector.description ?? ""} ${connector.path} ${connector.used_by.join(" ")}`;

export function ConnectorsPage() {
  const state = useConnectorState();
  const connectors = useConnectors();
  const items = connectors.data ?? [];
  const filter = useListFilter(items, state, searchText);
  const remembered = useRememberedCount(
    "connectors",
    connectors.isSuccess ? connectors.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.connectors}
        title="Connectors"
        description="The scripts that list and apply objects on each kind of system."
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
            good="working"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search connectors"
            placeholder="Search by name, description, script or application"
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
                ? "Declare one under connectors: in the configuration: a script that answers describe, list and apply, and the types of object it manages."
                : "Clear the search or the filter to see every connector."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((connector) => (
                <ResourceCard
                  key={connector.name}
                  title={connector.name}
                  description={connector.description}
                  state={state(connector)}
                  labels={connectorLabels(connector)}
                  titleLink={(title, className) => (
                    <Link
                      to={`/connectors/${encodeURIComponent(connector.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                >
                  <Fact label="Project">
                    {connector.project ? (
                      <Link
                        className={styles.link}
                        to={`/projects/${encodeURIComponent(connector.project)}`}
                      >
                        {connector.project}
                      </Link>
                    ) : (
                      "None (local file)"
                    )}
                  </Fact>
                  <Fact label="File">
                    {/* The file name; the whole path on hover and on the
                        connector's page. */}
                    <code className={styles.mono} title={connector.path}>
                      {connector.path.split("/").at(-1)}
                    </code>
                  </Fact>
                  <Fact label="Timeout">
                    {formatSpan(connector.timeout_seconds)}
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
