import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

type Topology = Schemas["Topology"];
type Peer = Schemas["Peer"];
type Federation = Schemas["Federation"];

// The federation as this page draws it. Normally from here, with this
// instance at the root. On an edge, which reads from nobody, from the map
// the instance above pushed: that instance at the root (named after the key
// it uses here: key-central reads "central"), this one among its peers.
export interface FederationView {
  topology: Topology;
  // When the ages in `topology` were measured (ms since the epoch): when the
  // map was fetched, less the map's own age when it was pushed here.
  measuredAt: number;
  // This instance's address as the map spells it; null when it is the root.
  self: string | null;
  upstream?: Federation;
}

export function federationView(
  topology: Topology,
  federations: Federation[] | undefined,
  // When each was fetched (ms since the epoch).
  fetchedAt = Date.now(),
  pushedFetchedAt = fetchedAt,
): FederationView {
  const pushed = federations?.[0];
  return pushed
    ? {
        topology: pushed.topology,
        self: pushed.url,
        upstream: pushed,
        measuredAt: pushedFetchedAt - pushed.age_seconds * 1000,
      }
    : { topology, self: null, measuredAt: fetchedAt };
}

export const upstreamName = (federation: Federation) =>
  federation.pushed_by.replace(/^key-/, "");

export const sameInstance = (a: string, b: string) =>
  a.replace(/\/$/, "") === b.replace(/\/$/, "");

// A peer is connected or it is not (Topology, Overview): the page measures
// links, not health. Unreachable covers a peer that cannot be asked and one
// whose data pulls fail, since either way nothing gets through.
export const PEER_LABELS = {
  fresh: "Connected",
  failing: "Unreachable",
};

export function peerState(peer: Peer): HealthState {
  if (peer.error && !peer.error.startsWith("not asked")) return "failing";
  if (peer.sources.some((s) => s.consecutive_failures > 0)) return "failing";
  return "fresh";
}

// Optional in the schema (an old peer may omit it): no list is no peers.
export const peersOf = (topology: Topology): Peer[] => topology.peers ?? [];

// Every instance reachable from this one, each once. Federations can loop
// (two instances reading from each other) or meet (two edges reading from
// the same third), so the same address can turn up more than once, this
// instance's own included; counted once, nearest first, and never this one.
export function allPeers(view: FederationView): Peer[] {
  const topology = view.topology;
  // The root is never a peer of itself; on a pushed map the root is the
  // instance above, whose address is not known here, and this one is a peer.
  const root = view.self ? null : window.location.origin.replace(/\/$/, "");
  const seen = new Set<string>(root ? [root] : []);
  const walk = (t: Topology): Peer[] =>
    peersOf(t).flatMap((peer) => {
      const url = peer.url.replace(/\/$/, "");
      if (seen.has(url)) return [];
      seen.add(url);
      return [peer];
    });
  // Breadth first: an instance met both directly and two hops away is
  // counted where it is nearest.
  const found: Peer[] = [];
  let level: Topology[] = [topology];
  while (level.length > 0) {
    const next: Topology[] = [];
    for (const t of level) {
      for (const peer of walk(t)) {
        found.push(peer);
        if (peer.instance) next.push(peer.instance);
      }
    }
    level = next;
  }
  return found;
}
