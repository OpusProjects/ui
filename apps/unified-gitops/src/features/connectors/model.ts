import type { HealthState, Scrape } from "@opusprojects/unified-client";
import { sum, useMetrics } from "@opusprojects/unified-client";

// A connector has no health of its own; what is worth knowing is whether its
// requests to the applications are failing. The same words on the overview's
// card, the list, a connector's page and a project's.
export const LABELS = {
  fresh: "Working",
  failing: "Requests failing",
  pending: "Idle",
};

// One connector's words: "Unused" rather than "Idle" when no application
// uses it, so the pill says why it makes no requests.
export const connectorLabels = (connector: { used_by: string[] }) =>
  connector.used_by.length === 0 ? { ...LABELS, pending: "Unused" } : LABELS;

// The list's summary bar: one word for the connectors doing nothing.
export const SUMMARY_LABELS = { ...LABELS, pending: "Unused" };

export const CALLS = "unified_gitops_connector_calls_total";

// A connector's requests over what the app has sampled (up to the last half
// hour), not since the process started: an old failure that has stopped is
// not news. Null until there are two samples to compare.
export function connectorRequests(scrapes: Scrape[], connector: string) {
  const first = scrapes[0];
  const last = scrapes.at(-1);
  if (!first || !last || first === last) return null;
  const growth = (outcome?: string) => {
    const match = (l: Record<string, string>) =>
      l.connector === connector && (!outcome || l.outcome === outcome);
    return Math.max(
      0,
      sum(last.samples, CALLS, match) - sum(first.samples, CALLS, match),
    );
  };
  return {
    all: growth(),
    failed: growth("error"),
    minutes: Math.max(1, Math.round((last.at - first.at) / 60_000)),
  };
}

export const requestState = (
  requests: ReturnType<typeof connectorRequests>,
): HealthState =>
  requests === null || requests.all === 0
    ? "pending"
    : requests.failed > 0
      ? "failing"
      : "fresh";

// Each connector's state, from the metrics the app samples while it is open.
export function useConnectorState(): (connector: {
  name: string;
}) => HealthState {
  const { scrapes } = useMetrics();
  return (connector) =>
    requestState(connectorRequests(scrapes, connector.name));
}
