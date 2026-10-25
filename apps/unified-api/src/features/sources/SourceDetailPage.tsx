import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  EmptyState,
  Fact,
  FreshnessMeter,
  HealthPill,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  SkeletonSummary,
  formatAge,
  formatBytes,
  formatEvery,
  formatSpan,
  usePageSize,
  CodeView,
  CopyButton,
  FormatSwitch,
  serialize,
  useFormat,
} from "@opusprojects/unified-ui";
import { cachedHealth } from "@opusprojects/unified-client";
import { api, unwrap } from "../../api/client";
import {
  useHostVars,
  useSourceDetail,
  useSourceGroups,
  useSourceHosts,
} from "../../api/queries";
import { DetailTitle, common } from "../../shared/Detail";
import { RunButton } from "../../shared/RunButton";
import { instanceName } from "../../shared/instances";
import { ICONS } from "../../sections";
import styles from "./SourceDetailPage.module.css";

// One source: how it is doing, how it gathers, and what it holds. The data
// is browsed a host at a time (list on the left, that host's variables on
// the right) because a whole dataset is thousands of hosts by dozens of
// variables: a table of all of it would be unreadable and slow to send. The
// selected host lives in the URL, so a link can point straight at it.
export function SourceDetailPage() {
  const { id = "" } = useParams();
  const detail = useSourceDetail(id);

  return (
    <>
      <PageHeader
        icon={ICONS.sources}
        // The trail is the title, as on any page: where you came from, a
        // quiet link back, then this source.
        title={
          <DetailTitle section="Sources" to="/sources">
            {id}
          </DetailTitle>
        }
        description={detail.data?.name}
        // The page's own action, where every page keeps one: it acts on the
        // whole source, not on anything in a card. Views gather nothing.
        // Keyed by the source: a sync still running when you move to another
        // source must not show its progress and result on that one.
        actions={detail.data?.kind === "source" && <SyncNow key={id} id={id} />}
      />
      {detail.isPending && <SkeletonSummary />}
      {detail.isError && (
        <Notice title="Could not load this source">
          {detail.error.message}
        </Notice>
      )}
      {detail.isSuccess && (
        <>
          <Overview detail={detail.data} />
          {detail.data.cached ? (
            // Keyed by the source, so its search, page and selection start
            // afresh on another source instead of filtering it with the last
            // one's search.
            <HostBrowser key={id} id={id} />
          ) : (
            <EmptyState title="No data yet">
              This source has not completed a sync. Its hosts appear here after
              the first successful one.
            </EmptyState>
          )}
        </>
      )}
    </>
  );
}

function SyncNow({ id }: { id: string }) {
  return (
    <RunButton
      label="Sync now"
      busyLabel="Syncing…"
      invalidate={[["sources"], ["source", id]]}
      run={async () => {
        const result = unwrap(
          await api.POST("/api/v1/sources/{id}/sync", {
            params: { path: { id } },
          }),
        );
        return result.success
          ? { ok: true, message: `Synced ${result.total_hosts} hosts` }
          : { ok: false, message: "Sync failed" };
      }}
    />
  );
}

type Detail = NonNullable<ReturnType<typeof useSourceDetail>["data"]>;

