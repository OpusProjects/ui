import {
  ChipList,
  EmptyState,
  Fact,
  HealthSummary,
  LiveAge,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonSummary,
  Tree,
  countStates,
  type TreeItem,
} from "@opusprojects/unified-ui";
import type { HealthState } from "@opusprojects/unified-client";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import type { Schemas } from "../../api/client";
import {
  useEndpoints,
  useFederation,
  useSourceList,
  useSources,
  useTopology,
} from "../../api/queries";
import { instanceName } from "../../shared/instances";
import {
  PEER_LABELS,
  allPeers,
  federationView,
  peerState,
  peersOf,
  sameInstance,
  upstreamName,
  type FederationView,
} from "./model";
import { ICONS } from "../../sections";
import { LiveSpan, pageStyles as styles } from "@opusprojects/unified-ui";

type Peer = Schemas["Peer"];
type Federation = Schemas["Federation"];

// The instance above pushes its map every minute; three missed pushes and
// the page says the picture may be out of date.
const PUSH_STALE_SECONDS = 180;

// A source chip as a link to that source's page here; `label` when the chip
// shows another name for it (the id it has on a peer).
function sourceLink(id: string, className: string, label = id) {
  return (
    <Link
      to={`/sources/${encodeURIComponent(id)}`}
      className={className}
      title={label === id ? undefined : `Mirrored here as ${id}`}
    >
      {label}
    </Link>
  );
}

export function TopologyPage() {
  const topology = useTopology();
  // Settled before drawing, so an edge does not flash its own empty map and
  // then swap to the federation's.
  const federation = useFederation();

  return (
    <>
      <PageHeader
        icon={ICONS.topology}
        title="Topology"
        description="This instance and the instances it is connected to, if any."
      />
      {(topology.isPending || federation.isPending) && <SkeletonSummary />}
      {topology.isError && (
        <Notice title="Could not load the topology">
          {topology.error.message}
        </Notice>
      )}
      {topology.isSuccess && !federation.isPending && (
        <TopologyContent
          view={federationView(
            topology.data,
            federation.data,
            topology.dataUpdatedAt,
            federation.dataUpdatedAt,
          )}
          version={topology.data.version}
        />
      )}
    </>
  );
}

function TopologyContent({
  view,
  version,
}: {
  view: FederationView;
  // This instance's version, which every other one is compared with.
  version: string;
}) {
  const topology = view.topology;
  const peers = allPeers(view);
  const sourceList = useSourceList();
  // Which endpoints read which sources: a peer's card says how many of them
  // depend on what it provides, i.e. what breaks for consumers if it goes.
  const endpoints = useEndpoints().data ?? [];
  // Seen from here, a peer's sources are mirrored by this instance's remote
  // sources and its endpoints depend on them. On a pushed map neither holds:
  // the root's sources are not this instance's.
  const item = (peer: Peer) =>
    peerItem(peer, view.upstream ? [] : endpoints, version, view);
  // The same facts as a peer card, from this instance's own sources (views
  // left out: they hold no data of their own).
  const ownSources = (sourceList.data ?? []).filter((s) => s.kind === "source");
  const ownHosts = ownSources.reduce((n, s) => n + (s.total_hosts ?? 0), 0);
  // Groups come with each source's detail, not the list: the same
  // per-source details the Sources page loads, shared through the cache.
  const sourceRows = useSources().rows;
  const ownGroups = sourceRows
    .filter((r) => r.summary.kind === "source")
    .reduce((n, r) => n + (r.detail?.total_groups ?? 0), 0);
  const ownAges = ownSources.flatMap((s) =>
    s.age_seconds == null ? [] : [s.age_seconds],
  );
  // The page measures links, not health: this instance is connected while
  // at least one of its peers answers.
  // The root of the map, as the summary counts it: this instance, which is
  // the one answering; or, on a map pushed from above, that instance, as
  // its own card judges it (unreachable once its pushes stop).
  const rootState: HealthState = view.upstream
    ? view.upstream.age_seconds > PUSH_STALE_SECONDS
      ? "failing"
      : "fresh"
    : "fresh";
  const selfState: HealthState = peersOf(topology).some(
    (p) => peerState(p) !== "failing",
  )
    ? "fresh"
    : "failing";

  const root: TreeItem = {
    key: "self",
    node: view.upstream ? (
      <UpstreamCard
        federation={view.upstream}
        version={version}
        measuredAt={view.measuredAt}
      />
    ) : (
      <ResourceCard
        // Named like its peers, from the address this page is served from:
        // the tree starting here is what says it is this instance.
        title={topology.name ?? instanceName(window.location.origin)}
        state={selfState}
        // This instance cannot be unreachable from itself: it is cut off.
        labels={{ fresh: "Connected", failing: "Disconnected" }}
      >
        <Fact label="URL">
          <InstanceLink url={window.location.origin} />
        </Fact>
        <Fact label="Version">{topology.version}</Fact>
        <Fact label="Provides">
          {/* One line while the cards sit side by side (they are as wide as
              their widest line); wrapped when the tree stacks on a narrow
              screen, rather than pushing the page sideways. */}
          <span>
            {provides(ownSources.length, ownHosts, ownGroups, endpoints.length)}
          </span>
        </Fact>
        {ownAges.length > 0 && (
          <Fact label="Oldest data">
            <LiveSpan
              seconds={Math.max(...ownAges)}
              at={sourceList.dataUpdatedAt}
              ago
            />
          </Fact>
        )}
        <Fact label="Sources">
          {/* Sized by the text above, not by the chips: they wrap instead. */}
          <div className={styles.fitWidth}>
            <ChipList
              items={ownSources.map((s) => s.source_id).sort()}
              limit="line"
              linkTo={sourceLink}
            />
          </div>
        </Fact>
      </ResourceCard>
    ),
    children: peersOf(topology).map(item),
  };

  return (
    <>
      {/* One card, as every other section opens: how many instances are
          connected, this one included, and always counted as connected (it
          is the one answering; its own card says if it is cut off). None
          without peers: "No peers" below says it. Counts only: the tree has
          nothing to filter. */}
      {peers.length > 0 && (
        <HealthSummary
          counts={countStates([rootState, ...peers.map(peerState)], (s) => s)}
          noun={["instance", "instances"]}
          labels={PEER_LABELS}
          good="connected"
        />
      )}

      {view.upstream && view.upstream.age_seconds > PUSH_STALE_SECONDS && (
        <Notice tone="stale" title="This map may be out of date">
          {upstreamName(view.upstream)} last sent it{" "}
          <LiveAge seconds={view.upstream.age_seconds} at={view.measuredAt} />;
          it sends one every minute.
        </Notice>
      )}
      {peersOf(topology).length === 0 ? (
        <EmptyState title="No peers">
          This instance pulls from no other instance: every source is gathered
          here.
        </EmptyState>
      ) : (
        <Tree root={root} label="Federation of unified-api instances" />
      )}
    </>
  );
}

