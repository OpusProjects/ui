import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import styles from "./InfoHint.module.css";

// An info icon after a title, with an explanation that opens on hover and on
// keyboard focus and is read out as the icon's description. For what a
// number counts and how it is worked out: the detail a reader needs to trust
// it, too long for the card itself.
//
// It opens where it fits, shifted to stay inside the window: measured when it
// opens, because the same card sits at the left edge on one screen and the
// right on another.
//
// With children, the children are the trigger instead of the icon: a label
// that explains itself (dotted underline, as a term with a definition), for
// rows of facts where an icon on every label would be noise.
export function InfoHint({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // How far the box moves sideways to stay on screen, measured once each
  // time it opens: from where it would start (under the trigger) to where it
  // fits, clamped to the window's edges. Measuring once, from the trigger
  // rather than from the box's own last position, is what keeps it from
  // flipping back and forth on a screen too narrow for either side.
  const [shift, setShift] = useState(0);
  const popover = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !popover.current) return;
    const trigger = popover.current.parentElement!.getBoundingClientRect();
    const width = popover.current.getBoundingClientRect().width;
    const natural = trigger.left - 8;
    const fitted = Math.max(
      8,
      Math.min(natural, window.innerWidth - 8 - width),
    );
    setShift(fitted - natural);
  }, [open]);

  return (
    <span
      className={children ? styles.term : styles.hint}
      tabIndex={0}
      aria-describedby={id}
      // The icon has no text of its own; a term already reads as its text.
      aria-label={children ? undefined : "About this"}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      {children ?? <Info aria-hidden />}
      <span
        ref={popover}
        id={id}
        role="tooltip"
        className={styles.text}
        data-open={open || undefined}
        style={{ transform: shift ? `translateX(${shift}px)` : undefined }}
      >
        {text}
      </span>
    </span>
  );
}
