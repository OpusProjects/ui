import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { labelsText } from "../../shared/runs";

type Webhook = Schemas["WebhookSummary"];
type Event = Schemas["Event"];

// The same words as the other sections: working when its last send went
// through, failing when it did not, idle until it has sent anything. A
// disabled one never sends, which its pill says instead. On the overview's
// card, the list and a webhook's page.
export const LABELS = {
  fresh: "Working",
  failing: "Failing",
  pending: "Idle",
};

export const webhookLabels = (n: Webhook) =>
  n.enabled ? LABELS : { ...LABELS, pending: "Disabled" };

export const webhookState = (n: Webhook): HealthState =>
  !n.enabled || !n.last ? "pending" : n.last.ok ? "fresh" : "failing";

// Each event in words, in the order a reader thinks of them: the
// repository's, then its API items', then its scripts'.
export const EVENT_WORDS: Record<Event, string> = {
  commit_pulled: "Commit pulled",
  pull_failed: "Pull failed",
  pull_recovered: "Pull recovered",
  api_succeeded: "API run worked",
  api_failed: "API run failed",
  api_recovered: "API run recovered",
  script_succeeded: "Script run worked",
  script_failed: "Script run failed",
  script_recovered: "Script run recovered",
};

const EVENT_ORDER = Object.keys(EVENT_WORDS) as Event[];

// Its events in words, in that order.
export const eventWords = (events: Event[]) =>
  EVENT_ORDER.filter((e) => events.includes(e)).map((e) => EVENT_WORDS[e]);

// The event a send carried: an event's words, or "Test" for a test send.
export const sentEvent = (event: string) =>
  event === "test" ? "Test" : (EVENT_WORDS[event as Event] ?? event);

// Where a webhook sends, as a card shows it: the host, without the scheme.
// The API never gives the path or query, which can carry a secret.
export const hostOf = (destination: string) =>
  destination.replace(/^[a-z]+:\/\//, "");

export const CONTENT_WORDS: Record<Schemas["ContentType"], string> = {
  json: "JSON",
  form: "Form (URL-encoded)",
  text: "Plain text",
};

export const searchText = (n: Webhook) =>
  `${n.name} ${n.description ?? ""} ${n.project} ${n.destination} ${n.events.join(" ")} ${n.paths.join(" ")} ${labelsText(n.labels).join(" ")}`;
