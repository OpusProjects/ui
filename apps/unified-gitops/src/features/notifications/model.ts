import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

type Notification = Schemas["NotificationInfo"];
type Event = Schemas["Event"];

// A notification is working when its last send went through. The same words
// on the overview's card, the list and a notification's page.
export const LABELS = {
  fresh: "Sent",
  failing: "Last send failed",
  pending: "Not sent yet",
};

export const notificationState = (n: Notification): HealthState =>
  !n.last ? "pending" : n.last.ok ? "fresh" : "failing";

// Each event in words, in the order a reader thinks of them.
export const EVENT_WORDS: Record<Event, string> = {
  drift_detected: "Drift detected",
  out_of_sync: "Out of sync",
  sync_succeeded: "Sync applied",
  sync_failed: "Sync failed",
  back_in_sync: "Back in sync",
};

const EVENT_ORDER: Event[] = [
  "drift_detected",
  "out_of_sync",
  "sync_succeeded",
  "sync_failed",
  "back_in_sync",
];

export const eventsText = (events: Event[]) =>
  EVENT_ORDER.filter((e) => events.includes(e))
    .map((e) => EVENT_WORDS[e])
    .join(", ");

// The event a send carried: an event's words, or "Test" for a test send.
export const sentEvent = (event: string) =>
  event === "test" ? "Test" : (EVENT_WORDS[event as Event] ?? event);

export const TYPE_WORDS: Record<Schemas["NotificationType"], string> = {
  webhook: "Webhook",
  ascender: "Ascender job template",
  awx: "AWX job template",
};

// What an ascender or awx notification starts: "Job template 12". Null for
// a webhook. The card shows this much; the page adds how (targetText).
export const templateText = (n: Notification): string | null =>
  n.job_template != null
    ? `Job template ${n.job_template}`
    : n.workflow_job_template != null
      ? `Workflow job template ${n.workflow_job_template}`
      : null;

// The same, and how: "Job template 12, through its webhook".
export function targetText(n: Notification): string | null {
  const template = templateText(n);
  if (!template) return null;
  return n.trigger === "launch"
    ? `${template}, launched as a user`
    : `${template}, through its webhook`;
}

export const applicationsText = (n: Notification) =>
  n.applications.length === 0 ? "Every application" : n.applications.join(", ");

export const searchText = (n: Notification) =>
  `${n.name} ${n.description ?? ""} ${n.type} ${n.destination} ${n.applications.join(" ")} ${n.events.join(" ")}`;
