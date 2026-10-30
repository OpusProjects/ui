import { Link } from "react-router";
import {
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  LiveAge,
  detailStyles as common,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../api/client";
import { useApis, useScripts } from "../api/queries";
import { fileText } from "../features/scripts/model";
import {
  actionLabels,
  actionState,
  SECTION,
  stepsText,
  type Kind,
} from "./runs";

type Item = Schemas["ApiSummary"] | Schemas["ScriptSummary"];
type Row = { name: string; item?: Item };

// A set of API or script items by name, each with what it calls or runs,
// its last run and its state, and a link to its page: a project's (they
// watch it), a credential's (they send or run with it). Names the list does
// not have (yet) still get a row.
export function ActionTable({
  kind,
  names,
  empty,
}: {
  kind: Kind;
  names: string[];
  empty: string;
}) {
  const apis = useApis();
  const scripts = useScripts();
  const list: Item[] =
    (kind === "api" ? apis.data : scripts.data) ?? ([] as Item[]);
  const byName = new Map(list.map((i) => [i.name, i]));
  const rows: Row[] = [...names]
    .sort()
    .map((name) => ({ name, item: byName.get(name) }));
  const none = <ListSoft>–</ListSoft>;
  const columns: ListColumn<Row>[] = [
    {
      key: "name",
      label: kind === "api" ? "API" : "Script",
      role: "name",
      title: (r) => r.name,
      render: (r) => (
        <ListName
          name={r.item?.description ?? r.name}
          id={r.name}
          link={(className, children) => (
            <Link
              className={className}
              to={`/${SECTION[kind]}/${encodeURIComponent(r.name)}`}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
    {
      key: "what",
      label: kind === "api" ? "Calls" : "Runs",
      title: (r) => (r.item ? what(r.item) : undefined),
      render: (r) =>
        r.item ? <code className={common.mono}>{what(r.item)}</code> : none,
    },
    {
      key: "last",
      label: "Last run",
      render: (r) =>
        r.item?.last ? (
          <>
            {stepsText(r.item.last)}, <LiveAge since={r.item.last.started_at} />
          </>
        ) : r.item ? (
          <ListSoft>Never</ListSoft>
        ) : (
          none
        ),
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: (r) =>
        r.item ? (
          <HealthPill
            state={actionState(r.item)}
            labels={actionLabels(r.item)}
          />
        ) : (
          none
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      empty={empty}
      noun={kind === "api" ? "APIs" : "scripts"}
    />
  );
}

const what = (item: Item) =>
  "file" in item ? fileText(item) : `${item.method} ${item.destination}`;
