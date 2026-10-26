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
  RunButton,
  SkeletonGrid,
  SkeletonSummary,
  formatAge,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { useListFilter } from "@opusprojects/unified-client";
import { useNotifications } from "../../api/queries";
import { ICONS } from "../../sections";
import {
  LABELS,
  TYPE_WORDS,
  applicationsText,
  notificationState,
  searchText,
  sentEvent,
  templateText,
} from "./model";
import { sendTest } from "./test";

export function NotificationsPage() {
  const notifications = useNotifications();
  const items = notifications.data ?? [];
  const filter = useListFilter(items, notificationState, searchText);
  const remembered = useRememberedCount(
    "notifications",
    notifications.isSuccess ? notifications.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.notifications}
        title="Notifications"
        description="What the applications report, and where it goes: webhooks and job templates."
      />
      {notifications.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {notifications.isError && (
        <Notice title="Could not load notifications">
          {notifications.error.message}
        </Notice>
      )}
      {notifications.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["notification", "notifications"]}
            labels={LABELS}
            good="sending"
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search notifications"
            placeholder="Search by name, description, destination, application or event"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No notifications configured"
                  : "No notifications match"
              }
            >
              {items.length === 0
                ? "Declare one under notifications: in the configuration: the events to report, the applications to listen to, and a webhook or a job template to send them to."
                : "Clear the search or the filter to see every notification."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((n) => (
                <ResourceCard
                  key={n.name}
                  title={n.name}
                  description={n.description}
                  state={notificationState(n)}
                  labels={LABELS}
                  error={n.last && !n.last.ok ? n.last.error : null}
                  titleLink={(title, className) => (
                    <Link
                      to={`/notifications/${encodeURIComponent(n.name)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                  footer={
                    <RunButton
                      label="Send test"
                      busyLabel="Sending…"
                      invalidate={[["notifications"]]}
                      run={() => sendTest(n.name)}
                    />
                  }
                >
                  <Fact label="Type">{TYPE_WORDS[n.type]}</Fact>
                  <Fact label="Applications">{applicationsText(n)}</Fact>
                  {templateText(n) && (
                    <Fact label="Starts">{templateText(n)}</Fact>
                  )}
                  <Fact label="Last send">
                    {n.last
                      ? `${sentEvent(n.last.event)}, ${formatAge(Math.max(0, Date.now() / 1000 - n.last.at))}`
                      : "Never"}
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
