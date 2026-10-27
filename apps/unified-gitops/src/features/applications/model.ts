import type { HealthState } from "@opusprojects/unified-client";
import { api, unwrap, type Schemas } from "../../api/client";
import { countOf, formatCount } from "@opusprojects/unified-ui";

type Status = Schemas["SyncStatus"];
type Run = Schemas["RunRecord"];
type Summary = Schemas["ApplicationSummary"];

// An application's sync status, in the four states every unified-* screen
// colours alike: synced is healthy, out of sync is late (git and the system
// disagree, nothing is broken), failed is broken, never checked is waiting.
const STATE: Record<Status, HealthState> = {
  synced: "fresh",
  out_of_sync: "stale",
  failed: "failing",
  unknown: "pending",
  // Amber like out of sync: nothing broke, but it is not what git says and
  // someone has to come back to it.
  rolled_back: "stale",
};

export const APP_LABELS = {
  fresh: "Synced",
  stale: "Out of sync",
  failing: "Failed",
  pending: "Not checked yet",
};

export const appState = (app: { status: Status }): HealthState =>
  STATE[app.status];

// The pill's words for one application. A rolled-back one reads "Out of
// sync", which it is (git says another commit); the Commit line says why.
export const appLabels = (_app: { status: Status }) => APP_LABELS;

// The commit the system is on: the one it was rolled back to while a
// rollback stands, otherwise the one the last run read.
export const systemRevision = (app: Summary) =>
  app.rollback?.revision ?? app.revision ?? null;

// "3 changes", "Nothing", or nothing yet: what a sync would do now.
export function pending(app: Summary) {
  if (app.last_checked_age_seconds == null)
    return app.status === "failed" ? "Could not check" : "Not checked yet";
  // A failed check compared nothing: zero operations is not "in sync".
  if (app.status === "failed" && app.pending_operations === 0)
    return "Unknown: last check failed";
  return app.pending_operations === 0
    ? "Nothing"
    : countOf(app.pending_operations, "change");
}

// The commit as people quote it.
export const shortRevision = (revision?: string | null) =>
  revision ? revision.slice(0, 7) : "–";

export const OP_TONE = {
  create: "good",
  update: "warning",
  delete: "danger",
} as const;

export const OP_LABEL = {
  create: "Create",
  update: "Update",
  delete: "Delete",
} as const;

// What a run says on its button, in a few words.
export function runOutcome(run: Run): { ok: boolean; message: string } {
  const failed = run.applied.filter((a) => !a.ok).length;
  switch (run.result) {
    case "succeeded":
      return {
        ok: true,
        message:
          run.mode === "apply" && run.applied.length > 0
            ? `Applied ${countOf(run.applied.length, "change")}`
            : "In sync",
      };
    case "out_of_sync":
      return {
        ok: true,
        message: `${countOf(run.planned, "change")} to apply`,
      };
    case "partial":
      return {
        ok: false,
        message: `${formatCount(run.applied.length - failed)} applied, ${formatCount(failed)} failed`,
      };
    default:
      // Short, so it fits beside the buttons: the error itself is on the
      // card and the page, where there is room to read it.
      return {
        ok: false,
        message: `${run.mode === "apply" ? "Sync" : "Check"} failed`,
      };
  }
}

export async function refreshApplication(id: string) {
  return unwrap(
    await api.POST("/api/v1/applications/{id}/refresh", {
      params: { path: { id } },
    }),
  );
}

export async function syncApplication(id: string) {
  return unwrap(
    await api.POST("/api/v1/applications/{id}/sync", {
      params: { path: { id } },
    }),
  );
}

// Applies an older commit's desired state once; checks then stop applying
// until the next Sync (the backend keeps the application rolled back).
export async function rollbackApplication(id: string, revision: string) {
  return unwrap(
    await api.POST("/api/v1/applications/{id}/rollback", {
      params: { path: { id } },
      body: { revision },
    }),
  );
}

// The queries a run changes: the list, and this application with the local
// copy of its system's settings (the state queries sit under its key).
export const afterRun = (id: string) => [["applications"], ["application", id]];
