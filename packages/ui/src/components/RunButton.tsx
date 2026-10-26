import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "./Page";
import styles from "./RunButton.module.css";

interface Outcome {
  ok: boolean;
  message: string;
}

interface RunButtonProps {
  label: string;
  // Shown while it runs, as what is happening ("Syncing…"), not the
  // command that started it.
  busyLabel: string;
  // Runs the action and says how it went; a thrown error is shown as a failure.
  run: () => Promise<Outcome>;
  // Queries to refetch afterwards, so the card shows the new state at once
  // instead of on the next poll.
  invalidate: string[][];
  // Where the outcome is written. Before the button by default (a card's
  // footer, where the button sits at the right edge); after it in a toolbar,
  // where text appearing before the button would push it and its
  // neighbours along.
  outcomeSide?: "start" | "end";
  // "primary" for the action a page is about (gitops' Sync); quiet otherwise.
  variant?: "quiet" | "primary";
  // Replaces the refresh arrows; spins the same way while running.
  icon?: ReactNode;
  // Shown but not usable, with `reason` on hover saying why: a column of
  // buttons reads better whole than with gaps where one does not apply.
  disabled?: boolean;
  reason?: string;
  // Asked on the click, before anything runs (a confirmation): false and
  // nothing happens. Not part of `run`, so the button only says it is busy
  // once the answer was yes.
  ask?: () => Promise<boolean>;
}

// How long a success is shown before it fades, and how long the fade takes.
const SHOW_MS = 3000;
const FADE_MS = 400;

export function RunButton({
  label,
  busyLabel,
  run,
  invalidate,
  outcomeSide = "start",
  variant,
  icon,
  disabled = false,
  reason,
  ask,
}: RunButtonProps) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: run,
    onSettled: () =>
      Promise.all(
        invalidate.map((queryKey) => client.invalidateQueries({ queryKey })),
      ),
  });

  const outcome: Outcome | undefined = mutation.isError
    ? { ok: false, message: mutation.error.message }
    : mutation.data;

  // A success has been read after a few seconds, and lingering it would
  // claim to be the latest news long after it is not: it fades, then goes.
  // A failure stays until the next click, the only place it is said beside
  // the button.
  const [fading, setFading] = useState(false);
  const succeeded = !!outcome?.ok && !mutation.isPending;
  useEffect(() => {
    if (!succeeded) return;
    setFading(false);
    const fade = window.setTimeout(() => setFading(true), SHOW_MS);
    const gone = window.setTimeout(() => mutation.reset(), SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
    // Once per result: the mutation object is new every render.
  }, [succeeded, mutation.submittedAt]);

  return (
    <div className={styles.run} data-outcome={outcomeSide}>
      {outcome && !mutation.isPending && (
        <span
          className={styles.outcome}
          data-ok={outcome.ok}
          data-fading={(succeeded && fading) || undefined}
          role="status"
          title={outcome.message}
        >
          {outcome.message}
        </span>
      )}
      <Button
        variant={variant}
        icon={
          <span className={mutation.isPending ? styles.spinning : styles.still}>
            {icon ?? <RefreshCw />}
          </span>
        }
        disabled={disabled || mutation.isPending}
        title={disabled ? reason : undefined}
        data-unavailable={disabled || undefined}
        onClick={async () => {
          if (ask && !(await ask())) return;
          mutation.mutate();
        }}
      >
        {mutation.isPending ? busyLabel : label}
      </Button>
    </div>
  );
}
