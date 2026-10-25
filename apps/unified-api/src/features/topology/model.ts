import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

type Topology = Schemas["Topology"];
type Peer = Schemas["Peer"];

// What a peer's state means (Topology, Overview): whether it could be asked, and
// whether the sources reading from it are keeping up.
export const PEER_LABELS = {
  fresh: "Healthy",
  stale: "Pulls failing",
  failing: "Unreachable",
  pending: "Waiting for data",
};

export function peerState(peer: Peer): HealthState {
  if (peer.error && !peer.error.startsWith("not asked")) return "failing";
  if (peer.sources.some((s) => s.consecutive_failures > 0)) return "stale";
  if (peer.sources.some((s) => !s.cached)) return "pending";
  return "fresh";
}

// Optional in the schema (an old peer may omit it): no list is no peers.
export const peersOf = (topology: Topology): Peer[] => topology.peers ?? [];

// Every instance reachable from this one, each once. Federations can loop
// (two instances reading from each other) or meet (two edges reading from
// the same third), so the same address can turn up more than once, this
// instance's own included; counted once, nearest first, and never this one.
export function allPeers(topology: Topology): Peer[] {
  const self = window.location.origin.replace(/\/$/, "");
  const seen = new Set<string>([self]);
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
