import type { HealthState } from "@opusprojects/unified-client";
import { countOf, formatCount } from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../api/client";

export type Run = Schemas["Run"];
export type Step = Schemas["Step"];
type On = Schemas["On"];

// What an API item and a script item have alike: what they watch, when
// they run, and their last run.
export interface Action {
  name: string;
  enabled: boolean;
  on: On[];
  schedule?: string | null;
  paths: string[];
  ignore_paths: string[];
  labels: Record<string, string>;
  last?: Run | null;
}

// The same words as the other sections: working when its last run did,
// failing when it did not, idle until it has run. A disabled one never
// runs, which its pill says instead of "Idle".
export const LABELS = {
  fresh: "Working",
  failing: "Failing",
  pending: "Idle",
};

export const actionLabels = (a: Action) =>
  a.enabled ? LABELS : { ...LABELS, pending: "Disabled" };

export const actionState = (a: Action): HealthState =>
  !a.enabled || !a.last ? "pending" : a.last.ok ? "fresh" : "failing";

// What can start a run, in the order a reader thinks of them.
const ON_WORDS: Record<On, string> = {
  change: "A change",
  startup: "Start-up",
  schedule: "Schedule",
  manual: "By hand",
};
const ON_ORDER: On[] = ["change", "schedule", "startup", "manual"];

const onWords = (on: On[]) =>
  ON_ORDER.filter((o) => on.includes(o)).map((o) => ON_WORDS[o]);

// "A change, by hand"; with its cron when it runs on a schedule.
export const onText = (a: { on: On[]; schedule?: string | null }) =>
  onWords(a.on)
    .map((w, i) => (i === 0 ? w : w.toLowerCase()))
    .join(", ") +
  (a.on.includes("schedule") && a.schedule ? ` (${a.schedule})` : "");

// Whether Run now is allowed: the service refuses a run by hand unless the
// trigger says manual. A dry run sends nothing and is always allowed.
export const runsByHand = (a: Action) => a.on.includes("manual");
export const NOT_BY_HAND =
  "It does not run by hand: add manual to its trigger.on. A dry run is always allowed.";

// The files it watches, as a card says it.
export const watchesText = (a: Action) =>
  a.paths.length === 0 ? "Every file" : a.paths.join(", ");

// What a run says it was started by.
const TRIGGER_WORDS: Record<On, string> = {
  change: "Change",
  startup: "Start-up",
  schedule: "Schedule",
  manual: "Manual",
};
export const triggerText = (run: Run) =>
  `${TRIGGER_WORDS[run.trigger]}${run.dry_run ? " (dry run)" : ""}`;

// The commit as people quote it.
export const shortRevision = (revision?: string | null) =>
  revision ? revision.slice(0, 7) : "–";

// "3 of 4 steps worked", "1 step", "No steps".
export const stepsText = (run: Run) => {
  const failed = run.steps.filter((s) => !s.ok).length;
  if (run.steps.length === 0) return "No steps";
  return failed === 0
    ? countOf(run.steps.length, "step")
    : `${formatCount(failed)} of ${countOf(run.steps.length, "step")} failed`;
};

export const RUN_LABELS = {
  fresh: "Worked",
  failing: "Failed",
};
export const DRY_LABELS = {
  fresh: "Would work",
  failing: "Would fail",
};
export const runState = (run: Run): HealthState =>
  run.ok ? "fresh" : "failing";

// What a run says beside its button, in a few words: the steps themselves
// are on the page, where there is room to read them.
export function runOutcome(run: Run): { ok: boolean; message: string } {
  if (run.dry_run)
    return run.ok
      ? { ok: true, message: `Dry run: ${stepsText(run)}` }
      : { ok: false, message: "Dry run failed" };
  return run.ok
    ? { ok: true, message: `Ran: ${stepsText(run)}` }
    : { ok: false, message: run.error ?? "Run failed" };
}

export type Kind = Schemas["Kind"];

// Runs one item now, over every file its trigger selects. A dry run builds
// every request (or the command line) and sends nothing that writes.
export async function runAction(
  kind: Kind,
  id: string,
  dryRun: boolean,
): Promise<Run> {
  const options = {
    params: { path: { id }, query: { dry_run: dryRun } },
  };
  return kind === "api"
    ? unwrap(await api.POST("/api/v1/apis/{id}/run", options))
    : unwrap(await api.POST("/api/v1/scripts/{id}/run", options));
}

// The section an item's kind lives in, for its route and its queries.
export const SECTION: Record<Kind, "apis" | "scripts"> = {
  api: "apis",
  script: "scripts",
};

export const labelsText = (labels: Record<string, string>) =>
  Object.entries(labels).map(([k, v]) => `${k}=${v}`);

// How an API item or a webhook authenticates, in words. The value it sends
// is never in the API.
const AUTH_WORDS: Record<string, string> = {
  none: "None",
  bearer: "Bearer token",
  basic: "Basic",
  header: "A header of its own",
  query: "A query parameter",
  oauth2: "OAuth 2 client credentials",
  login: "A login request first",
};
export const authText = (auth: string) => AUTH_WORDS[auth] ?? auth;
