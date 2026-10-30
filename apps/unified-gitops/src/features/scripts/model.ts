import type { Schemas } from "../../api/client";
import { labelsText } from "../../shared/runs";

type Script = Schemas["ScriptSummary"];

// "ops-scripts: reload-dns.sh", or the file alone when it is in the
// project it watches.
export const fileText = (s: Script) =>
  s.script_project === s.project ? s.file : `${s.script_project}: ${s.file}`;

// The command as written: interpreter, file, arguments (templates, not
// rendered).
export const commandText = (s: Script) =>
  [s.interpreter, s.file, ...s.args].filter(Boolean).join(" ");

export const PER_WORDS: Record<Schemas["Per"], string> = {
  file: "Once per changed file",
  commit: "Once per commit",
};

export const STDIN_WORDS: Record<Schemas["Stdin"], string> = {
  none: "Nothing",
  event: "The event, as JSON",
};

export const searchText = (s: Script) =>
  `${s.name} ${s.description ?? ""} ${s.project} ${s.script_project} ${s.file} ${s.args.join(" ")} ${s.paths.join(" ")} ${labelsText(s.labels).join(" ")}`;
