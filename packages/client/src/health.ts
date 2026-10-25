// The health vocabulary every unified-* API shares.
//
// Both unified-api and unified-gitops report periodic work through the same
// `sync_health` object; this module turns it into one of four states so every
// screen colors and words them identically.

export type HealthState = "fresh" | "stale" | "failing" | "pending";

export interface SyncHealth {
  last_attempt_age_seconds?: number | null;
  last_success_age_seconds?: number | null;
  last_error?: string | null;
  consecutive_failures: number;
}

export const HEALTH_LABEL: Record<HealthState, string> = {
  fresh: "Fresh",
  stale: "Stale",
  failing: "Failing",
  pending: "Waiting for first sync",
};

// Order used for summaries: the states that need a person first.
export const HEALTH_ORDER: HealthState[] = [
  "failing",
  "stale",
  "pending",
  "fresh",
];

// For something that holds data with a freshness window (a cached source).
// A failure outranks freshness: data can still be fresh while every new
// attempt fails, and that is the moment someone should look.
export function cachedHealth(
  cached: boolean,
  isFresh: boolean,
  syncHealth?: SyncHealth | null,
): HealthState {
  if (syncHealth && syncHealth.consecutive_failures > 0) return "failing";
  if (!cached) return "pending";
  return isFresh ? "fresh" : "stale";
}

// For periodic work that holds no data of its own (a git pull, an enricher):
// it either last succeeded, last failed, or has not run yet.
export function taskHealth(syncHealth?: SyncHealth | null): HealthState {
  if (!syncHealth) return "pending";
  if (syncHealth.consecutive_failures > 0) return "failing";
  return syncHealth.last_success_age_seconds == null ? "pending" : "fresh";
}