// What each overview fact means, behind its label. Settings start with
// their key in sources.yaml, which is where they are changed.
const HINTS: Record<string, string> = {
  Hosts: "Hosts in the cached data, as of the last sync.",
  Groups: "Ansible groups in the cached data, as of the last sync.",
  "Data from":
    "How old the cached data is; the bar fills as it nears its TTL. For a remote source this is the age at its origin: copying data does not make it newer.",
  TTL: "ttl_seconds. How long the data counts as fresh. Past it the source reads as stale, but its data is still served until a sync replaces it. Also the threshold for an on-demand refresh.",
  Schedule:
    "schedule. A cron expression (UTC) for when this source syncs, used instead of an interval.",
  "Sync interval":
    "sync_interval_seconds. How often this source syncs. After a failure it backs off: the next attempts come 1, 2, 4, then at most 8 intervals apart, until one succeeds.",
  "Sync mode":
    "sync_mode. replace: each sync replaces the whole dataset. merge: each sync updates the hosts it returns and leaves the rest as they were.",
  Connector:
    "connector_type. How the data is gathered: script runs a program, ssh runs commands on each host, static_inventory reads an Ansible inventory file, remote copies a source from another unified-api.",
  "Remote source":
    "script_path. For a remote source, the id of the source it copies on the other instance.",
  "Remote instance":
    "config.url. The unified-api instance this source pulls from, named as on the Topology page. Opens it.",
  Script:
    "script_path. What the connector runs or reads, inside the project's git checkout.",
  Project:
    "project_id. The git project, from projects.yaml, that holds the script.",
  "Last attempt":
    "When this source last tried to sync, whether it worked or not.",
  "Last success":
    "When a sync last worked. Recent while the data is old means the data is old at its origin, not stuck here.",
  Timeout:
    "timeout_seconds. How long one sync may run. One that runs longer is stopped and counts as failed.",
  "Dataset size":
    "How big a full read of this source's dataset is, as JSON before compression. Measured once the full dataset has been read since the last sync; building it only to measure it would cost a full serialization.",
  "On-demand refresh":
    "allow_on_demand_refresh. Whether a read may ask for current data for named hosts (dataset?host=X&refresh=true), gathering them if their data is older than the TTL. Off by default, because such a read can reach real hosts.",
  Credentials:
    "credential_ids. The credentials, from credentials.yaml, the connector is given. Names only; their secrets are never shown.",
  Members:
    "The sources this view reads from, by declared ownership of groups and hosts.",
};

