import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Page";
import styles from "./Modal.module.css";

// The one dialog of both apps: centred over the page, a title with the way
// out beside it, Escape and a click outside to close, Tab kept inside, and
// focus handed back to whatever opened it. Search and confirmations are
// built on it, so they look and behave as one.
export function Modal({
  title,
  onClose,
  size = "wide",
  className,
  footer,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  // The buttons, in a bar under the content that stays put while the
  // content scrolls: Cancel or Close first, the action last.
  footer?: ReactNode;
  // "wide" for a tool (search), "narrow" for a question.
  size?: "wide" | "narrow";
  // Extra class on the panel, for a dialog's own rules.
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // Into the dialog on opening: the element marked data-autofocus, or the
  // first control. Back to where it was on closing, so a keyboard user is
  // not left at the top of the page.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const target =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>("input, button");
    target?.focus();
    return () => before?.focus();
  }, []);

  // Escape anywhere in the dialog; Tab cycles inside it, as a modal's focus
  // should, instead of wandering into the page behind it.
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // A dialog opened from this one (View changes over a confirmation)
    // sits in the same React tree: its keys stop here, so Escape closes the
    // top dialog only, and Tab is kept by that one alone.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Everything Tab stops at, links and a diff's file toggles included,
    // less what is not drawn (the inside of a closed <details>).
    const focusable = [
      ...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
    ].filter((el) => el.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    // The panel itself holds the focus after a click on its text.
    const atPanel = document.activeElement === e.currentTarget;
    if (e.shiftKey && (atPanel || document.activeElement === first)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  // On the body, not where it was opened: a dialog opened from inside
  // another one must not be clipped or stacked under it.
  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        className={className ? `${styles.dialog} ${className}` : styles.dialog}
        data-size={size}
        onKeyDown={onKey}
        // Focusable, though not by Tab: a click on the dialog's text leaves
        // the focus here rather than on the page, so Escape and Tab still
        // reach onKey.
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            <X aria-hidden />
          </button>
        </header>
        {children}
        {footer && <div className={styles.actions}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// ---------------------------------------------------------- confirmations

export interface ConfirmRequest {
  title: string;
  message: ReactNode;
  // The action, as a verb: "Roll back", "Sync 3".
  confirmLabel: string;
  cancelLabel?: string;
  // More buttons, between Cancel and the action: something to look at
  // before deciding ("View changes"). They do not close the dialog.
  extra?: ReactNode;
}

type Ask = (request: ConfirmRequest) => Promise<boolean>;

// Without a provider (a test rendering one component), the browser's own
// dialog: never a write without the question.
const fallback: Ask = async (request) =>
  window.confirm(
    `${request.title}\n\n${typeof request.message === "string" ? request.message : ""}`,
  );

const ConfirmContext = createContext<Ask>(fallback);

// Asks before a write, in the app's own dialog: `await confirm({...})` is
// true for the action, false for Cancel, Escape or a click outside.
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

// One per app (the shell holds it): the dialog every useConfirm opens.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    request: ConfirmRequest;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const ask = useCallback<Ask>(
    (request) =>
      new Promise<boolean>((resolve) => setPending({ request, resolve })),
    [],
  );
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <Modal
          title={pending.request.title}
          size="narrow"
          onClose={() => answer(false)}
          footer={
            <>
              {/* Cancel has the focus: Enter on a write must be a choice. */}
              <Button data-autofocus onClick={() => answer(false)}>
                {pending.request.cancelLabel ?? "Cancel"}
              </Button>
              {pending.request.extra}
              <Button variant="primary" onClick={() => answer(true)}>
                {pending.request.confirmLabel}
              </Button>
            </>
          }
        >
          <div className={styles.body}>{pending.request.message}</div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
