import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

// How connectors are judged and described, shared by their list, their own
// page and a project's page, so a card and the page it opens never disagree.

type Connector = Schemas["ConnectorInfo"];

// A connector has no health of its own: it is as healthy as the sources that
// sync through it. Failing as soon as one of them is; idle while none has
// synced yet, unused while no source names it (a built-in nobody needs).
export const LABELS = {
  fresh: "Working",
  failing: "Sources failing",
  pending: "Idle",
};

// One connector's words: "Unused" rather than "Idle" when no source uses
// it, so the pill says why nothing is happening.
export const connectorLabels = (connector: Connector) =>
  connector.health.sources === 0 ? { ...LABELS, pending: "Unused" } : LABELS;

// The list's summary bar: one word for the connectors doing nothing.
export const SUMMARY_LABELS = { ...LABELS, pending: "Unused" };

export function connectorState(connector: Connector): HealthState {
  const { failing, healthy } = connector.health;
  if (failing > 0) return "failing";
  if (healthy === 0) return "pending";
  return "fresh";
}

// "1 of 3" beside a failing pill: how much of what it serves is affected.
export const stateDetail = (connector: Connector) =>
  connector.health.failing > 0
    ? `${connector.health.failing} of ${connector.health.sources}`
    : undefined;

// What the two built-ins are, in this app's words: they have no script to
// show, and the API's own name for them is the product's vocabulary.
export const BUILT_IN: Record<string, { what: string; reads: string }> = {
  remote: {
    what: "Copies a source from another instance.",
    reads: "A source on another instance",
  },
  static_inventory: {
    what: "Reads an Ansible YAML inventory from a project checkout.",
    reads: "An inventory file in a project",
  },
};

// The connector's description: its own words for an item (none when the
// name is only its identity), this app's for a built-in.
export function describe(connector: Connector): string | null {
  if (connector.built_in)
    return BUILT_IN[connector.connector_id]?.what ?? connector.name;
  return connector.name !== connector.connector_id ? connector.name : null;
}

export const connectorPath = (id: string) =>
  `/connectors/${encodeURIComponent(id)}`;
