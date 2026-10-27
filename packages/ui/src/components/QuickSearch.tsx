import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Modal } from "./Modal";
import styles from "./QuickSearch.module.css";
import { countOf, formatCount } from "../lib/format";

// The classes a result is drawn with (name, nameRow, detail), so every
// app's results read alike whatever they show.
export { styles as quickSearchStyles };

export interface QuickSearchProps<T> {
  // "Find a host": the menu's button and the dialog's title.
  label: string;
  placeholder: string;
  // Under the field until enough is typed: what is searched, and how.
  intro: ReactNode;
  // When nothing matches the query.
  noMatch: (query: string) => ReactNode;
  // The query cache's key for this search; the query is appended to it.
  queryKey: string;
  // The app's own API call. `total` is how many matched in all, when the
  // API says so and returns only the best of them. `warning`, when part of
  // the search failed: shown above whatever the rest found.
  search: (
    query: string,
  ) => Promise<{ items: T[]; total?: number; warning?: ReactNode }>;
  itemKey: (item: T) => string;
  // One result's content, inside its option: lines with quickSearchStyles.
  renderItem: (item: T) => ReactNode;
  // Enter or a click on a result: the app navigates (its router, so the
  // library stays out of routing). The dialog has closed by then.
  onOpen: (item: T) => void;
  // Shorter queries are not sent: one character matches nearly everything.
  minLength?: number;
}

// Opens on "/" or Ctrl+K anywhere, as search does in most tools, except
// while typing in a field, where "/" is a character.
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// "Where is this?" from any page: a field-shaped button for the menu (the
// shell's `search` slot), and the dialog it opens. What is searched and
// where a result leads are the app's; the keys, focus and look are shared.
export function QuickSearch<T>(props: QuickSearchProps<T>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut =
        (event.key === "k" && (event.ctrlKey || event.metaKey)) ||
        (event.key === "/" && !isTyping(event.target));
      if (shortcut) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={props.label}
      >
        <Search aria-hidden />
        <span className={styles.triggerText}>{props.label}</span>
        <kbd className={styles.key}>/</kbd>
      </button>
      {open && <SearchDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog<T>({
  label,
  placeholder,
  intro,
  noMatch,
  queryKey,
  search,
  itemKey,
  renderItem,
  onOpen,
  minLength = 2,
  onClose,
}: QuickSearchProps<T> & { onClose: () => void }) {
  const listId = useId();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // A request when typing pauses, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [text]);
  useEffect(() => setActive(0), [query]);

  const long = query.length >= minLength;
  const results = useQuery({
    queryKey: [queryKey, query],
    enabled: long,
    queryFn: () => search(query),
    staleTime: 15_000,
  });
  const items = long ? (results.data?.items ?? []) : [];
  const total = results.data?.total;
  const warning = long ? results.data?.warning : undefined;
  // Never past the end (results can shrink as typing narrows them) nor
  // before the start (an arrow key pressed while the list was still empty).
  const current = Math.max(0, Math.min(active, items.length - 1));

  const open = (item: T) => {
    onClose();
    onOpen(item);
  };

  // The keys, focus and look of every dialog come from Modal; the field
  // takes the focus on opening.
  return (
    <Modal title={label} onClose={onClose} className={styles.searchDialog}>
      <label className={styles.field}>
        <Search aria-hidden />
        <input
          data-autofocus
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            items[current] ? `${listId}-${current}` : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(() => Math.min(items.length - 1, current + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(() => Math.max(0, current - 1));
            } else if (e.key === "Enter" && items[current]) {
              open(items[current]);
            }
          }}
        />
      </label>

      {warning && (
        <p className={`${styles.note} ${styles.warning}`} role="status">
          {warning}
        </p>
      )}
      {!long ? (
        <p className={styles.note}>{intro}</p>
      ) : results.isPending ? (
        <p className={styles.note}>Searching…</p>
      ) : results.isError ? (
        <p className={styles.note}>{results.error.message}</p>
      ) : items.length === 0 ? (
        <p className={styles.note}>{noMatch(query)}</p>
      ) : (
        <>
          <ul id={listId} className={styles.results} role="listbox">
            {items.map((item, i) => (
              <li
                key={itemKey(item)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(item)}
              >
                {renderItem(item)}
              </li>
            ))}
          </ul>
          <p className={styles.footer}>
            {total !== undefined && total > items.length
              ? `The ${formatCount(items.length)} best of ${formatCount(total)} matches: type more.`
              : `${countOf(items.length, "match", "matches")}.`}{" "}
            ↑↓ to choose, Enter to open, Esc to close.
          </p>
        </>
      )}
    </Modal>
  );
}
