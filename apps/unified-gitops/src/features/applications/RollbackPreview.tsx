import { useState, useSyncExternalStore } from "react";
import { ChevronRight, FileDiff, ArrowUpFromLine } from "lucide-react";
import { afterRun, runOutcome, shortRevision, syncApplication } from "./model";
import { useApplication } from "../../api/queries";
import {
  Button,
  countOf,
  DiffView,
  formatCount,
  Modal,
  pageStyles as styles,
  RunButton,
  serialize,
} from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../../api/client";
import previewStyles from "./RollbackPreview.module.css";

type Operation = Schemas["Operation"];
type Plan = Schemas["PlanSnapshot"];

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; plan: Plan }
  | { phase: "error"; message: string };

// The preview of one rollback, shared by the dialog's text (where the
// changes appear) and its View changes button (in the button row): two
// places in the dialog, one request.
export interface RollbackPreviewStore {
  get: () => State;
  subscribe: (listener: () => void) => () => void;
  load: () => void;
}

export function rollbackPreview(
  application: string,
  revision: string,
): RollbackPreviewStore {
  let state: State = { phase: "idle" };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((l) => l());
  };
  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load: () => {
      // Once is enough: the dialog shows the same answer each time it opens.
      if (state.phase === "loading" || state.phase === "done") return;
      set({ phase: "loading" });
      // What a rollback would change, asked for on demand: the commit's
      // desired state against the system as it is now. Nothing is applied.
      api
        .POST("/api/v1/applications/{id}/rollback/preview", {
          params: { path: { id: application } },
          body: { revision },
        })
        .then((response) => set({ phase: "done", plan: unwrap(response) }))
        .catch((e: unknown) =>
          set({
            phase: "error",
            message: e instanceof Error ? e.message : String(e),
          }),
        );
    },
  };
}

const usePreview = (store: RollbackPreviewStore) =>
  useSyncExternalStore(store.subscribe, store.get);

// The dialog's button row: opens the changes in a dialog of their own,
// over the confirmation. The first time it asks the backend, and the
// dialog opens once the answer is in, never empty: the button says it is
// comparing meanwhile.
export function ViewChangesButton({
  store,
  title,
}: {
  store: RollbackPreviewStore;
  title: string;
}) {
  const state = usePreview(store);
  const [wanted, setWanted] = useState(false);
  const ready = state.phase === "done" || state.phase === "error";
  return (
    <>
      <Button
        icon={<FileDiff />}
        disabled={state.phase === "loading"}
        onClick={() => {
          store.load();
          setWanted(true);
        }}
      >
        {state.phase === "loading" ? "Comparing…" : "View changes"}
      </Button>
      {wanted && ready && (
        <Modal title={title} onClose={() => setWanted(false)}>
          <Changes store={store} />
        </Modal>
      )}
    </>
  );
}

// The rollback dialog's text: one sentence a line.
export function RollbackMessage({
  application,
  short,
}: {
  application: string;
  short: string;
}) {
  return (
    <>
      <p className={previewStyles.text}>
        {application} is going to be rolled back to commit{" "}
        <code className={styles.mono}>{short}</code>.
      </p>
      <p className={previewStyles.text}>
        Automatic syncs will pause until the next manual Push.
      </p>
    </>
  );
}

const VERB = { create: "Create", update: "Update", delete: "Delete" };

type Json = Record<string, unknown>;

// The object as it is on the system now, as far as git declares it: the
// desired object with each changed field put back to its current value (a
// field the system lacks, removed). What a rollback sets is then exactly
// the difference.
function currentOf(op: Operation): Json {
  const object = structuredClone(op.object as Json);
  for (const change of op.changes ?? []) {
    const path = change.field.split(".");
    let parent: Json = object;
    for (const part of path.slice(0, -1)) {
      const next = parent[part];
      if (typeof next !== "object" || next === null) break;
      parent = next as Json;
    }
    const last = path.at(-1)!;
    if (change.from === null || change.from === undefined) delete parent[last];
    else parent[last] = change.from;
  }
  return object;
}

function Changes({ store }: { store: RollbackPreviewStore }) {
  const state = usePreview(store);
  if (state.phase === "loading" || state.phase === "idle")
    return <p className={previewStyles.note}>Comparing with the system…</p>;
  if (state.phase === "error")
    return (
      <p className={`${previewStyles.note} ${previewStyles.error}`}>
        {state.message}
      </p>
    );
  const operations = state.plan.operations;
  if (operations.length === 0)
    return (
      <p className={previewStyles.note}>
        Nothing would change: the system already matches this commit.
      </p>
    );
  return <OperationsDiff operations={operations} />;
}

// Operations as GitHub shows a change: one section per object, its YAML as
// the system had it against what git declares, removed lines in red and
// added in green. `failed` marks the ones an apply could not set, with why.
export function OperationsDiff({
  operations,
  failed,
}: {
  operations: Operation[];
  failed?: Map<string, string>;
}) {
  // By file, in the order they first appear, as GitHub groups a commit's
  // changes. A delete has no file: nothing in git declares what prune
  // removes, so those come last, under a heading that says why.
  const files = new Map<string, Operation[]>();
  for (const op of operations) {
    const file = op.file ?? "";
    files.set(file, [...(files.get(file) ?? []), op]);
  }
  const order = [...files.keys()].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : 0,
  );
  return (
    // Focusable, so a keyboard can scroll a long diff.
    <div
      className={previewStyles.changes}
      tabIndex={0}
      role="region"
      aria-label="Changes"
    >
      {order.map((file) => {
        const ops = files.get(file)!;
        return (
          <details key={file} className={previewStyles.file} open>
            <summary className={previewStyles.fileName}>
              <ChevronRight className={previewStyles.caret} aria-hidden />
              {file ? (
                <code className={styles.mono}>{file}</code>
              ) : ops.every((op) => op.op === "delete") ? (
                "Not in git: removed by prune"
              ) : (
                "File not known"
              )}
              <span>{countOf(ops.length, "change")}</span>
            </summary>
            {ops.map((op) => (
              <OperationDiff
                key={`${op.kind}/${op.key}`}
                op={op}
                error={failed?.get(`${op.kind}/${op.key}`)}
              />
            ))}
          </details>
        );
      })}
    </div>
  );
}

