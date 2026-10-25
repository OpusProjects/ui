import { useMemo, useState } from "react";
import { HEALTH_ORDER, type HealthState } from "@opusprojects/unified-client";

// The search box and the summary bar filter the same list, so every page
// shares this: counts come from the whole list (the bar must not shrink as you
// type), the grid shows what passes both filters.
export function useListFilter<T>(
  items: T[],
  stateOf: (item: T) => HealthState,
  searchText: (item: T) => string,
) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HealthState | null>(null);

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      HEALTH_ORDER.map((state) => [state, 0]),
    ) as Record<HealthState, number>;
    for (const item of items) result[stateOf(item)] += 1;
    return result;
  }, [items, stateOf]);

  const needle = query.trim().toLowerCase();
  const visible = items
    .filter((item) => selected === null || stateOf(item) === selected)
    .filter(
      (item) =>
        needle === "" || searchText(item).toLowerCase().includes(needle),
    )
    // Worst first: the cards that need a person lead the grid.
    .sort(
      (a, b) =>
        HEALTH_ORDER.indexOf(stateOf(a)) - HEALTH_ORDER.indexOf(stateOf(b)),
    );

  return { query, setQuery, selected, setSelected, counts, visible };
}