function Overview({ detail }: { detail: Detail }) {
  const state = cachedHealth(
    detail.cached,
    detail.is_fresh,
    detail.sync_health,
  );
  const failures = detail.sync_health?.consecutive_failures ?? 0;
  const gathering = detail.gathering;

  return (
    <Panel
      title="Overview"
      aside={
        <HealthPill
          state={state}
          detail={failures > 1 ? `${failures} in a row` : undefined}
        />
      }
    >
      {/* Five rows of three, by theme: what is cached, how current it is
          (both measured), then the settings, labelled after their keys in
          sources.yaml so the person who writes that file knows which key to
          change. Restricted callers get no settings beyond the TTL. */}
      <dl className={common.facts}>
        <Fact label="Hosts" hint={HINTS["Hosts"]}>
          {detail.total_hosts?.toLocaleString() ?? "None yet"}
        </Fact>
        <Fact label="Groups" hint={HINTS["Groups"]}>
          {detail.total_groups?.toLocaleString() ?? "None yet"}
        </Fact>
        <Fact label="Dataset size" hint={HINTS["Dataset size"]}>
          {detail.dataset_bytes != null
            ? formatBytes(detail.dataset_bytes)
            : detail.cached
              ? "Not measured yet"
              : "No data yet"}
        </Fact>

        <Fact label="Data from" hint={HINTS["Data from"]}>
          {detail.age_seconds != null ? (
            <>
              <span>{formatAge(detail.age_seconds)}</span>
              <FreshnessMeter
                ageSeconds={detail.age_seconds}
                ttlSeconds={detail.ttl_seconds}
                state={state}
              />
            </>
          ) : (
            "No data yet"
          )}
        </Fact>
        {/* A view does not sync, so it has no attempts to report. */}
        {detail.kind === "source" && (
          <>
            <Fact label="Last attempt" hint={HINTS["Last attempt"]}>
              {formatAge(detail.sync_health?.last_attempt_age_seconds)}
            </Fact>
            {/* Not the same as "Data from": a remote source passes on its
                origin's age, so old data with a recent success means the
                staleness is upstream, not here. */}
            <Fact label="Last success" hint={HINTS["Last success"]}>
              {detail.sync_health?.last_success_age_seconds != null
                ? formatAge(detail.sync_health.last_success_age_seconds)
                : "Never"}
            </Fact>
          </>
        )}

        <Fact label="TTL" hint={HINTS["TTL"]}>
          {formatSpan(detail.ttl_seconds)}
        </Fact>
        {gathering && (
          <>
            {gathering.schedule ? (
              <Fact label="Schedule" hint={HINTS["Schedule"]}>
                <code className={common.mono}>{gathering.schedule}</code>
              </Fact>
            ) : (
              <Fact label="Sync interval" hint={HINTS["Sync interval"]}>
                {formatEvery(gathering.sync_interval_seconds) ?? "On demand"}
              </Fact>
            )}
            <Fact label="Sync mode" hint={HINTS["Sync mode"]}>
              {gathering.sync_mode}
            </Fact>

            <Fact label="Timeout" hint={HINTS["Timeout"]}>
              {formatSpan(gathering.timeout_seconds)}
            </Fact>
            <Fact label="On-demand refresh" hint={HINTS["On-demand refresh"]}>
              {gathering.allow_on_demand_refresh ? "On" : "Off"}
            </Fact>
            <Fact label="Credentials" hint={HINTS["Credentials"]}>
              {gathering.credential_ids.length > 0 ? (
                <span
                  className={common.clipText}
                  title={gathering.credential_ids.join(", ")}
                >
                  {gathering.credential_ids.join(", ")}
                </span>
              ) : (
                "None"
              )}
            </Fact>

            <Fact label="Connector" hint={HINTS["Connector"]}>
              {gathering.connector_type}
            </Fact>
            {gathering.remote_url ? (
              <>
                {/* A remote source's script_path is a source id on the other
                    instance, and project_id means nothing to it: what is
                    worth knowing is which source, and where. */}
                <Fact label="Remote source" hint={HINTS["Remote source"]}>
                  {gathering.script_path}
                </Fact>
                <Fact label="Remote instance" hint={HINTS["Remote instance"]}>
                  <a
                    className={common.link}
                    href={gathering.remote_url}
                    title={gathering.remote_url}
                  >
                    {instanceName(gathering.remote_url)}
                  </a>
                </Fact>
              </>
            ) : (
              <>
                <Fact label="Script" hint={HINTS["Script"]}>
                  <span
                    className={common.clipText}
                    title={gathering.script_path}
                  >
                    {gathering.script_path}
                  </span>
                </Fact>
                <Fact label="Project" hint={HINTS["Project"]}>
                  {gathering.project_id}
                </Fact>
              </>
            )}
          </>
        )}
        {detail.members && (
          <Fact label="Members" hint={HINTS["Members"]}>
            {detail.members.length} sources
          </Fact>
        )}
      </dl>
      {detail.sync_health?.last_error && (
        <p className={common.error}>{detail.sync_health.last_error}</p>
      )}
    </Panel>
  );
}

