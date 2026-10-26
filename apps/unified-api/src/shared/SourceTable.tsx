import { Link } from "react-router";
import {
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  ListTag,
  formatAge,
  type ListColumn,
} from "@opusprojects/unified-ui";
import { cachedHealth } from "@opusprojects/unified-client";
import { useSources } from "../api/queries";

// A set of sources by name, each with its health, size and data age, and a
// link to its own page: an endpoint's inputs, a project's users. Ids the
// caller may not read (or that are not configured) still get a row, so the
// list says how many there are rather than quietly shrinking.
// The tag's explanation, on hover and keyboard focus alike.
const LIMIT_HINT =
  "Only the hosts this source lists are in the output; the other sources add their variables and groups to them.";

export function SourceTable({
  ids,
  empty,
  limitedBy,
  brief = false,
}: {
  ids: string[];
  empty: string;
  // Only the source and its state: where size and data age say nothing about
  // the page's subject (a credential is used or not, whatever the hosts).
  brief?: boolean;
  // An endpoint's limit.by_hosts_from_inventory: that source decides which
  // hosts the output holds at all, so it is marked and listed first.
  limitedBy?: string | null;
}) {
  const sources = useSources();
  const byId = new Map(sources.rows.map((row) => [row.summary.source_id, row]));
  const ordered = [...ids].sort((a, b) =>
    a === limitedBy ? -1 : b === limitedBy ? 1 : a.localeCompare(b),
  );
  type Row = { id: string; row: ReturnType<typeof byId.get> };
  const rows: Row[] = ordered.map((id) => ({ id, row: byId.get(id) }));

  const columns: ListColumn<Row>[] = [
    {
      key: "source",
      label: "Source",
      role: "name",
      title: ({ id }) => id,
      render: ({ id, row }) => (
        <ListName
          name={row?.detail?.name ?? id}
          link={
            row?.summary
              ? (className, children) => (
                  <Link
                    to={`/sources/${encodeURIComponent(id)}`}
                    className={className}
                  >
                    {children}
                  </Link>
                )
              : undefined
          }
          tag={
            id === limitedBy && (
              <ListTag label="limits hosts" hint={LIMIT_HINT} />
            )
          }
          id={id}
        />
      ),
    },
    {
      key: "hosts",
      label: "Hosts",
      numeric: true,
      render: ({ row }) => row?.summary?.total_hosts?.toLocaleString() ?? "–",
    },
    // From the source's detail: the list does not count groups.
    {
      key: "groups",
      label: "Groups",
      numeric: true,
      render: ({ row }) => row?.detail?.total_groups?.toLocaleString() ?? "–",
    },
    {
      key: "age",
      label: "Data from",
      render: ({ row }) =>
        row?.summary?.age_seconds != null
          ? formatAge(row.summary.age_seconds)
          : "–",
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: ({ row }) =>
        row?.summary ? (
          <HealthPill
            state={cachedHealth(
              row.summary.cached,
              row.summary.is_fresh,
              row.summary.sync_health,
            )}
          />
        ) : (
          <ListSoft>{sources.isPending ? "…" : "Not visible"}</ListSoft>
        ),
    },
  ];

  return (
    <ListTable
      columns={
        brief
          ? columns.filter((c) => c.role === "name" || c.role === "state")
          : columns
      }
      rows={rows}
      rowKey={(r) => r.id}
      empty={empty}
      noun="sources"
    />
  );
}
