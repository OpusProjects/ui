import { useRef, useSyncExternalStore } from "react";
import { formatAge } from "../lib/format";

// One clock for every live time on the page: a single interval however many
// are shown, started by the first and stopped with the last.
const listeners = new Set<() => void>();
let timer: number | undefined;
let now = Date.now();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

// While no clock runs (nothing live on the page yet), the time now, to the
// second: a value that holds still between React's reads of it, as a
// snapshot must, but is never minutes old on the first frame.
const snapshot = () =>
  timer === undefined ? Math.floor(Date.now() / 1000) * 1000 : now;

// The time now, in milliseconds, updated every second.
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// An age the API measured, counted on every second: `seconds` as measured
// at `at` (a query's dataUpdatedAt), or failing that from when this value
// first showed. Pass `at`: without it, two answers carrying the same age (0
// after one sync, 0 again after the next) look like one, and the count runs
// on from the first. What LiveAge shows, and what a meter of the same age
// fills to, so the two never disagree.
export function useLiveSeconds(
  seconds: number | null | undefined,
  at?: number,
): number | null | undefined {
  const current = useNow();
  const arrived = useRef({ seconds, at: at ?? Date.now() });
  if (
    arrived.current.seconds !== seconds ||
    (at != null && arrived.current.at !== at)
  )
    arrived.current = { seconds, at: at ?? Date.now() };
  if (seconds == null) return seconds;
  return seconds + Math.max(0, current - arrived.current.at) / 1000;
}

// An age that keeps counting while the page is open: "2m 13s ago", a second
// later "2m 14s ago", instead of waiting for the next poll to move.
//
// `seconds` is an age the API measured (the `*_age_seconds` fields): it is
// counted on from `at`, when it was measured (a query's dataUpdatedAt), or
// failing that from when this value first showed. `since` is a moment (unix
// seconds), counted from directly. Neither: "never", as formatAge says it.
export function LiveAge({
  seconds,
  since,
  at,
}: {
  seconds?: number | null;
  since?: number | null;
  at?: number;
}) {
  const current = useNow();
  const live = useLiveSeconds(seconds, at);
  if (since != null)
    return <>{formatAge(Math.max(0, current / 1000 - since))}</>;
  return <>{formatAge(live)}</>;
}
