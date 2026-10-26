import { Link } from "react-router";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { linkify } from "./AutoLink";
import styles from "./Detail.module.css";

// The classes detail pages share (facts grid, links, the error box), so every
// app's detail pages read alike.
export { styles as detailStyles };

// "Sources › Device42 CDI Inventory": where you came from, a quiet link back,
// then this item, all in the title's own type.
export function DetailTitle({
  section,
  to,
  children,
}: {
  section: string;
  // The list page the trail leads back to.
  to: string;
  children: ReactNode;
}) {
  return (
    <span className={styles.trailTitle}>
      <Link to={to} className={styles.trail}>
        {section}
      </Link>
      <ChevronRight
        className={styles.trailArrow}
        // Drawn as heavy as the bold title around it, not as a hairline
        // beside it.
        strokeWidth={3.25}
        aria-hidden
      />
      <span>{children}</span>
    </span>
  );
}

// A long value (a path, a list of origins) in one line, cut short with the
// whole of it on hover.
export function Clip({ value }: { value: string }) {
  return (
    <code className={`${styles.mono} ${styles.clipText}`} title={value}>
      {value}
    </code>
  );
}

// A yes/no setting as a page says it; null when the instance could not tell.
export const onOff = (on: boolean | null | undefined) =>
  on == null ? "Unknown" : on ? "On" : "Off";

// Several values for one fact: the first, with "+3 more" beside it, which
// opens the rest one per line, and "Show fewer" on a line after them closes
// them, so a list never stretches its row. "None" when there are none.
export function ValueList({
  values,
  limit = 1,
  mono = false,
}: {
  values: ReactNode[];
  limit?: number;
  // Code values (env vars, keys): the monospace face.
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (values.length === 0) return <>None</>;
  const shown = open ? values : values.slice(0, limit);
  const more = values.length - limit;
  const valueClass = mono
    ? `${styles.mono} ${styles.clipText}`
    : styles.clipText;
  const toggle = (
    <button
      type="button"
      className={styles.more}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {open ? "Show fewer" : `+${more} more`}
    </button>
  );
  return (
    <span className={styles.stack}>
      {shown.map((value, i) => (
        <span key={i} className={styles.line}>
          <span className={valueClass}>{linkify(value)}</span>
          {more > 0 && !open && i === shown.length - 1 && toggle}
        </span>
      ))}
      {more > 0 && open && toggle}
    </span>
  );
}
