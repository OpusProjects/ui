import { Link } from "react-router";
import { HealthPill, formatAge } from "@opusprojects/unified-ui";
import { cachedHealth } from "@opusprojects/unified-client";
import { useSources } from "../api/queries";
import styles from "./SourceTable.module.css";

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
}: {
  ids: string[];
  empty: string;
  // An endpoint's limit.by_hosts_from_inventory: that source decides which
  // hosts the output holds at all, so it is marked and listed first.
  limitedBy?: string | null;
}) {
  const sources = useSources();
  if (ids.length === 0) return <p className={styles.empty}>{empty}</p>;
  const byId = new Map(sources.rows.map((row) => [row.summary.source_id, row]));
  const ordered = [...ids].sort((a, b) =>
    a === limitedBy ? -1 : b === limitedBy ? 1 : a.localeCompare(b),
  );

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {/* Widths in the stylesheet: name, three equal facts, then the
            state as wide as its widest pill. */}
        <colgroup>
          <col className={styles.nameCol} />
          <col className={styles.factCol} />
          <col className={styles.factCol} />
          <col className={styles.factCol} />
          <col className={styles.stateCol} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Hosts</th>
            <th scope="col">Groups</th>
            <th scope="col">Data from</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((id) => {
            const row = byId.get(id);
            const summary = row?.summary;
            return (
              <tr key={id}>
                <th scope="row" title={id}>
                  <span className={styles.nameLine}>
                    {summary ? (
                      <Link
                        to={`/sources/${encodeURIComponent(id)}`}
                        className={styles.name}
                      >
                        {row?.detail?.name ?? id}
                      </Link>
                    ) : (
                      <span className={styles.name}>{id}</span>
                    )}
                    {id === limitedBy && (
                      <span
                        className={styles.tag}
                        title={LIMIT_HINT}
                        tabIndex={0}
                        aria-label={`Limits hosts: ${LIMIT_HINT}`}
                      >
                        limits hosts
                      </span>
                    )}
                  </span>
                  <code className={styles.id}>{id}</code>
                </th>
                <td className={styles.number}>
                  {summary?.total_hosts?.toLocaleString() ?? "–"}
                </td>
                {/* From the source's detail: the list does not count
                    groups. */}
                <td className={styles.number}>
                  {row?.detail?.total_groups?.toLocaleString() ?? "–"}
                </td>
                <td>
                  {summary?.age_seconds != null
                    ? formatAge(summary.age_seconds)
                    : "–"}
                </td>
                <td>
                  {summary ? (
                    <HealthPill
                      state={cachedHealth(
                        summary.cached,
                        summary.is_fresh,
                        summary.sync_health,
                      )}
                    />
                  ) : (
                    <span className={styles.soft}>
                      {sources.isPending ? "…" : "Not visible"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
