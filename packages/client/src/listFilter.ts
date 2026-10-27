import { useMemo, useState } from "react";
import { HEALTH_ORDER, type HealthState } from "./health";

// How a list is ordered: by health, worst first (the default: the cards that
// need a person lead) or best first, or by name.
export type ListOrder = "attention" | "healthy" | "az" | "za";
const ORDERS: ListOrder[] = ["attention", "healthy", "az", "za"];

// Remembered per list in the browser, so a list opens as it was left; an
// order the list does not offer (any more) falls back to its first. Storage
// can be missing or refuse (a private window): then it is per visit.
function remembered(key: string | undefined, offered: ListOrder[]): ListOrder {
  if (!key) return offered[0];
  try {
    const value = window.localStorage.getItem(`order:${key}`) as ListOrder;
    return offered.includes(value) ? value : offered[0];
  } catch {
    return offered[0];
  }
}

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

// The search box and the summary bar filter the same list, so every page
// shares this: counts come from the whole list (the bar must not shrink as you
// type), the grid shows what passes both filters, in the order chosen. With
// a `name`, names order the list (A to Z, Z to A) and the cards within each
// state; `orders` are the ones the list offers, its default first (worst
// first unless told otherwise); `key` remembers the order chosen.
export function useListFilter<T>(
  items: T[],
  stateOf: (item: T) => HealthState,
  searchText: (item: T) => string,
  options: {
    name?: (item: T) => string;
    key?: string;
    orders?: ListOrder[];
  } = {},
) {
  const { name, key, orders = ORDERS } = options;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HealthState | null>(null);
  const [order, setOrderState] = useState<ListOrder>(() =>
    remembered(key, orders),
  );
  const setOrder = (next: ListOrder) => {
    setOrderState(next);
    if (!key) return;
    try {
      window.localStorage.setItem(`order:${key}`, next);
    } catch {
      // Not remembered; it still applies for this visit.
    }
  };

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
    .sort((a, b) => {
      const names = name ? byName.compare(name(a), name(b)) : 0;
      if (order === "az") return names;
      if (order === "za") return -names;
      const health =
        HEALTH_ORDER.indexOf(stateOf(a)) - HEALTH_ORDER.indexOf(stateOf(b));
      // Worst first by default: the cards that need a person lead the grid.
      return (order === "healthy" ? -health : health) || names;
    });

  return {
    query,
    setQuery,
    selected,
    setSelected,
    order,
    setOrder,
    counts,
    visible,
  };
}
