import {
  useEffect,
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
  // Where the box opens, in the window's own coordinates (it is fixed, so it
  // never counts towards the page's width or height, and cannot give the
  // page a scrollbar): under the trigger, moved sideways to fit inside the
  // visible width (the window less its scrollbar), measured once each time
  // it opens. Measuring once, from the trigger, is what keeps it from
  // flipping back and forth on a screen too narrow for either side.
  const [place, setPlace] = useState<{ top: number; left: number } | null>(
    null,
  );
  const popover = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !popover.current) return;
    const trigger = popover.current.parentElement!.getBoundingClientRect();
    const { width, height } = popover.current.getBoundingClientRect();
    const visible = document.documentElement.clientWidth;
    const below = trigger.bottom + 6;
    setPlace({
      // Above the trigger when there is no room under it.
      top:
        below + height > window.innerHeight - 8
          ? Math.max(8, trigger.top - 6 - height)
          : below,
      left: Math.max(8, Math.min(trigger.left - 8, visible - 8 - width)),
    });
  }, [open]);

  // A scroll moves the trigger from under a fixed box: close it rather than
  // leave it floating over something else.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  return (
    <span
      className={children ? styles.term : styles.hint}
      tabIndex={0}
      aria-describedby={id}
      // The icon has no text of its own; a term already reads as its text.
      aria-label={children ? undefined : "About this"}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        setOpen(false);
        setPlace(null);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => {
        setOpen(false);
        setPlace(null);
      }}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      {children ?? <Info aria-hidden />}
      <span
        ref={popover}
        id={id}
        role="tooltip"
        className={styles.text}
        data-open={open || undefined}
        // Measured on opening; until then it is laid out off screen to be
        // measured, never where it could be seen in the wrong place.
        style={
          place
            ? { top: place.top, left: place.left }
            : { top: 0, left: -10000 }
        }
      >
        {text}
      </span>
    </span>
  );
}
