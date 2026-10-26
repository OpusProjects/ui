import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  EmptyState,
  Fact,
  FreshnessMeter,
  HealthPill,
  LiveAge,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  SkeletonSummary,
  formatBytes,
  formatEvery,
  formatSpan,
  usePagination,
  CodeView,
  LinesView,
  CopyButton,
  FormatSwitch,
  SegmentedSwitch,
  serialize,
  useFormat,
} from "@opusprojects/unified-ui";
import { ValueList } from "@opusprojects/unified-ui";
import { cachedHealth } from "@opusprojects/unified-client";
import { api, unwrap } from "../../api/client";
import {
  useHostVars,
  useSourceDetail,
  useSourceGroups,
  useSourceGroup,
  useSourceHosts,
} from "../../api/queries";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import { RunButton } from "@opusprojects/unified-ui";
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
      label="Sync"
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
// their key in the source's item file, which is where they are changed.
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
    "connector. The connector this source syncs through, and its type: script runs a program, ssh runs commands on each host; the built-ins static_inventory reads an Ansible inventory file and remote copies a source from another instance. Opens the connector's page.",
  "Remote source":
    "config.source. For a remote source, the id of the source it copies on the other instance.",
  "Remote instance":
    "config.url. The unified-api instance this source pulls from, named as on the Topology page. Opens it.",
  Script:
    "path. What the connector runs, or the inventory file a static inventory reads, inside the project's git checkout.",
  Project:
    "project. The git project that holds the script (named by the connector) or, for a static inventory, the inventory file.",
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
    "credentials. The credentials the connector is given; each opens its page. Names only: their secrets are never shown.",
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
      hint="What this source is, where its data comes from, how fresh it is, and how its last syncs went."
      aside={
        <HealthPill
          state={state}
          detail={failures > 1 ? `${failures} in a row` : undefined}
        />
      }
    >
      {/* Five rows of three, by theme: what is cached, how current it is
          (both measured), then the settings, labelled after their keys in
          the source's item file so the person who writes it knows which key to
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
              <span>
                <LiveAge seconds={detail.age_seconds} />
              </span>
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
              <LiveAge seconds={detail.sync_health?.last_attempt_age_seconds} />
            </Fact>
            {/* Not the same as "Data from": a remote source passes on its
                origin's age, so old data with a recent success means the
                staleness is upstream, not here. */}
            <Fact label="Last success" hint={HINTS["Last success"]}>
              {detail.sync_health?.last_success_age_seconds != null ? (
                <LiveAge
                  seconds={detail.sync_health.last_success_age_seconds}
                />
              ) : (
                "Never"
              )}
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
              <ValueList
                values={gathering.credential_ids.map((id) => (
                  <Link
                    key={id}
                    className={common.link}
                    to={`/credentials/${encodeURIComponent(id)}`}
                    title={id}
                  >
                    {id}
                  </Link>
                ))}
              />
            </Fact>

            <Fact label="Connector" hint={HINTS["Connector"]}>
              <span className={common.clipText}>
                <Link
                  className={common.link}
                  to={`/connectors/${encodeURIComponent(gathering.connector)}`}
                >
                  {gathering.connector}
                </Link>{" "}
                ({gathering.connector_type})
              </span>
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
                  {gathering.project_id ? (
                    <Link
                      className={common.link}
                      to={`/projects/${encodeURIComponent(gathering.project_id)}`}
                    >
                      {gathering.project_id}
                    </Link>
                  ) : gathering.connector_type === "ssh" ? (
                    "None (runs on each host)"
                  ) : (
                    "None (local file)"
                  )}
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

