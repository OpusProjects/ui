import { useState } from "react";
import { FlaskConical, ListTree, Play } from "lucide-react";
import {
  Button,
  CodeView,
  Fact,
  HealthPill,
  LinesView,
  ListSoft,
  ListTable,
  LiveAge,
  Modal,
  Panel,
  RunButton,
  ValueList,
  detailStyles as common,
  formatDuration,
  useConfirm,
  type ListColumn,
} from "@opusprojects/unified-ui";
import {
  DRY_LABELS,
  NOT_BY_HAND,
  RUN_LABELS,
  SECTION,
  runAction,
  runOutcome,
  runState,
  shortRevision,
  stepsText,
  triggerText,
  type Kind,
  type Run,
  type Step,
} from "./runs";
import styles from "./Runs.module.css";

// Run now and Dry run, beside an item's title. Each hands the run it got
// back to the page, which shows it whole: a dry run's bodies are only there.
export function RunActions({
  kind,
  name,
  byHand,
  onRun,
}: {
  kind: Kind;
  name: string;
  // Whether its trigger allows a run by hand; a dry run always is.
  byHand: boolean;
  onRun: (run: Run) => void;
}) {
  const confirm = useConfirm();
  const invalidate = [[SECTION[kind]]];
  const run = (dryRun: boolean) => async () => {
    const result = await runAction(kind, name, dryRun);
    onRun(result);
    return runOutcome(result);
  };
  return (
    <>
      <RunButton
        label="Dry run"
        busyLabel="Dry running…"
        icon={<FlaskConical />}
        outcomeSide="start"
        invalidate={invalidate}
        run={run(true)}
      />
      <RunButton
        label="Run now"
        busyLabel="Running…"
        icon={<Play />}
        variant="primary"
        outcomeSide="end"
        disabled={!byHand}
        reason={byHand ? undefined : NOT_BY_HAND}
        invalidate={invalidate}
        // It acts on other systems now, whatever git says: one explicit
        // yes first, as a rollback asked for.
        ask={() =>
          confirm({
            title: `Run ${name} now?`,
            message:
              kind === "api"
                ? "Every request its trigger selects is sent now, over every file it watches. A dry run shows them without sending anything that writes."
                : "The script runs now, over every file it watches. A dry run shows the command line without running it.",
            confirmLabel: "Run now",
          })
        }
        run={run(false)}
      />
    </>
  );
}

// One run whole: why and when it ran, then each step, with what a dry run
// would send and what a script printed.
export function RunView({ run, kind }: { run: Run; kind: Kind }) {
  return (
    <div className={styles.run}>
      <dl className={common.facts}>
        <Fact label="Result">
          <HealthPill
            state={runState(run)}
            labels={run.dry_run ? DRY_LABELS : RUN_LABELS}
          />
        </Fact>
        <Fact label="Started by">
          {triggerText(run)}
          {run.by && <>, {run.by}</>}
        </Fact>
        <Fact label="When">
          <LiveAge since={run.started_at} />
        </Fact>
        <Fact label="Took">{formatDuration(run.duration_ms / 1000)}</Fact>
        <Fact label="Commit">
          <code className={common.mono} title={run.revision ?? undefined}>
            {shortRevision(run.revision)}
          </code>
        </Fact>
        {kind === "script" && (
          <Fact label="Script commit">
            <code
              className={common.mono}
              title={run.script_revision ?? undefined}
            >
              {shortRevision(run.script_revision)}
            </code>
          </Fact>
        )}
        <Fact label="Steps">{stepsText(run)}</Fact>
      </dl>
      {run.error && (
        <p className={styles.error} role="alert">
          {run.error}
        </p>
      )}
      <StepTable steps={run.steps} kind={kind} />
      <StepDetails steps={run.steps} />
    </div>
  );
}

const STEP_LABELS = { fresh: "OK", failing: "Failed" };

// A step's file, or what it was about when the run was one per commit.
const fileOf = (s: Step) => s.file ?? "Every file";

function StepTable({ steps, kind }: { steps: Step[]; kind: Kind }) {
  const none = <ListSoft>–</ListSoft>;
  const columns: ListColumn<Step>[] = [
    {
      key: "file",
      label: "File",
      role: "name",
      title: fileOf,
      render: (s) =>
        s.file ? (
          <code className={common.mono}>{s.file}</code>
        ) : (
          <ListSoft>Every file</ListSoft>
        ),
    },
    { key: "action", label: "Action", render: (s) => s.action },
  ];
  if (kind === "api")
    columns.push(
      { key: "method", label: "Method", render: (s) => s.method ?? none },
      {
        key: "url",
        label: "URL",
        title: (s) => s.url ?? undefined,
        render: (s) =>
          s.url ? <code className={common.mono}>{s.url}</code> : none,
      },
      {
        key: "status",
        label: "Status",
        render: (s) =>
          s.status != null ? (
            `HTTP ${s.status}`
          ) : (
            <ListSoft>No answer</ListSoft>
          ),
      },
      {
        key: "changed",
        label: "Changed fields",
        render: (s) =>
          s.changed_fields.length > 0 ? (
            <ValueList values={s.changed_fields} mono />
          ) : (
            none
          ),
      },
    );
  else
    columns.push({
      key: "exit",
      label: "Exit code",
      numeric: true,
      render: (s) => (s.exit_code != null ? String(s.exit_code) : none),
    });
  columns.push(
    {
      key: "attempts",
      label: "Attempts",
      numeric: true,
      render: (s) => String(s.attempts),
    },
    {
      key: "error",
      label: "Error",
      title: (s) => s.error ?? undefined,
      render: (s) => s.error ?? none,
    },
    {
      key: "result",
      label: "Result",
      role: "state",
      render: (s) => (
        <HealthPill state={s.ok ? "fresh" : "failing"} labels={STEP_LABELS} />
      ),
    },
  );
  return (
    <ListTable
      columns={columns}
      rows={steps}
      rowKey={(s) => `${steps.indexOf(s)}`}
      empty="Nothing to do: no file its trigger selects."
      noun="steps"
      name="steps"
    />
  );
}

