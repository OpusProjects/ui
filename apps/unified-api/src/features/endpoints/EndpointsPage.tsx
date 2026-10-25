import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { useEndpoints } from "../../api/queries";
import { ENDPOINT_LABELS, endpointState } from "./model";
import { ListToolbar } from "../../shared/ListToolbar";
import { useListFilter } from "../../shared/useListFilter";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

type Endpoint = Schemas["EndpointInfo"];

const searchText = (endpoint: Endpoint) =>
  `${endpoint.endpoint_id} ${endpoint.name}`;

export function EndpointsPage() {
  const endpoints = useEndpoints();
  const items = endpoints.data ?? [];
  const filter = useListFilter(items, endpointState, searchText);
  const remembered = useRememberedCount(
    "endpoints",
    endpoints.isSuccess ? endpoints.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.endpoints}
        title="Endpoints"
        description="Inventories shaped for a consumer, built from one or more sources."
      />
      {endpoints.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {endpoints.isError && (
        <Notice title="Could not load endpoints">
          {endpoints.error.message}
        </Notice>
      )}
      {endpoints.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["endpoint", "endpoints"]}
            labels={ENDPOINT_LABELS}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search endpoints"
            placeholder="Search by name or id"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No endpoints configured"
                  : "No endpoints match"
              }
            >
              {items.length === 0
                ? "Declare an endpoint in endpoints.yaml to serve a source in a consumer's format."
                : "Clear the search or the filter to see every endpoint."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((endpoint) => (
                <ResourceCard
                  key={endpoint.endpoint_id}
                  title={endpoint.name}
                  id={endpoint.endpoint_id}
                  state={endpointState(endpoint)}
                  labels={ENDPOINT_LABELS}
                  titleLink={(title, className) => (
                    <Link
                      to={`/endpoints/${encodeURIComponent(endpoint.endpoint_id)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                  footer={
                    <a
                      className={styles.link}
                      href={`/api/v1/endpoints/${encodeURIComponent(endpoint.endpoint_id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open JSON
                      <ExternalLink aria-hidden />
                    </a>
                  }
                >
                  <Fact label="Sources">
                    <strong>
                      {endpoint.sources_ready} of {endpoint.source_ids.length}
                    </strong>
                    <span className={styles.soft}>ready</span>
                  </Fact>
                  {endpoint.sources_missing.length > 0 && (
                    <Fact label="Missing">
                      <span className={styles.list}>
                        {endpoint.sources_missing.map((id) => (
                          <code key={id} className={styles.mono}>
                            {id}
                          </code>
                        ))}
                      </span>
                    </Fact>
                  )}
                </ResourceCard>
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}