function HostBrowser({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("host");
  const group = params.get("group");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  // Sized for the window, not for where the list first appears: it is
  // sticky, so while the variables scroll it has the full height less the
  // search above it and the pager below (~120px). Rows measure 28px.
  const [pageSize, setPageSize] = usePageSize("source-hosts", 28, 120);

  const groups = useSourceGroups(id);
  const hosts = useSourceHosts(id, group);

  const needle = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      (hosts.data?.hosts ?? []).filter(
        (h) => needle === "" || h.toLowerCase().includes(needle),
      ),
    [hosts.data, needle],
  );
  // Never past the last page: a sync or a refetch can shrink the list
  // under the page being shown, which would otherwise read "61–40 of 40"
  // with no rows (or none at all once the pager hides itself).
  const lastPage = Math.max(0, Math.ceil(matching.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  const shown = matching.slice(current * pageSize, (current + 1) * pageSize);

  // A new search, group or page size starts at the first page.
  useEffect(() => setPage(0), [needle, group, pageSize]);

  // A host chosen from elsewhere (the search, a link) opens on the page of
  // the list that holds it. Only when the selection changes: paging away
  // from it by hand afterwards is not pulled back. Declared after the reset
  // above, so on arrival it has the last word.
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || shownFor.current === selected) return;
    const at = matching.indexOf(selected);
    if (at === -1) return;
    shownFor.current = selected;
    setPage(Math.floor(at / pageSize));
  }, [selected, matching, pageSize]);

  const list = useRef<HTMLUListElement>(null);
  const varsTop = useRef<HTMLDivElement>(null);

  // The list scrolls inside itself when it is taller than the window allows:
  // keep the selected host in it, so arrow keys never move the selection
  // out of sight.
  useEffect(() => {
    const box = list.current;
    const option = selected
      ? document.getElementById(optionId(selected))
      : null;
    if (!box || !option || !box.contains(option)) return;
    if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      box.scrollTop + box.clientHeight
    )
      box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
  }, [selected, shown]);

  // Picking a host while deep in the previous one's variables: back to the
  // top of the card, or the new host opens somewhere in its middle. Only
  // when that top has scrolled off; a card already in view stays put. The
  // first host (picked for you on load) is not a pick, so it is skipped.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) {
      picked.current = selected !== null;
      return;
    }
    const top = varsTop.current?.getBoundingClientRect().top;
    // The marker sits inside the card's padding (20px), and the card lands
    // where the sticky list does (16px from the top).
    if (top !== undefined && top < 0)
      window.scrollTo({ top: window.scrollY + top - 36 });
  }, [selected]);

  // Something to look at straight away: the first host, unless the URL
  // already names one.
  useEffect(() => {
    if (!selected && matching.length > 0) {
      setParams(
        (p) => {
          p.set("host", matching[0]);
          return p;
        },
        { replace: true },
      );
    }
  }, [selected, matching, setParams]);

  const select = (host: string) =>
    setParams((p) => {
      p.set("host", host);
      return p;
    });
  const setGroup = (value: string) =>
    setParams((p) => {
      if (value) p.set("group", value);
      else p.delete("group");
      p.delete("host");
      return p;
    });

  return (
    <div className={styles.browser}>
      <Panel className={styles.hostCard}>
        <div>
          {/* Each column opens with its own heading, on one line: "Hosts" on
              the left, the selected host on the right. */}
          <div className={styles.columnHead}>
            <h2 className={styles.columnTitle}>Hosts</h2>
            {hosts.data && (
              <span className={styles.varCount}>
                {needle
                  ? `${matching.length.toLocaleString()} of ${count(hosts.data.hosts.length, "host")}`
                  : count(hosts.data.hosts.length, "host")}
                {group && ` in ${group}`}
              </span>
            )}
          </div>
          {/* From the search down: what stays in view while the variables
              scroll; the heading above scrolls away with the page. */}
          <div className={styles.hostSticky}>
            <div className={styles.toolbar}>
              <SearchField
                label="Search hosts"
                placeholder="Search hosts"
                value={query}
                onChange={setQuery}
                size="compact"
              />
              {(groups.data?.length ?? 0) > 0 && (
                <select
                  className={styles.select}
                  aria-label="Group"
                  value={group ?? ""}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="">All groups</option>
                  {[...(groups.data ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name} ({g.host_count})
                      </option>
                    ))}
                </select>
              )}
            </div>
            {hosts.isPending && <p className={common.soft}>Loading hosts…</p>}
            {hosts.isError && (
              <p className={common.soft}>{hosts.error.message}</p>
            )}
            {/* Only a search can fail to match; an empty source or group
                has nothing to match against, and says so. */}
            {hosts.isSuccess && matching.length === 0 && (
              <p className={common.soft}>
                {needle
                  ? "No host matches the search."
                  : group
                    ? `No hosts in ${group}.`
                    : "No hosts right now."}
              </p>
            )}
            {/* A listbox, framed like the fields above it: one focus stop,
                arrow keys move the selection, every row is an option. */}
            {shown.length > 0 && (
              <ul
                ref={list}
                className={styles.hostList}
                role="listbox"
                aria-label="Hosts"
                aria-activedescendant={
                  selected && shown.includes(selected)
                    ? optionId(selected)
                    : undefined
                }
                tabIndex={shown.length > 0 ? 0 : -1}
                onKeyDown={(e) => {
                  const at = selected ? shown.indexOf(selected) : -1;
                  const next =
                    e.key === "ArrowDown"
                      ? Math.min(shown.length - 1, at + 1)
                      : e.key === "ArrowUp"
                        ? Math.max(0, at - 1)
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? shown.length - 1
                            : null;
                  if (next === null || shown.length === 0) return;
                  e.preventDefault();
                  select(shown[next]);
                }}
              >
                {shown.map((host) => (
                  <li
                    key={host}
                    id={optionId(host)}
                    role="option"
                    aria-selected={host === selected}
                    className={styles.hostOption}
                    onClick={() => select(host)}
                    title={host}
                  >
                    {host}
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={current}
              pageSize={pageSize}
              total={matching.length}
              onPage={setPage}
              onPageSize={setPageSize}
              noun="hosts"
            />
          </div>
        </div>
      </Panel>
      <Panel className={styles.varsCard}>
        <div ref={varsTop} />
        {selected ? (
          <HostVars id={id} host={selected} />
        ) : hosts.isSuccess && hosts.data.hosts.length === 0 ? (
          // Nothing to pick: say why there is nothing, not "pick one".
          <EmptyState title="No hosts to show">
            {group
              ? "This group holds no hosts right now."
              : "This source holds no hosts right now. They appear here after a sync that brings some."}
          </EmptyState>
        ) : (
          <EmptyState title="No host selected">
            Pick one on the left.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

// "1 variable", "47 variables": the noun agrees with the number.
const count = (n: number, noun: string) =>
  `${n.toLocaleString()} ${n === 1 ? noun : `${noun}s`}`;

// Host names hold dots, which an id may, but nothing else odd: kept as is
// behind a prefix so a listbox option can be pointed at.
const optionId = (host: string) => `host-option-${host}`;

function HostVars({ id, host }: { id: string; host: string }) {
  const vars = useHostVars(id, host);
  const [query, setQuery] = useState("");

  const [format, setFormat] = useFormat();

  // Filtered by variable name, then sorted, so the document reads the same
  // way on every host.
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(vars.data ?? {})
          .filter(
            ([key]) => needle === "" || key.toLowerCase().includes(needle),
          )
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    [vars.data, needle],
  );
  const shownCount = Object.keys(shown).length;

  return (
    <>
      <div className={styles.columnHead}>
        <h3 className={styles.hostName} title={host}>
          {host}
        </h3>
        {vars.data && (
          <span className={styles.varCount}>
            {needle
              ? `${shownCount} of ${count(Object.keys(vars.data).length, "variable")}`
              : count(Object.keys(vars.data).length, "variable")}
          </span>
        )}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.varsSearch}>
          <SearchField
            label="Search variables"
            placeholder="Search variables"
            value={query}
            onChange={setQuery}
            size="compact"
          />
        </div>
        <FormatSwitch value={format} onChange={setFormat} />
        <CopyButton
          text={
            vars.data && shownCount > 0 ? serialize(shown, format) : undefined
          }
        />
      </div>
      {vars.isPending && <p className={common.soft}>Loading variables…</p>}
      {vars.isError && <p className={common.soft}>{vars.error.message}</p>}
      {vars.isSuccess && shownCount === 0 && (
        <p className={common.soft}>
          {needle ? "No variable matches." : "This host has no variables."}
        </p>
      )}
      {shownCount > 0 && <CodeView value={shown} format={format} />}
    </>
  );
}
