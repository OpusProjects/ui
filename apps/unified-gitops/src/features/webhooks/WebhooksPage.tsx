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
import { useWebhooks } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  LABELS,
  webhookLabels,
  hostOf,
  webhookState,
  searchText,
  sentEvent,
} from "./model";

export function WebhooksPage() {
  const webhooks = useWebhooks();
  const items = webhooks.data ?? [];
  const filter = useListFilter(items, webhookState, searchText, {
    name: (n) => n.name,
    key: "webhooks",
    orders: ["az", "za"],
  });
  const remembered = useRememberedCount(
    "webhooks",
    webhooks.isSuccess ? webhooks.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.webhooks}
        title="Webhooks"
        description="When a project pulls a commit, fails to pull, or one of its API or script runs works or fails, a webhook sends an HTTP request about it."
      />
      {webhooks.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {webhooks.isError && (
        <Notice title="Could not load webhooks">
          {webhooks.error.message}
        </Notice>
      )}
      {webhooks.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["webhook", "webhooks"]}
            labels={LABELS}
            good="working"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            orders={orderOptions()}
            label="Search webhooks"
            placeholder="Search by name, description, destination, project, event, path or label"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No webhooks configured"
                  : "No webhooks match"
              }
            >
              {items.length === 0
                ? "Declare one under webhooks: in the configuration: the project to listen to, the events to report, and the request that tells them."
                : "Clear the search or the filter to see every webhook."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((n) => (
                <ResourceCard
                  key={n.name}
                  title={n.name}
                  description={n.description}
                  state={webhookState(n)}
                  labels={webhookLabels(n)}
                  error={n.last && !n.last.ok ? n.last.error : null}
                  titleLink={(title, className) => (
                    <Link
                      to={`/webhooks/${encodeURIComponent(n.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                >
                  <Fact label="Project">{n.project}</Fact>
                  <Fact label="Sends to">
                    <code className={styles.mono} title={n.destination}>
                      {n.request.method} {hostOf(n.destination)}
                    </code>
                  </Fact>
                  <Fact label="Last send">
                    {n.last ? (
                      <>
                        {sentEvent(n.last.event)}, <LiveAge since={n.last.at} />
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
