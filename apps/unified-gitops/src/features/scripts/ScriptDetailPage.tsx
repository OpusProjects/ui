import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  DetailTitle,
  EmptyState,
  Fact,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  ValueList,
  detailStyles as common,
} from "@opusprojects/unified-ui";
import { ApiError } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useScript } from "../../api/queries";
import { ICONS } from "../../sections";
import { RunActions, RunHistory, RunResult } from "../../shared/Runs";
import {
  LimitFacts,
  TriggerFacts,
  credentialLinks,
} from "../../shared/ActionFacts";
import {
  actionLabels,
  actionState,
  runsByHand,
  type Run,
} from "../../shared/runs";
import { PER_WORDS, STDIN_WORDS } from "./model";

type Script = Schemas["ScriptSummary"];

// What each of its own facts means, behind its label, starting with its key
// in the item's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Script:
    "script.project and script.file. The file it runs, relative to that project's checkout; the project defaults to the one it watches.",
  Arguments:
    "script.args. Passed as they are, with no shell reading them: templates over $event and $file, shown as written.",
  Interpreter:
    "script.interpreter. A program the file is given to (bash, python3). None: the file runs itself, by its executable bit and shebang.",
  "Working folder":
    "script.working_dir. Where it runs, relative to the watched checkout; its root when left out.",
  Environment:
    "script.env. The variables it sets besides the GITOPS_* ones, by name only: their values are in the configuration.",
  Runs: "script.per. file: once per changed file, with $file. commit: once for the whole commit.",
  Input:
    "script.stdin. What it reads on its standard input: nothing, or the event as JSON.",
  "Success codes":
    "script.success_exit_codes. The exit codes that count as success.",
  Credential:
    "credential. Its fields reach the script as CREDENTIAL_<FIELD> variables; never shown here.",
};

export function ScriptDetailPage() {
  const { name = "" } = useParams();
  const query = useScript(name);
  const missing = query.error instanceof ApiError && query.error.status === 404;
  const item = missing ? undefined : query.data;
  const [result, setResult] = useState<{ name: string; run: Run } | null>(null);
  const shown = result?.name === name ? result.run : null;

  return (
    <>
      <PageHeader
        icon={ICONS.scripts}
        title={
          <DetailTitle section="Scripts" to="/scripts">
            {name}
          </DetailTitle>
        }
        description={
          item?.description ??
          "What this script item watches, what it runs, and how its runs went."
        }
        actions={
          item && (
            <RunActions
              key={name}
              kind="script"
              name={name}
              byHand={runsByHand(item)}
              onRun={(run) => setResult({ name, run })}
            />
          )
        }
      />
      {query.isPending && <SkeletonSummary />}
      {query.isError && !missing && (
        <Notice title="Could not load this script">
          {query.error.message}
        </Notice>
      )}
      {missing && (
        <EmptyState title="No such script">
          Nothing called {name} is configured, or this key may not see it.{" "}
          <Link to="/scripts">See every script</Link>.
        </EmptyState>
      )}
      {item && (
        <>
          <Overview script={item} />
          {shown && (
            <RunResult
              run={shown}
              kind="script"
              onClose={() => setResult(null)}
            />
          )}
          <RunHistory runs={item.history} kind="script" item={name} />
        </>
      )}
    </>
  );
}

function Overview({ script: s }: { script: Script }) {
  return (
    <Panel
      title="Overview"
      hint="What it watches, the file it runs and how, and the credential it is given."
      aside={<HealthPill state={actionState(s)} labels={actionLabels(s)} />}
    >
      <dl className={common.facts}>
        <TriggerFacts item={s} />
        <Fact label="Script" hint={HINTS["Script"]}>
          <code className={common.mono}>{s.file}</code> in{" "}
          <Link
            className={common.link}
            to={`/projects/${encodeURIComponent(s.script_project)}`}
          >
            {s.script_project}
          </Link>
        </Fact>
        <Fact label="Arguments" hint={HINTS["Arguments"]}>
          <ValueList values={s.args} limit={4} mono />
        </Fact>
        <Fact label="Interpreter" hint={HINTS["Interpreter"]}>
          {s.interpreter ? (
            <code className={common.mono}>{s.interpreter}</code>
          ) : (
            "None: the file runs itself"
          )}
        </Fact>
        <Fact label="Working folder" hint={HINTS["Working folder"]}>
          {s.working_dir ? (
            <code className={common.mono}>{s.working_dir}</code>
          ) : (
            "The checkout's root"
          )}
        </Fact>
        <Fact label="Environment" hint={HINTS["Environment"]}>
          <ValueList values={s.env} limit={3} mono />
        </Fact>
        <Fact label="Runs" hint={HINTS["Runs"]}>
          {PER_WORDS[s.per]}
        </Fact>
        <Fact label="Input" hint={HINTS["Input"]}>
          {STDIN_WORDS[s.stdin]}
        </Fact>
        <Fact label="Success codes" hint={HINTS["Success codes"]}>
          {s.success_exit_codes.join(", ")}
        </Fact>
        <Fact label="Credential" hint={HINTS["Credential"]}>
          <ValueList
            values={credentialLinks(s.credential ? [s.credential] : [])}
          />
        </Fact>
        <LimitFacts item={s} />
      </dl>
    </Panel>
  );
}
