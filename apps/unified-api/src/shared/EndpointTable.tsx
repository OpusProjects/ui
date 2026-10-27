import { Link } from "react-router";
import {
  formatCount,
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  ListTag,
  type ListColumn,
} from "@opusprojects/unified-ui";
import { useEndpoints } from "../api/queries";
import { ENDPOINT_LABELS, endpointState } from "../features/endpoints/model";

// A set of endpoints by name, each with its output, how many of its sources
// are ready and its state, and a link to its own page: a project's (its
// transformer runs from it), a source's (it reads the source). Ids the
// caller may not read still get a row, as SourceTable does for sources.
export function EndpointTable({
  ids,
  empty,
  limitedBy,
}: {
  ids: string[];
  empty: string;
  // On a source's page: endpoints whose hosts this source decides
  // (limit.by_hosts_from_inventory) are marked so, as on the endpoint's own.
  limitedBy?: string;
}) {
  const endpoints = useEndpoints();
  const byId = new Map((endpoints.data ?? []).map((e) => [e.endpoint_id, e]));
  type Row = { id: string; endpoint: ReturnType<typeof byId.get> };
  const rows: Row[] = [...ids]
    .sort()
    .map((id) => ({ id, endpoint: byId.get(id) }));
  const none = <ListSoft>–</ListSoft>;

  const columns: ListColumn<Row>[] = [
    {
      key: "endpoint",
      label: "Endpoint",
      role: "name",
      title: (r) => r.id,
      render: ({ id, endpoint }) => (
        <ListName
          name={endpoint?.name ?? id}
          link={
            endpoint
              ? (className, children) => (
                  <Link
                    to={`/endpoints/${encodeURIComponent(id)}`}
                    className={className}
                  >
                    {children}
                  </Link>
                )
              : undefined
          }
          tag={
            limitedBy &&
            endpoint?.transform?.limit_hosts_from === limitedBy && (
              <ListTag
                label="limits hosts"
                hint="This source decides which hosts the endpoint's output holds; the other sources add their variables and groups to them."
              />
            )
          }
          id={id}
        />
      ),
    },
    {
      key: "output",
      label: "Output",
      // In the transform, which only admin keys read: "–" otherwise.
      render: ({ endpoint }) =>
        endpoint?.transform ? (endpoint.transform.output ?? "script") : none,
    },
    {
      key: "ready",
      label: "Sources ready",
      numeric: true,
      render: ({ endpoint }) =>
        endpoint
          ? `${formatCount(endpoint.sources_ready)} of ${formatCount(endpoint.source_ids.length)}`
          : none,
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: ({ endpoint }) =>
        endpoint ? (
          <HealthPill
            state={endpointState(endpoint)}
            labels={ENDPOINT_LABELS}
          />
        ) : (
          <ListSoft>{endpoints.isPending ? "…" : "Not visible"}</ListSoft>
        ),
    },
  ];

  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={empty}
      noun="endpoints"
    />
  );
}
