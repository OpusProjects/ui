import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@opusprojects/unified-ui";
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
}

export function RunButton({
  label,
  busyLabel,
  run,
  invalidate,
  outcomeSide = "start",
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

  return (
    <div className={styles.run} data-outcome={outcomeSide}>
      {outcome && !mutation.isPending && (
        <span
          className={styles.outcome}
          data-ok={outcome.ok}
          role="status"
          title={outcome.message}
        >
          {outcome.message}
        </span>
      )}
      <Button
        icon={
          <RefreshCw
            className={mutation.isPending ? styles.spinning : undefined}
          />
        }
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? busyLabel : label}
      </Button>
    </div>
  );
}