// An instance's address as a fact row: the link colour and the open-in-a-
// new-tab icon, as the cards' other ways out; cut short if it is long, whole
// on hover.
// "30 sources, 1 host, 45 groups, 6 endpoints": what a card's instance
// provides, each count with its word in the right number.
function provides(
  sources: number,
  hosts: number,
  groups: number,
  // Unknown on a pushed map: the endpoints there are the root's, not ours.
  endpoints?: number,
) {
  const count = (n: number, word: string) =>
    `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
  return [
    count(sources, "source"),
    count(hosts, "host"),
    count(groups, "group"),
    ...(endpoints == null ? [] : [count(endpoints, "endpoint")]),
  ].join(", ");
}

function InstanceLink({ url }: { url: string }) {
  return (
    <a
      className={styles.instanceLink}
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
    >
      <span>{url}</span>
      <ExternalLink aria-hidden />
    </a>
  );
}

function peerItem(
  peer: Peer,
  endpoints: Schemas["EndpointInfo"][],
  selfVersion: string,
  view: FederationView,
  // A direct peer of the root. Drawn from here, its sources are mirrored by
  // remote sources with a page each; a peer's peer is not, so its chips stay
  // plain.
  direct = true,
): TreeItem {
  const isSelf = view.self != null && sameInstance(peer.url, view.self);
  const fed = new Set(peer.sources.map((s) => s.source_id));
  const feeding = endpoints.filter((e) =>
    e.source_ids.some((id) => fed.has(id)),
  ).length;
  const state = peerState(peer);
  const hosts = peer.sources.reduce((n, s) => n + (s.hosts ?? 0), 0);
  const groups = peer.sources.reduce((n, s) => n + (s.groups ?? 0), 0);
  const ages = peer.sources.flatMap((s) =>
    s.age_seconds == null ? [] : [s.age_seconds],
  );
  const failing = peer.sources.filter((s) => s.consecutive_failures > 0);
  // When data last moved along this link: its sources' latest good pull.
  const pulled = peer.sources.flatMap((s) =>
    s.last_pull_age_seconds == null ? [] : [s.last_pull_age_seconds],
  );
  const instance = peer.instance;

  return {
    key: peer.url,
    // Red when the peer is unreachable (see peerState).
    link: state === "failing" ? "failing" : "ok",
    // A dot runs along the line each time a pull lands (Tree).
    pulse:
      pulled.length > 0
        ? view.measuredAt - Math.min(...pulled) * 1000
        : undefined,
    node: (
      <ResourceCard
        title={
          isSelf
            ? `${peer.instance?.name ?? instanceName(peer.url)} (this instance)`
            : (peer.instance?.name ?? instanceName(peer.url))
        }
        state={state}
        labels={PEER_LABELS}
        error={
          // The card's URL row already says where: the request's address in
          // an error only makes it long.
          withoutUrls(
            peer.error ??
              (failing.length > 0
                ? `${failing[0].source_id}: ${failing[0].last_error ?? "failing"}`
                : undefined),
          )
        }
      >
        <Fact label="URL">
          <InstanceLink url={peer.url} />
        </Fact>
        {instance && (
          <Fact label="Version">
            <VersionText version={instance.version} self={selfVersion} />
          </Fact>
        )}
        <Fact label="Provides">
          {provides(
            peer.sources.length,
            hosts,
            groups,
            view.upstream ? undefined : feeding,
          )}
        </Fact>
        {ages.length > 0 && (
          <Fact label="Oldest data">
            <LiveSpan seconds={Math.max(...ages)} at={view.measuredAt} ago />
          </Fact>
        )}
        <Fact label="Sources">
          {/* Sized by the text above, not by the chips: one line of them,
              the rest behind +N more. */}
          <div className={styles.fitWidth}>
            <ChipList
              items={[...new Set(peer.sources.map((s) => s.remote_source))]}
              limit="line"
              // The chip names the source on the peer; it opens the source
              // here that mirrors it (src-kvm on dc01 opens
              // src-edge-dc01-kvm).
              linkTo={
                // This instance's own sources, as the root names them.
                isSelf
                  ? (remote, className) => sourceLink(remote, className)
                  : direct && !view.upstream
                    ? (remote, className) => {
                        const local = peer.sources
                          .filter((s) => s.remote_source === remote)
                          .map((s) => s.source_id)
                          .sort()[0];
                        return local
                          ? sourceLink(local, className, remote)
                          : undefined;
                      }
                    : undefined
              }
            />
          </div>
        </Fact>
      </ResourceCard>
    ),
    // A peer's own peers are behind its sources, not this instance's
    // endpoints: the count above only applies one level down.
    children: instance
      ? peersOf(instance).map((p) => peerItem(p, [], selfVersion, view, false))
      : undefined,
  };
}

// The root of a pushed map: the instance above, known here by the key it uses,
// what it said about itself, and its address when its server.url declares one.
function UpstreamCard({
  federation,
  version,
  measuredAt,
}: {
  federation: Federation;
  version: string;
  // When its ages were measured (ms since the epoch), for the live counts.
  measuredAt: number;
}) {
  const sender = federation.sender;
  const url = federation.sender_url;
  return (
    <ResourceCard
      // Named as its own page names itself, from its address; by the key it
      // pushes with when it does not declare one.
      title={
        federation.topology.name ??
        (url ? instanceName(url) : upstreamName(federation))
      }
      state={federation.age_seconds > PUSH_STALE_SECONDS ? "failing" : "fresh"}
      labels={PEER_LABELS}
    >
      {url && (
        <Fact label="URL">
          <InstanceLink url={url} />
        </Fact>
      )}
      <Fact label="Version">
        <VersionText version={federation.topology.version} self={version} />
      </Fact>
      <Fact label="Provides">
        <span>
          {provides(
            sender.sources.length,
            sender.hosts,
            sender.groups,
            sender.endpoints,
          )}
        </span>
      </Fact>
      {sender.oldest_age_seconds != null && (
        <Fact label="Oldest data">
          <LiveSpan seconds={sender.oldest_age_seconds} at={measuredAt} ago />
        </Fact>
      )}
      <Fact label="Sources">
        <div className={styles.fitWidth}>
          <ChipList
            items={sender.sources}
            limit="line"
            // Its sources' pages are on its own UI, when its address is known.
            linkTo={
              url
                ? (id, className) => (
                    <a
                      className={className}
                      href={`${url}/sources/${encodeURIComponent(id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {id}
                    </a>
                  )
                : undefined
            }
          />
        </div>
      </Fact>
    </ResourceCard>
  );
}

// A peer's version, in amber with this instance's beside it when they differ:
// mixed versions work, but are the first thing to rule out when one acts up.
function VersionText({ version, self }: { version: string; self: string }) {
  return version === self ? (
    <>{version}</>
  ) : (
    <span className={styles.warnText}>
      {version} (this instance runs {self})
    </span>
  );
}

// An error as a card shows it: quoted addresses taken out ("'http://...'
// answered 404" becomes "answered 404"), since the card names the instance.
function withoutUrls(error: string | undefined) {
  return error?.replace(/'https?:\/\/[^']*'\s*/g, "");
}
