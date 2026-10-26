import { Link } from "react-router";
import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  ListToolbar,
  LiveAge,
  Notice,
  PageHeader,
  ResourceCard,
  RunButton,
  SkeletonGrid,
  SkeletonSummary,
  pageStyles as styles,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import { useWebhooks } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  LABELS,
  TYPE_WORDS,
  applicationsText,
  hostOf,
  webhookState,
  searchText,
  sentEvent,
  templateText,
} from "./model";
import { sendTest } from "./test";

export function WebhooksPage() {
  const webhooks = useWebhooks();
  const items = webhooks.data ?? [];
  const filter = useListFilter(items, webhookState, searchText);
  const remembered = useRememberedCount(
    "webhooks",
    webhooks.isSuccess ? webhooks.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.webhooks}
        title="Webhooks"
        description="What the applications report, and where it goes: any receiver, or an Ascender or AWX job template's webhook."
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
            good="sending"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search webhooks"
            placeholder="Search by name, description, destination, application or event"
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
                ? "Declare one under webhooks: in the configuration: the events to report, the applications to listen to, and a webhook or a job template to send them to."
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
                  labels={LABELS}
                  error={n.last && !n.last.ok ? n.last.error : null}
                  titleLink={(title, className) => (
                    <Link
                      to={`/webhooks/${encodeURIComponent(n.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                  footer={
                    <RunButton
                      label="Send test"
                      busyLabel="Sending…"
                      invalidate={[["webhooks"]]}
                      run={() => sendTest(n.name)}
                    />
                  }
                >
                  <Fact label="Type">{TYPE_WORDS[n.type]}</Fact>
                  <Fact label="Applications">{applicationsText(n)}</Fact>
                  {templateText(n) ? (
                    <Fact label="Starts">{templateText(n)}</Fact>
                  ) : (
                    <Fact label="Sends to">
                      <code className={styles.mono} title={n.destination}>
                        {hostOf(n.destination)}
                      </code>
                    </Fact>
                  )}
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
