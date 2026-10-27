import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { InfoHint } from "./InfoHint";
import styles from "./Page.module.css";

interface PageHeaderProps {
  // Text, or a trail ("Sources › Device42") on a page under another.
  title: ReactNode;
  // The section's icon, the same one the menu shows beside its name.
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  icon,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>
          {icon && (
            <span className={styles.titleIcon} aria-hidden>
              {icon}
            </span>
          )}
          {title}
        </h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  // "compact" for a toolbar inside a panel, beside other controls.
  size?: "regular" | "compact";
}

// Filters as you type: lists here are tens of items held in memory, so a
// search button would only add a click.
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  size = "regular",
}: SearchFieldProps) {
  return (
    <label className={styles.search} data-size={size}>
      <Search aria-hidden className={styles.searchIcon} />
      <span className={styles.visuallyHidden}>{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "quiet";
  icon?: ReactNode;
}

export function Button({
  variant = "quiet",
  icon,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      data-variant={variant}
      {...rest}
    >
      {icon && (
        <span className={styles.buttonIcon} aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyBody}>{children}</div>}
    </div>
  );
}

interface NoticeProps {
  title: string;
  children?: ReactNode;
  // "failing" (red, the default): something broke. "stale" (amber): a
  // state someone chose and has to come back to, like a rollback.
  tone?: "failing" | "stale";
}

// A failure to load the page itself, as opposed to a failing resource on it.
export function Notice({ title, children, tone = "failing" }: NoticeProps) {
  return (
    <div
      className={styles.notice}
      data-tone={tone}
      role={tone === "failing" ? "alert" : "status"}
    >
      <p className={styles.noticeTitle}>{title}</p>
      {children && <div>{children}</div>}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

interface PanelProps {
  // Optional: a panel whose content carries its own headings (two columns,
  // each with a title) leaves it out.
  title?: string;
  // Behind an info icon after the title: how the content is worked out.
  hint?: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  // For placing the panel in a page's own layout (a grid of two, say).
  className?: string;
}

// A titled block of a detail or settings page.
export function Panel({
  title,
  hint,
  description,
  aside,
  children,
  className,
}: PanelProps) {
  return (
    <section
      className={className ? `${styles.panel} ${className}` : styles.panel}
    >
      {title && (
        <header className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>
              {title}
              {hint && <InfoHint text={hint} />}
            </h2>
            {description && (
              <p className={styles.panelDescription}>{description}</p>
            )}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

interface ChipListProps {
  items: string[];
  empty?: string;
  // Show this many, then a "+N more" button that opens the rest (and a
  // "Show less" to fold them again). "line": as many as fit on one line,
  // the button included, measured (and measured again when the space
  // changes). Unset = always all.
  limit?: number | "line";
  // Makes a chip a link to what it names: given the item and the chip's
  // class, returns the app's link (its router's Link, an <a>), or nothing to
  // leave that chip plain. The app supplies the link, as with ResourceCard's
  // titleLink, so the library stays out of routing.
  linkTo?: (item: string, className: string) => ReactNode | undefined;
}

// Identifiers (groups, source ids, usernames) as a wrapping row of tokens.
export function ChipList({
  items,
  empty = "None",
  limit,
  linkTo,
}: ChipListProps) {
  const [open, setOpen] = useState(false);
  const line = limit === "line";
  const box = useRef<HTMLSpanElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  // How many fit on the line, in "line" mode; all until measured.
  const [fit, setFit] = useState(items.length);
  const key = items.join("\n");
  useLayoutEffect(() => {
    if (!line) return;
    const container = box.current;
    const sample = ruler.current;
    if (!container || !sample) return;
    // The ruler holds every chip, then the widest the button can read, on
    // one unwrapped line out of sight: their widths, without the line
    // itself having to overflow first.
    const count = () => {
      const width = container.clientWidth;
      const measured = Array.from(sample.children).map(
        (el) => el.getBoundingClientRect().width,
      );
      const button = measured.pop() ?? 0;
      const gap = parseFloat(getComputedStyle(sample).columnGap) || 0;
      let used = 0;
      let n = 0;
      for (let i = 0; i < measured.length; i++) {
        const next = used + (i > 0 ? gap : 0) + measured[i];
        const more = i + 1 < measured.length ? gap + button : 0;
        // A pixel to spare: the widths are fractional, the line's is not.
        if (next + more > width - 1) break;
        used = next;
        n = i + 1;
      }
      // At least one, even if it must be cut short: a button alone says
      // nothing about what the list holds.
      setFit(Math.max(1, n));
    };
    count();
    // Counted again whenever the line's width changes, and whenever a
    // chip's does: a font that arrives after the first count widens every
    // chip without the line changing at all, and the old count then
    // pushed "+N more" past the edge. On the next frame: the count changes
    // what the line holds, which an observer in the same pass would be
    // told about mid-loop.
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(count);
    };
    const observer = new ResizeObserver(later);
    observer.observe(container);
    for (const chip of Array.from(sample.children)) observer.observe(chip);
    void document.fonts?.ready.then(later);
    document.fonts?.addEventListener("loadingdone", later);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", later);
    };
  }, [line, key]);

  // The count above is worked out from copies of the chips; the line
  // itself has the last word. If a chip on it came out shortened (its name
  // ending in "…") or the button runs past the edge, one chip fewer, before
  // the browser paints: whatever made the copies narrower (a font, a link's
  // own style), the line ends on whole chips and a whole button.
  useLayoutEffect(() => {
    if (!line || open || fit <= 1) return;
    const container = box.current;
    if (!container) return;
    const edge = container.getBoundingClientRect().right;
    const shown = Array.from(container.children).filter(
      (el) => el !== ruler.current,
    );
    const short = shown.some(
      (el) =>
        el.scrollWidth > el.clientWidth + 0.5 ||
        el.getBoundingClientRect().right > edge + 0.5,
    );
    if (short) setFit(fit - 1);
  });

  if (items.length === 0)
    return <span className={styles.chipEmpty}>{empty}</span>;

  const keep = line ? fit : (limit ?? items.length);
  const folded = items.length > keep;
  const shown = folded && !open ? items.slice(0, keep) : items;
  const chip = (item: string) => {
    const link = linkTo?.(item, `${styles.chip} ${styles.chipLink}`);
    return link ? (
      <Fragment key={item}>{link}</Fragment>
    ) : (
      <code key={item} className={styles.chip} title={item}>
        {item}
      </code>
    );
  };
  return (
    <span
      className={styles.chips}
      ref={box}
      data-line={(line && !open) || undefined}
    >
      {line && (
        <span className={styles.chipRuler} ref={ruler} aria-hidden>
          {items.map((item) => (
            <code key={item} className={styles.chip}>
              {item}
            </code>
          ))}
          <span className={styles.chipToggle}>+{items.length} more</span>
        </span>
      )}
      {shown.map(chip)}
      {folded && (
        <button
          type="button"
          className={styles.chipToggle}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : `+${items.length - keep} more`}
        </button>
      )}
    </span>
  );
}

interface BadgeProps {
  // good / warning / danger carry a state (a create, an update, a delete in
  // a gitops plan), in the health colours, with the word inside saying it.
  tone?: "accent" | "neutral" | "off" | "good" | "warning" | "danger";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
