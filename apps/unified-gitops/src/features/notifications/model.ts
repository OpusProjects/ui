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

// Its events in words, in that order.
export const eventWords = (events: Event[]) =>
  EVENT_ORDER.filter((e) => events.includes(e)).map((e) => EVENT_WORDS[e]);

// The event a send carried: an event's words, or "Test" for a test send.
export const sentEvent = (event: string) =>
  event === "test" ? "Test" : (EVENT_WORDS[event as Event] ?? event);

export const TYPE_WORDS: Record<Schemas["NotificationType"], string> = {
  webhook: "Webhook",
  ascender: "Ascender job template",
  awx: "AWX job template",
};

// What an ascender or awx notification starts: "Job template 12". Null for
// a webhook. The card shows this; the page adds how (triggerText).
export const templateText = (n: Notification): string | null =>
  n.job_template != null
    ? `Job template ${n.job_template}`
    : n.workflow_job_template != null
      ? `Workflow job template ${n.workflow_job_template}`
      : null;

// The template's own page in Ascender or AWX: both use hash routes, the
// same for each. Null for a webhook. The controller's address is the one
// the notification sends to, so a controller under a path is not followed.
export function templatePage(n: Notification): string | null {
  const [kind, id] =
    n.job_template != null
      ? ["job_template", n.job_template]
      : n.workflow_job_template != null
        ? ["workflow_job_template", n.workflow_job_template]
        : [null, null];
  if (!kind) return null;
  return `${n.destination}/#/templates/${kind}/${id}/details`;
}

// How a job template is started: through its own webhook receiver, or by
// its launch API as a user. Null for a webhook notification.
export const triggerText = (n: Notification): string | null =>
  n.trigger === "launch"
    ? "Launch, as a user"
    : n.trigger === "webhook"
      ? "The template's webhook"
      : null;

// Where a webhook sends, as a card shows it: the host, without the scheme.
// The API never gives the path or query, which can carry a secret.
export const hostOf = (destination: string) =>
  destination.replace(/^[a-z]+:\/\//, "");

// applications: all, a list, or none (left out or []), as an API key reads
// its applications.
export const applicationsText = (n: Notification) =>
  n.all_applications
    ? "Every application"
    : n.applications.length === 0
      ? "None"
      : n.applications.join(", ");

export const searchText = (n: Notification) =>
  `${n.name} ${n.description ?? ""} ${n.type} ${n.destination} ${n.applications.join(" ")} ${n.events.join(" ")}`;
