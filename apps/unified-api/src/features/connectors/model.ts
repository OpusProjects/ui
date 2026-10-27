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

// What a connector's path is, which decides the words it is shown in:
// - file: a script here (a script connector, or an ssh one with location:
//   instance, streamed to each host)
// - host: on each host, run there (location: host), whether one program or
//   a pattern of facts files
// - inline: the old ssh form, the command itself written in the item
export type PathKind = "file" | "host" | "inline";

export function pathKind(connector: Connector): PathKind {
  if (connector.connector_type !== "ssh") return "file";
  if (connector.location === "host") return "host";
  if (connector.location === "instance") return "file";
  return "inline";
}

// Its path as a fact: the label, and the value in a few words (the whole
// path is on hover and on the connector's page).
export function pathFact(connector: Connector): {
  label: string;
  value: string;
} {
  const path = connector.path ?? "";
  switch (pathKind(connector)) {
    case "host":
      return { label: "Runs", value: path };
    case "inline":
      return { label: "Runs", value: commandSummary(path) };
    case "file":
      return { label: "File", value: path.split("/").at(-1) || "None" };
  }
}

// Where its path is, on the connector's page.
export const LOCATION_WORDS: Record<PathKind, string> = {
  file: "On this instance",
  host: "On the host",
  inline: "Written in the configuration",
};

// What Project says when there is none: where the path is instead, in the
// italic a built-in's "Built in" is shown in, and why on hover.
export function noProject(connector: Connector): {
  text: string;
  why: string;
} {
  switch (pathKind(connector)) {
    case "host":
      return {
        text: "On the host",
        why: "Its path is on the hosts, so no project checkout is used.",
      };
    case "inline":
      return {
        text: "In the configuration",
        why: "Its command is written in the item itself.",
      };
    case "file":
      return {
        text: "Local file",
        why: "Its path is on this instance's disk, not in a project.",
      };
  }
}

// The script's lines, blank ones left out of the count.
export const commandLines = (command: string) =>
  command.split("\n").filter((line) => line.trim() !== "");

// In a few words, for a card or a fact: the command itself when it is one
// line, "Shell script, 8 lines" when it is more.
export function commandSummary(command: string | null | undefined): string {
  if (!command) return "None";
  const lines = commandLines(command);
  return lines.length > 1
    ? `Shell script, ${lines.length} lines`
    : (lines[0] ?? "None");
}

export const connectorPath = (id: string) =>
  `/connectors/${encodeURIComponent(id)}`;
