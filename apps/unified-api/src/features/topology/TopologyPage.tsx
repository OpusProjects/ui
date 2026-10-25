import {
  ChipList,
  EmptyState,
  Fact,
  KpiRow,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonSummary,
  StatTile,
  Tree,
  formatAge,
  type TreeItem,
} from "@opusprojects/unified-ui";
import type { HealthState } from "@opusprojects/unified-client";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import type { Schemas } from "../../api/client";
import {
  useEndpoints,
  useSourceList,
  useSources,
  useTopology,
} from "../../api/queries";
import { instanceName } from "../../shared/instances";
import { PEER_LABELS, allPeers, peerState, peersOf } from "./model";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

type Topology = Schemas["Topology"];
type Peer = Schemas["Peer"];

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

  return (
    <>
      <PageHeader
        icon={ICONS.topology}
        title="Topology"
        description="This instance and the instances it is connected to, if any."
      />
      {topology.isPending && <SkeletonSummary />}
      {topology.isError && (
        <Notice title="Could not load the topology">
          {topology.error.message}
        </Notice>
      )}
      {topology.isSuccess && <TopologyContent topology={topology.data} />}
    </>
  );
}

function TopologyContent({ topology }: { topology: Topology }) {
  const peers = allPeers(topology);
  const reachable = peers.filter((p) => peerState(p) !== "failing").length;
  // This instance is judged like its peers: by whether its own sources keep
  // up. Until the list loads, healthy is assumed rather than flashing a
  // warning.
  const sourceList = useSourceList();
  // Which endpoints read which sources: a peer's card says how many of them
  // depend on what it provides, i.e. what breaks for consumers if it goes.
  const endpoints = useEndpoints().data ?? [];
  const item = (peer: Peer) =>
    peerItem(peer, endpoints, topology.version, true);
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
  const selfState: HealthState = (sourceList.data ?? []).some(
    (s) => (s.sync_health?.consecutive_failures ?? 0) > 0,
  )
    ? "stale"
    : "fresh";
  const federatedSources = peers.reduce((n, p) => n + p.sources.length, 0);
  const federatedHosts = peers.reduce(
    (n, p) => n + p.sources.reduce((m, s) => m + (s.hosts ?? 0), 0),
    0,
  );

  const root: TreeItem = {
    key: "self",
    node: (
      <ResourceCard
        // Named like its peers, from the address this page is served from:
        // the tree starting here is what says it is this instance.
        title={instanceName(window.location.origin)}
        tag={`v${topology.version}`}
        state={selfState}
        labels={{ fresh: "Healthy", stale: "Sources failing" }}
      >
        <Fact label="URL">
          <InstanceLink url={window.location.origin} />
        </Fact>
        <Fact label="Provides">
          {/* One line: the root card widens to fit it (see Tree's .node). */}
          <span className={styles.nowrap}>
            {provides(ownSources.length, ownHosts, ownGroups, endpoints.length)}
          </span>
        </Fact>
        {ownAges.length > 0 && (
          <Fact label="Oldest data">{formatAge(Math.max(...ownAges))}</Fact>
        )}
        <Fact label="Sources">
          {/* Sized by the text above, not by the chips: they wrap instead. */}
          <div className={styles.fitWidth}>
            <ChipList
              items={ownSources.map((s) => s.source_id).sort()}
              limit={3}
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
      <KpiRow>
        <StatTile
          label="Instances"
          value={String(peers.length + 1)}
          hint="This instance plus every peer found by following remote sources, two levels deep."
        />
        <StatTile
          label="Reachable"
          value={`${reachable} of ${peers.length}`}
          hint="Peers that answered when asked to describe themselves. One that did not still shows, with the reason."
        />
        <StatTile
          label="Federated sources"
          value={String(federatedSources)}
          hint="Remote sources: sources whose data is pulled from another unified-api instance rather than gathered here."
        />
        <StatTile
          label="Federated host entries"
          value={federatedHosts.toLocaleString()}
          hint="Hosts held by those remote sources, added up. A host in two of them counts twice."
        />
      </KpiRow>

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
  endpoints: number,
) {
  const count = (n: number, word: string) =>
    `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
  return [
    count(sources, "source"),
    count(hosts, "host"),
    count(groups, "group"),
    count(endpoints, "endpoint"),
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
  // A direct peer: its sources are mirrored here by remote sources, each with
  // a page. A peer's peer is not, so its chips stay plain.
  direct: boolean,
): TreeItem {
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
  const instance = peer.instance;

  return {
    key: peer.url,
    node: (
      <ResourceCard
        title={instanceName(peer.url)}
        tag={instance ? `v${instance.version}` : undefined}
        tagTone={
          instance && instance.version !== selfVersion ? "warning" : "neutral"
        }
        tagTitle={
          instance && instance.version !== selfVersion
            ? `Different version from this instance (v${selfVersion})`
            : undefined
        }
        state={state}
        labels={PEER_LABELS}
        error={
          peer.error ??
          (failing.length > 0
            ? `${failing[0].source_id}: ${failing[0].last_error ?? "failing"}`
            : undefined)
        }
      >
        <Fact label="URL">
          <InstanceLink url={peer.url} />
        </Fact>
        <Fact label="Provides">
          {provides(peer.sources.length, hosts, groups, feeding)}
        </Fact>
        {ages.length > 0 && (
          <Fact label="Oldest data">{formatAge(Math.max(...ages))}</Fact>
        )}
        <Fact label="Sources">
          <ChipList
            items={[...new Set(peer.sources.map((s) => s.remote_source))]}
            limit={3}
            // The chip names the source on the peer; it opens the source
            // here that mirrors it (src-kvm on dc01 opens
            // src-edge-dc01-kvm).
            linkTo={
              direct
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
        </Fact>
      </ResourceCard>
    ),
    // A peer's own peers are behind its sources, not this instance's
    // endpoints: the count above only applies one level down.
    children: instance
      ? peersOf(instance).map((p) => peerItem(p, [], selfVersion, false))
      : undefined,
  };
}
