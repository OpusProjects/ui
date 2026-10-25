import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { formatAge } from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../api/client";
import styles from "./HostSearch.module.css";

type Found = Schemas["FoundHost"];

const LIMIT = 12;

// Opens on "/" or Ctrl+K anywhere, as search does in most tools, except
// while typing in a field, where "/" is a character.
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// "Where is this host?" from any page: a field-shaped button in the menu,
// and the dialog it opens.
export function HostSearch() {
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
        aria-label="Find a host"
      >
        <Search aria-hidden />
        <span className={styles.triggerText}>Find a host</span>
        <kbd className={styles.key}>/</kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // A request when typing pauses, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [text]);
  useEffect(() => setActive(0), [query]);
  // Focus goes into the field on opening and back to where it was (the
  // menu's button, usually) on closing, so a keyboard user is not left at
  // the top of the page.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => before?.focus();
  }, []);

  const results = useQuery({
    queryKey: ["host-search", query],
    enabled: query.length >= 2,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/hosts/search", {
          params: { query: { q: query, limit: LIMIT } },
        }),
      ),
    staleTime: 15_000,
  });
  const hosts = query.length >= 2 ? (results.data?.hosts ?? []) : [];
  // Never past the end (results can shrink as typing narrows them) nor
  // before the start (an arrow key pressed while the list was still empty).
  const current = Math.max(0, Math.min(active, hosts.length - 1));

  // Escape anywhere in the dialog, not only in the field; and Tab cycles
  // inside it, as a modal's focus should, instead of wandering into the
  // page behind it.
  const onDialogKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [
      ...e.currentTarget.querySelectorAll<HTMLElement>("input, button"),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  // Opens the host on the first source that holds it, selected in its list.
  const open = (found: Found) => {
    const source = found.sources[0]?.source_id;
    if (!source) return;
    onClose();
    navigate(
      `/sources/${encodeURIComponent(source)}?host=${encodeURIComponent(found.host)}`,
    );
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.dialog}
        onKeyDown={onDialogKey}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${listId}-title`}
      >
        <header className={styles.header}>
          <h2 id={`${listId}-title`} className={styles.title}>
            Find a host
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
        <label className={styles.field}>
          <Search aria-hidden />
          <input
            ref={input}
            type="text"
            placeholder="Find a host by name, or part of it"
            value={text}
            onChange={(e) => setText(e.target.value)}
            role="combobox"
            aria-expanded={hosts.length > 0}
            aria-controls={listId}
            aria-activedescendant={
              hosts[current] ? `${listId}-${current}` : undefined
            }
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(() => Math.min(hosts.length - 1, current + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(() => Math.max(0, current - 1));
              } else if (e.key === "Enter" && hosts[current]) {
                open(hosts[current]);
              }
            }}
          />
        </label>

        {query.length < 2 ? (
          <p className={styles.note}>
            Type at least two characters: every source this instance holds is
            searched, from its cache.
          </p>
        ) : results.isPending ? (
          <p className={styles.note}>Searching…</p>
        ) : results.isError ? (
          <p className={styles.note}>{results.error.message}</p>
        ) : hosts.length === 0 ? (
          <p className={styles.note}>No host matches “{query}”.</p>
        ) : (
          <>
            <ul id={listId} className={styles.results} role="listbox">
              {hosts.map((found, i) => (
                <li
                  key={found.host}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => open(found)}
                >
                  <span className={styles.host}>{found.host}</span>
                  <span className={styles.where}>
                    In{" "}
                    {found.sources
                      .map(
                        (s) => `${s.source_id} (${formatAge(s.age_seconds)})`,
                      )
                      .join(", ")}
                  </span>
                  {found.endpoints.length > 0 && (
                    <span className={styles.where}>
                      Reaches {found.endpoints.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className={styles.footer}>
              {results.data && results.data.total > hosts.length
                ? `The ${hosts.length} best of ${results.data.total.toLocaleString()} matches: type more to narrow it.`
                : `${hosts.length} ${hosts.length === 1 ? "match" : "matches"}.`}{" "}
              Arrow keys to choose, Enter to open, Esc to close.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
