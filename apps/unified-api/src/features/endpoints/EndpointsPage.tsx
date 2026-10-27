import {
  CardGrid,
  EmptyState,
  Fact,
  formatCount,
  HealthSummary,
  Notice,
  orderOptions,
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
import { ListToolbar } from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import { ICONS } from "../../sections";
import { pageStyles as styles } from "@opusprojects/unified-ui";

type Endpoint = Schemas["EndpointInfo"];

const searchText = (endpoint: Endpoint) =>
  `${endpoint.endpoint_id} ${endpoint.name}`;

export function EndpointsPage() {
  const endpoints = useEndpoints();
  const items = endpoints.data ?? [];
  const filter = useListFilter(items, endpointState, searchText, {
    name: (e) => e.endpoint_id,
    key: "endpoints",
    orders: ["az", "za"],
  });
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
            orders={orderOptions()}
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
                ? "Declare one under endpoints: in the configuration to serve a source in a consumer's format."
                : "Clear the search or the filter to see every endpoint."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((endpoint) => (
                <ResourceCard
                  key={endpoint.endpoint_id}
                  // The name as the title, the description under it, as
                  // every card and the page it opens.
                  title={endpoint.endpoint_id}
                  description={
                    endpoint.name !== endpoint.endpoint_id
                      ? endpoint.name
                      : null
                  }
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
                    {/* One phrase, one element: a fact's parts are spaced
                        as separate items, wider than a word gap. */}
                    <span>
                      <strong>
                        {formatCount(endpoint.sources_ready)} of{" "}
                        {formatCount(endpoint.source_ids.length)}
                      </strong>{" "}
                      <span className={styles.soft}>ready</span>
                    </span>
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
