import { Link } from "react-router";
import {
  Fact,
  ValueList,
  detailStyles as common,
  formatSpan,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../api/client";
import { labelsText, onText } from "./runs";

// What each fact means, behind its label, starting with its key in the
// item's YAML, which is where it is changed.
const TRIGGER_HINTS: Record<string, string> = {
  Project:
    "project. The repository it watches: a commit pulled there that touches its files starts a run.",
  Watches:
    "trigger.paths. Globs over the files a commit touched, relative to the repository's root: * within a folder, ** across folders. None means every file.",
  Ignores: "trigger.ignore_paths. Files never selected, even when paths match.",
  "Runs on":
    "trigger.on. What starts a run: a change to its files, the service starting, a cron schedule (trigger.schedule, UTC), or a person (Run now). Without manual, Run now is refused; a dry run is always allowed.",
  Debounce:
    "trigger.debounce_seconds. How long it waits after a change, gathering the changes that arrive meanwhile into the same run.",
  "On failure":
    "on_failure. continue: a failing file does not stop the others. stop: the run ends at the first failure.",
  Timeout: "timeout_seconds. How long one attempt may take.",
  Attempts:
    "retry.attempts. Attempts in all for one request or execution, the first included.",
  Labels: "labels. Free-form, for finding items in this UI and the API.",
};

// The trigger facts every API and script item has, in the same order.
export function TriggerFacts({
  item,
}: {
  item: {
    project: string;
    paths: string[];
    ignore_paths: string[];
    on: Schemas["On"][];
    schedule?: string | null;
    debounce_seconds: number;
  };
}) {
  return (
    <>
      <Fact label="Project" hint={TRIGGER_HINTS["Project"]}>
        <Link
          className={common.link}
          to={`/projects/${encodeURIComponent(item.project)}`}
        >
          {item.project}
        </Link>
      </Fact>
      <Fact label="Watches" hint={TRIGGER_HINTS["Watches"]}>
        {item.paths.length === 0 ? (
          "Every file"
        ) : (
          <ValueList values={item.paths} mono />
        )}
      </Fact>
      {item.ignore_paths.length > 0 && (
        <Fact label="Ignores" hint={TRIGGER_HINTS["Ignores"]}>
          <ValueList values={item.ignore_paths} mono />
        </Fact>
      )}
      <Fact label="Runs on" hint={TRIGGER_HINTS["Runs on"]}>
        {onText(item)}
      </Fact>
      {item.debounce_seconds > 0 && (
        <Fact label="Debounce" hint={TRIGGER_HINTS["Debounce"]}>
          {formatSpan(item.debounce_seconds)}
        </Fact>
      )}
    </>
  );
}

// The run limits every API and script item has, after its own facts.
export function LimitFacts({
  item,
}: {
  item: {
    on_failure: Schemas["OnFailure"];
    timeout_seconds: number;
    attempts: number;
    labels: Record<string, string>;
  };
}) {
  return (
    <>
      <Fact label="On failure" hint={TRIGGER_HINTS["On failure"]}>
        {item.on_failure === "stop"
          ? "Stop the run"
          : "Continue with the others"}
      </Fact>
      <Fact label="Timeout" hint={TRIGGER_HINTS["Timeout"]}>
        {formatSpan(item.timeout_seconds)} per attempt
      </Fact>
      <Fact label="Attempts" hint={TRIGGER_HINTS["Attempts"]}>
        {item.attempts}
      </Fact>
      {Object.keys(item.labels).length > 0 && (
        <Fact label="Labels" hint={TRIGGER_HINTS["Labels"]}>
          <ValueList values={labelsText(item.labels)} mono />
        </Fact>
      )}
    </>
  );
}

export const credentialLinks = (names: string[]) =>
  names.map((c) => (
    <Link
      key={c}
      className={common.link}
      to={`/credentials/${encodeURIComponent(c)}`}
    >
      {c}
    </Link>
  ));