// The source's contents, a list on the left and the selected item's
// variables on the right: its hosts, or (switched) its groups. Which list,
// and which item, are in the address (?list=groups&group=linux).
function HostBrowser({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const mode: "hosts" | "groups" =
    params.get("list") === "groups" ? "groups" : "hosts";
  const key = mode === "hosts" ? "host" : "group";
  const noun = mode === "hosts" ? "host" : "group";
  const selected = params.get(key);
  const [query, setQuery] = useState("");

  const groups = useSourceGroups(id);
  const hosts = useSourceHosts(id, null);
  const names = useMemo(
    () =>
      mode === "hosts"
        ? (hosts.data?.hosts ?? [])
        : (groups.data ?? []).map((g) => g.name).sort(),
    [mode, hosts.data, groups.data],
  );
  const loading = mode === "hosts" ? hosts : groups;

  const needle = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      names.filter((n) => needle === "" || n.toLowerCase().includes(needle)),
    [names, needle],
  );
  // The page lives in the address (?hosts-page=3), so a link opens it. Sized
  // for the window, not for where the list first appears: it is sticky, so
  // while the variables scroll it has the full height less the search above
  // it and the pager below (~120px). Rows measure 28px. The page is held
  // within the list as a sync or a refetch shrinks it.
  const { shown, pager } = usePagination(matching, `source-${mode}`, {
    url: mode,
    rowHeight: 28,
    reserved: 120,
  });
  const { pageSize, onPage: setPage } = pager;

  // A new search starts at the first page; arriving does not, or a shared
  // link's page would be lost.
  const filtered = useRef(needle);
  useEffect(() => {
    const before = filtered.current;
    filtered.current = needle;
    if (before !== needle) setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

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
      ? document.getElementById(optionId(mode, selected))
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

  // Something to look at straight away: the first host on the page shown,
  // unless the URL already names one. On the page shown, not the list's
  // first: a link to page 3 must stay on page 3.
  useEffect(() => {
    if (!selected && shown.length > 0) {
      setParams(
        (p) => {
          p.set(key, shown[0]);
          return p;
        },
        { replace: true },
      );
    }
  }, [selected, shown, key, setParams]);

  const select = (name: string) =>
    setParams((p) => {
      p.set(key, name);
      return p;
    });
  // Each list keeps its own selection, so switching back returns to it.
  const setMode = (next: "hosts" | "groups") =>
    setParams((p) => {
      if (next === "groups") p.set("list", "groups");
      else p.delete("list");
      return p;
    });

  return (
    <div className={styles.browser}>
      <Panel className={styles.hostCard}>
        <div>
          {/* Each column opens with its own heading, on one line: "Hosts" on
              the left, the selected host on the right. */}
          <div className={styles.columnHead}>
            <h2 className={styles.columnTitle}>
              {mode === "hosts" ? "Hosts" : "Groups"}
            </h2>
            {loading.isSuccess && (
              <span className={styles.varCount}>
                {needle
                  ? `${matching.length.toLocaleString()} of ${count(names.length, noun)}`
                  : count(names.length, noun)}
              </span>
            )}
          </div>
          {/* From the search down: what stays in view while the variables
              scroll; the heading above scrolls away with the page. */}
          <div className={styles.hostSticky}>
            <div className={styles.toolbar}>
              <SearchField
                label={`Search ${mode}`}
                placeholder={`Search ${mode}`}
                value={query}
                onChange={setQuery}
                size="compact"
              />
              <SegmentedSwitch
                label="Show"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "hosts", label: "Hosts" },
                  { value: "groups", label: "Groups" },
                ]}
              />
            </div>
            {loading.isPending && (
              <p className={common.soft}>Loading {mode}…</p>
            )}
            {loading.isError && (
              <p className={common.soft}>{loading.error.message}</p>
            )}
            {/* Only a search can fail to match; an empty source or group
                has nothing to match against, and says so. */}
            {loading.isSuccess && matching.length === 0 && (
              <p className={common.soft}>
                {needle
                  ? `No ${noun} matches the search.`
                  : `No ${mode} right now.`}
              </p>
            )}
            {/* A listbox, framed like the fields above it: one focus stop,
                arrow keys move the selection, every row is an option. */}
            {shown.length > 0 && (
              <ul
                ref={list}
                className={styles.hostList}
                role="listbox"
                aria-label={mode === "hosts" ? "Hosts" : "Groups"}
                aria-activedescendant={
                  selected && shown.includes(selected)
                    ? optionId(mode, selected)
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
                {shown.map((name) => (
                  <li
                    key={name}
                    id={optionId(mode, name)}
                    role="option"
                    aria-selected={name === selected}
                    className={styles.hostOption}
                    onClick={() => select(name)}
                    title={name}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
            <Pagination {...pager} noun={mode} />
          </div>
        </div>
      </Panel>
      <Panel className={styles.varsCard}>
        <div ref={varsTop} />
        {selected ? (
          mode === "hosts" ? (
            <HostVars id={id} host={selected} />
          ) : (
            <GroupVars id={id} group={selected} />
          )
        ) : loading.isSuccess && names.length === 0 ? (
          // Nothing to pick: say why there is nothing, not "pick one".
          <EmptyState title={`No ${mode} to show`}>
            {mode === "hosts"
              ? "This source holds no hosts right now. They appear here after a sync that brings some."
              : "This source has no groups right now."}
          </EmptyState>
        ) : (
          <EmptyState title={`No ${noun} selected`}>
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
const optionId = (list: string, name: string) => `${list}-option-${name}`;

function HostVars({ id, host }: { id: string; host: string }) {
  const vars = useHostVars(id, host);
  return (
    <VarsPanel
      title={host}
      vars={vars.data}
      loading={vars.isPending}
      error={vars.isError ? vars.error.message : null}
      none="This host has no variables."
    />
  );
}

// A group's own variables (not its hosts'), its size, and its hosts: the
// same ones the size counts, directly in the group, not its children's.
function GroupVars({ id, group }: { id: string; group: string }) {
  const detail = useSourceGroup(id, group);
  const hosts = useSourceHosts(id, group);
  return (
    <VarsPanel
      title={group}
      vars={detail.data?.vars as Record<string, unknown> | undefined}
      loading={detail.isPending}
      error={detail.isError ? detail.error.message : null}
      extra={detail.data ? count(detail.data.host_count, "host") : undefined}
      none="This group has no variables of its own."
      hosts={{
        names: hosts.data?.hosts,
        loading: hosts.isPending,
        error: hosts.isError ? hosts.error.message : null,
      }}
    />
  );
}

// The right-hand card: a host's or a group's variables, searchable by
// name, in YAML or JSON, ready to copy. A group's card can show its hosts
// instead, one per line.
function VarsPanel({
  title,
  vars,
  loading,
  error,
  extra,
  none,
  hosts,
}: {
  title: string;
  vars: Record<string, unknown> | undefined;
  loading: boolean;
  error: string | null;
  // More after the variable count: "4 hosts".
  extra?: string;
  // What an item with no variables says.
  none: string;
  // A group's hosts, for the Hosts | Variables switch; absent on a host.
  hosts?: { names?: string[]; loading: boolean; error: string | null };
}) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useFormat();
  const [view, setView] = useState<"variables" | "hosts">("variables");
  const showHosts = hosts !== undefined && view === "hosts";

  // Filtered by variable name, then sorted, so the document reads the same
  // way on every item.
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(vars ?? {})
          .filter(
            ([key]) => needle === "" || key.toLowerCase().includes(needle),
          )
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    [vars, needle],
  );
  const shownCount = Object.keys(shown).length;
  // The hosts, by the same search, sorted like the lists on the left.
  const shownHosts = useMemo(
    () =>
      (hosts?.names ?? [])
        .filter((name) => needle === "" || name.toLowerCase().includes(needle))
        .sort(),
    [hosts?.names, needle],
  );
  const what = showHosts ? "hosts" : "variables";
  const copyText = showHosts
    ? hosts.names && shownHosts.length > 0
      ? `${shownHosts.join("\n")}\n`
      : undefined
    : vars && shownCount > 0
      ? serialize(shown, format)
      : undefined;

  return (
    <>
      <div className={styles.columnHead}>
        <h3 className={styles.hostName} title={title}>
          {title}
        </h3>
        {vars && (
          <span className={styles.varCount}>
            {needle
              ? `${shownCount} of ${count(Object.keys(vars).length, "variable")}`
              : count(Object.keys(vars).length, "variable")}
            {extra && `, ${extra}`}
          </span>
        )}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.varsSearch}>
          <SearchField
            label={`Search ${what}`}
            placeholder={`Search ${what}`}
            value={query}
            onChange={setQuery}
            size="compact"
          />
        </div>
        {/* A list of names has no format: the switch stays, set aside. */}
        <FormatSwitch
          value={format}
          onChange={setFormat}
          disabled={showHosts}
        />
        {hosts && (
          <SegmentedSwitch
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "hosts", label: "Hosts" },
              { value: "variables", label: "Variables" },
            ]}
          />
        )}
        <CopyButton text={copyText} />
      </div>
      {showHosts ? (
        <>
          {hosts.loading && <p className={common.soft}>Loading hosts…</p>}
          {hosts.error && <p className={common.soft}>{hosts.error}</p>}
          {hosts.names && shownHosts.length === 0 && (
            <p className={common.soft}>
              {needle
                ? "No host matches."
                : "This group has no hosts of its own."}
            </p>
          )}
          {shownHosts.length > 0 && (
            <LinesView lines={shownHosts} label="Hosts" />
          )}
        </>
      ) : (
        <>
          {loading && <p className={common.soft}>Loading variables…</p>}
          {error && <p className={common.soft}>{error}</p>}
          {vars && shownCount === 0 && (
            <p className={common.soft}>
              {needle ? "No variable matches." : none}
            </p>
          )}
          {shownCount > 0 && <CodeView value={shown} format={format} />}
        </>
      )}
    </>
  );
}
