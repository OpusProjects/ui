import { useRef, type ReactNode } from "react";
import { List } from "lucide-react";
import { Button, SearchField } from "@opusprojects/unified-ui";
import type { HealthState } from "@opusprojects/unified-client";
import styles from "./ListToolbar.module.css";

interface ListFilter {
  query: string;
  setQuery: (query: string) => void;
  selected: HealthState | null;
  setSelected: (state: HealthState | null) => void;
}

// A list page's search, its "Show all", and any action on the whole list
// (Sources' "Sync all") after them, in one row as tall as the search box.
//
// "Show all" undoes both ways the list narrows, the search and the state
// picked in the summary above, so "all" is true; pages using it turn the
// summary's own "Show all" chip off (two buttons by one name that did
// different things). Greyed out rather than hidden while nothing is hidden,
// so the row does not shift as you start typing.
export function ListToolbar({
  filter,
  label,
  placeholder,
  children,
}: {
  filter: ListFilter;
  label: string;
  placeholder: string;
  children?: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.toolbar} ref={row}>
      <SearchField
        label={label}
        placeholder={placeholder}
        value={filter.query}
        onChange={filter.setQuery}
      />
      <Button
        icon={<List />}
        disabled={filter.query === "" && filter.selected === null}
        onClick={() => {
          filter.setQuery("");
          filter.setSelected(null);
          row.current?.querySelector("input")?.focus();
        }}
      >
        Show all
      </Button>
      {children}
    </div>
  );
}