function OperationDiff({ op, error }: { op: Operation; error?: string }) {
  const label = `${VERB[op.op]} ${op.kind} ${op.key}`;
  const yaml = (o: Json) => serialize(o, "yaml");
  return (
    <section className={previewStyles.change}>
      <h4 className={previewStyles.what}>
        {VERB[op.op]} {op.kind} <code className={styles.mono}>{op.key}</code>
      </h4>
      {error && (
        <p className={`${previewStyles.note} ${previewStyles.error}`}>
          Not applied: {error}
        </p>
      )}
      <DiffView
        label={label}
        before={
          op.op === "create"
            ? ""
            : yaml(op.op === "delete" ? (op.object as Json) : currentOf(op))
        }
        after={op.op === "delete" ? "" : yaml(op.object as Json)}
      />
    </section>
  );
}

type Run = Schemas["RunRecord"];

// A past run's changes, from its history row: what it found (a check) or
// set out to apply (a sync), and why it failed when it did. Kept with the
// run, so nothing is asked of the backend and the dialog opens at once.
export function RunChangesButton({
  run,
  title,
  application,
  latest,
}: {
  run: Run;
  title: string;
  application: string;
  // The newest run: what it found is what a Push would apply now. An older
  // run's changes may be long applied or overtaken by commits since.
  latest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const nothing = run.operations.length === 0 && run.errors.length === 0;
  return (
    <>
      <Button
        icon={<FileDiff />}
        disabled={nothing}
        data-unavailable={nothing || undefined}
        title={nothing ? "Nothing changed in this run." : undefined}
        onClick={() => setOpen(true)}
      >
        View changes
      </Button>
      {open && (
        <ChangesModal
          title={title}
          application={application}
          canSync={latest}
          operations={run.operations}
          planned={run.planned}
          errors={run.errors}
          failed={
            new Map(
              run.applied
                .filter((a) => !a.ok)
                .map((a) => [`${a.kind}/${a.key}`, a.error ?? "failed"]),
            )
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// What an application has to apply now, from its card: its last check's
// plan, in the same dialog as a run's changes. Only when there is something
// to apply; the plan is asked for on the click, and the dialog opens once
// it is in, never empty.
export function PendingChangesButton({
  application,
  pending,
}: {
  application: string;
  // Out of sync, with operations to apply.
  pending: boolean;
}) {
  const [wanted, setWanted] = useState(false);
  const detail = useApplication(application, wanted);
  const plan = detail.data?.plan;
  return (
    <>
      <Button
        icon={<FileDiff />}
        disabled={!pending || (wanted && detail.isFetching && !plan)}
        data-unavailable={!pending || undefined}
        title={
          pending ? undefined : "Nothing to apply: it is in sync with git."
        }
        onClick={() => setWanted(true)}
      >
        {wanted && !plan ? "Loading…" : "View changes"}
      </Button>
      {wanted && plan && (
        <ChangesModal
          title={`Changes to apply to ${application}, commit ${shortRevision(plan.revision)}`}
          application={application}
          canSync
          operations={plan.operations}
          planned={plan.operations.length}
          errors={plan.errors}
          onClose={() => setWanted(false)}
        />
      )}
    </>
  );
}

// The changes dialog both buttons open: the operations by file, as GitHub
// shows a change, any errors above them, and Close and Push at the foot.
function ChangesModal({
  title,
  application,
  canSync,
  operations,
  planned,
  errors,
  failed,
  onClose,
}: {
  title: string;
  application: string;
  // Push applies what git declares now: only offered where these changes
  // are what it would apply.
  canSync: boolean;
  operations: Operation[];
  // How many there were in all; `operations` may hold only the first ones.
  planned: number;
  errors: string[];
  failed?: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button data-autofocus onClick={onClose}>
            Close
          </Button>
          <RunButton
            label="Push"
            busyLabel="Pushing…"
            variant="primary"
            icon={<ArrowUpFromLine />}
            disabled={!canSync}
            reason="Push applies what git declares now: open the newest run to see what that changes."
            invalidate={afterRun(application)}
            run={async () => {
              const outcome = runOutcome(await syncApplication(application));
              // Done: the new run is at the top of the history.
              if (outcome.ok) onClose();
              return outcome;
            }}
          />
        </>
      }
    >
      {errors.map((error) => (
        <p
          key={error}
          className={`${previewStyles.note} ${previewStyles.error}`}
        >
          {error}
        </p>
      ))}
      {operations.length < planned && (
        <p className={previewStyles.note}>
          The first {formatCount(operations.length)} of{" "}
          {countOf(planned, "change")}.
        </p>
      )}
      <OperationsDiff operations={operations} failed={failed} />
    </Modal>
  );
}
