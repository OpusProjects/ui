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

// The time now, in milliseconds, updated every second.
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}

// An age that keeps counting while the page is open: "2m 13s ago", a second
// later "2m 14s ago", instead of waiting for the next poll to move.
//
// `seconds` is an age the API measured (the `*_age_seconds` fields): it is
// counted on from when this value arrived. `since` is a moment (unix
// seconds), counted from directly. Neither: "never", as formatAge says it.
export function LiveAge({
  seconds,
  since,
}: {
  seconds?: number | null;
  since?: number | null;
}) {
  const current = useNow();
  const arrived = useRef({ seconds, at: Date.now() });
  if (arrived.current.seconds !== seconds)
    arrived.current = { seconds, at: Date.now() };

  if (since != null)
    return <>{formatAge(Math.max(0, current / 1000 - since))}</>;
  if (seconds == null) return <>{formatAge(seconds)}</>;
  return (
    <>{formatAge(seconds + Math.max(0, current - arrived.current.at) / 1000)}</>
  );
}
