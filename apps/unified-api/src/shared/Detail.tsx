import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import styles from "./Detail.module.css";

// The classes the detail pages share (facts grid, links, the error box), so
// the three pages read alike.
export { styles as common };

// "Sources › Device42 CDI Inventory": where you came from, a quiet link
// back, then this item, all in the title's own type.
export function DetailTitle({
  section,
  to,
  children,
}: {
  section: string;
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
