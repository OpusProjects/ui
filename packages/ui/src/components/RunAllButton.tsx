import type { ReactNode } from "react";
import { RunButton } from "./RunButton";
import { useConfirm, type ConfirmRequest } from "./Modal";
import { countOf, formatCount } from "../lib/format";

// How many run at once: enough to finish a page of items quickly, few
// enough that one click does not start every connector (SSH sweeps
// included) or every git pull in the same instant.
const CONCURRENCY = 4;

interface Words {
  // "Sync" / "Pull": the button's verb.
  verb: string;
  // "Syncing…" / "Pulling…": what it says while it runs.
  busy: string;
  // "synced" / "pulled": the outcome's past tense.
  done: string;
  // ["source", "sources"]: what is counted.
  noun: [string, string];
}

// Runs an action on every item on screen and says how many worked. It says
// what it will reach: "Sync all" over the whole list, "Sync 5 shown" when a
// search or filter narrowed it, so a click never reaches further than it
// looks. The API acts on one item per request; this runs them a few at a
// time. `run` resolves to whether that item worked; a throw counts as not.
export function RunAllButton({
  ids,
  filtered,
  words,
  run,
  invalidate,
  confirm,
  icon,
}: {
  ids: string[];
  filtered: boolean;
  words: Words;
  run: (id: string) => Promise<boolean>;
  invalidate: string[][];
  // Asked before anything runs, for a run that writes ("Sync 3
  // applications?"), in the app's dialog; declined, nothing happens.
  confirm?: (count: number) => ConfirmRequest;
  icon?: ReactNode;
}) {
  const ask = useConfirm();
  if (ids.length === 0) return null;
  const [one, many] = words.noun;
  return (
    <RunButton
      label={
        filtered
          ? `${words.verb} ${formatCount(ids.length)} shown`
          : `${words.verb} all`
      }
      busyLabel={words.busy}
      outcomeSide="end"
      icon={icon}
      invalidate={invalidate}
      ask={confirm ? () => ask(confirm(ids.length)) : undefined}
      run={async () => {
        let ok = 0;
        let next = 0;
        const worker = async () => {
          while (next < ids.length) {
            const id = ids[next++];
            try {
              if (await run(id)) ok += 1;
            } catch {
              // Counted as failed; the card shows why after the refetch.
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
        );
        const failed = ids.length - ok;
        const capital = words.done[0].toUpperCase() + words.done.slice(1);
        return failed === 0
          ? { ok: true, message: `${capital} ${countOf(ok, one, many)}` }
          : {
              ok: false,
              message: `${formatCount(ok)} ${words.done}, ${formatCount(failed)} failed`,
            };
      }}
    />
  );
}