// What does not fit a table cell: a dry run's bodies, as they would be
// sent, and a script's output, as it printed it.
function StepDetails({ steps }: { steps: Step[] }) {
  const shown = steps.filter((s) => s.body != null || s.output);
  if (shown.length === 0) return null;
  return (
    <div className={styles.details}>
      {shown.map((s, i) => (
        <section key={i} className={styles.detail}>
          <h3 className={styles.detailTitle}>
            {s.output != null ? "Output" : "Body"}
            {s.file && (
              <>
                {" "}
                of <code className={common.mono}>{s.file}</code>
              </>
            )}
            {s.method && s.url && (
              <span className={styles.soft}>
                {" "}
                {s.method} {s.url}
              </span>
            )}
          </h3>
          {s.output != null ? (
            <LinesView
              lines={s.output.replace(/\n$/, "").split("\n")}
              label={`Output${s.file ? ` of ${s.file}` : ""}`}
            />
          ) : isObject(s.body) ? (
            <CodeView value={s.body} format="json" label="Body" />
          ) : (
            <LinesView
              lines={JSON.stringify(s.body, null, 2).split("\n")}
              label="Body"
            />
          )}
        </section>
      ))}
    </div>
  );
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// The run a person just started from the page, whole, until they close it
// or start another.
export function RunResult({
  run,
  kind,
  onClose,
}: {
  run: Run;
  kind: Kind;
  onClose: () => void;
}) {
  return (
    <Panel
      title={run.dry_run ? "Dry run" : "Run"}
      hint={
        run.dry_run
          ? "What a run would do now: every request built, with its body, and nothing sent that writes. Compare and upsert still read the live objects."
          : "The run just started from this page. It is also the newest in the history below."
      }
      aside={<Button onClick={onClose}>Close</Button>}
    >
      <RunView run={run} kind={kind} />
    </Panel>
  );
}

// Its runs since the service started, newest first: what started each, at
// which commit, and how its steps went; each run's steps open in a dialog.
export function RunHistory({
  runs,
  kind,
  item,
}: {
  runs: Run[];
  kind: Kind;
  item: string;
}) {
  const [open, setOpen] = useState<Run | null>(null);
  const columns: ListColumn<Run>[] = [
    { key: "trigger", label: "Started by", render: triggerText },
    {
      key: "when",
      label: "When",
      render: (r) => <LiveAge since={r.started_at} />,
    },
    {
      key: "by",
      label: "Who",
      render: (r) => r.by ?? <ListSoft>–</ListSoft>,
    },
    {
      key: "commit",
      label: "Commit",
      render: (r) => (
        <code className={common.mono} title={r.revision ?? undefined}>
          {shortRevision(r.revision)}
        </code>
      ),
    },
    {
      key: "steps",
      label: "Steps",
      title: (r) => r.error ?? undefined,
      render: (r) => r.error ?? stepsText(r),
    },
    {
      key: "took",
      label: "Took",
      numeric: true,
      render: (r) => formatDuration(r.duration_ms / 1000),
    },
    {
      key: "view",
      label: "View",
      render: (r) => (
        <Button icon={<ListTree />} onClick={() => setOpen(r)}>
          View steps
        </Button>
      ),
    },
    {
      key: "result",
      label: "Result",
      role: "state",
      render: (r) => (
        <HealthPill
          state={runState(r)}
          labels={r.dry_run ? DRY_LABELS : RUN_LABELS}
        />
      ),
    },
  ];
  return (
    <Panel
      title="History"
      hint={`Its runs since the service started, newest first, at most 50; a restart starts over. Dry runs are kept too, marked so. View steps shows each request or execution, with its error or its output.`}
    >
      {runs.length === 0 ? (
        <ListSoft>
          No runs yet: nothing it watches has changed since the service started.
          Dry run shows what a run would do.
        </ListSoft>
      ) : (
        <ListTable
          columns={columns}
          rows={runs}
          rowKey={(r) => `${r.started_at}-${runs.indexOf(r)}`}
          empty="No runs yet."
          noun="runs"
          name="history"
        />
      )}
      {open && (
        <Modal
          title={`${item}: ${triggerText(open).toLowerCase()} run`}
          onClose={() => setOpen(null)}
        >
          <div className={styles.modalBody}>
            <RunView run={open} kind={kind} />
          </div>
        </Modal>
      )}
    </Panel>
  );
}
