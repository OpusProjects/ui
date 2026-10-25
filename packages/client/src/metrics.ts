import { useEffect, useSyncExternalStore } from "react";
import { parseExposition, type Scrape } from "./prometheus";

// /metrics is a snapshot: counters since the process started, gauges as of
// now. Rates and charts need history, and the service keeps none (that is
// Prometheus's job), so the page keeps its own while the app is open: one
// scrape every ten seconds, the last half hour, in memory. Module level
// rather than component state, so leaving the Metrics page and coming back
// does not start the history over.

const INTERVAL_MS = 10_000;
const KEEP = 180; // 30 minutes at 10 s

let scrapes: Scrape[] = [];
let error = null as string | null;
let timer: number | undefined;
let subscribers = 0;
const listeners = new Set<() => void>();

// A new object only when something changed, as useSyncExternalStore needs.
let snapshot: { scrapes: Scrape[]; error: string | null } = { scrapes, error };

function publish() {
  snapshot = { scrapes, error };
  listeners.forEach((listener) => listener());
}

// A scrape slower than the interval must not overlap the next one: two in
// flight can land out of order, and a later sample stored before an earlier
// one reads as time running backwards.
let inFlight = false;

async function scrape() {
  if (inFlight) return;
  inFlight = true;
  // Stamped when asked, not when answered: the counters are as of the
  // request, and a slow answer would otherwise stretch the interval the
  // rate divides by.
  const at = Date.now();
  try {
    const response = await fetch("/metrics", {
      headers: { Accept: "text/plain" },
    });
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    const samples = parseExposition(await response.text());
    scrapes = [...scrapes, { at, samples }].slice(-KEEP);
    error = null;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    inFlight = false;
  }
  publish();
}

// Started by the app shell, so the history covers the whole visit.
export function useMetricsSampler() {
  useEffect(() => {
    subscribers += 1;
    if (subscribers === 1) {
      void scrape();
      timer = window.setInterval(scrape, INTERVAL_MS);
    }
    return () => {
      subscribers -= 1;
      if (subscribers === 0) window.clearInterval(timer);
    };
  }, []);
}

export function useMetrics() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}
