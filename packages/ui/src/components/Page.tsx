import {
  Fragment,
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
}

// A failure to load the page itself, as opposed to a failing resource on it.
export function Notice({ title, children }: NoticeProps) {
  return (
    <div className={styles.notice} role="alert">
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
  // "Show less" to fold them again). Unset = always all.
  limit?: number;
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
  if (items.length === 0)
    return <span className={styles.chipEmpty}>{empty}</span>;

  const folded = limit !== undefined && items.length > limit;
  const shown = folded && !open ? items.slice(0, limit) : items;
  return (
    <span className={styles.chips}>
      {shown.map((item) => {
        const link = linkTo?.(item, `${styles.chip} ${styles.chipLink}`);
        return link ? (
          <Fragment key={item}>{link}</Fragment>
        ) : (
          <code key={item} className={styles.chip}>
            {item}
          </code>
        );
      })}
      {folded && (
        <button
          type="button"
          className={styles.chipToggle}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : `+${items.length - limit} more`}
        </button>
      )}
    </span>
  );
}

interface BadgeProps {
  tone?: "accent" | "neutral" | "off";
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
