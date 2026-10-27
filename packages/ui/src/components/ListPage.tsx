import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useListFilter, type HealthState } from "@opusprojects/unified-client";
import { CardGrid, EmptyState, PageHeader } from "./Page";
import { HealthSummary } from "./Health";
import { ListToolbar } from "./ListToolbar";
import { orderOptions } from "./OrderMenu";
import { Notice } from "./Page";
import { SkeletonGrid, SkeletonSummary, useRememberedCount } from "./Skeleton";

type Labels = Partial<Record<HealthState, string>>;
type Filter<T> = ReturnType<typeof useListFilter<T>>;

export interface ListPageProps<T> {
  // The page's own query: what it lists, loading and failing included.
  query: UseQueryResult<T[]>;
  header: { icon: ReactNode; title: string; description: string };
  // What is listed, as [one, many]: ["credential", "credentials"]. Also the
  // key the skeleton remembers the last count under.
  noun: [string, string];
  state: (item: T) => HealthState;
  labels?: Labels;
  // What "all good" means here, when it is not "healthy".
  good?: string;
  // What the search box matches against, and what it says it matches.
  search: (item: T) => string;
  // What a card is called (its title): what the Order menu's A to Z and
  // Z to A order by, A to Z the default.
  name: (item: T) => string;
  placeholder: string;
  // Actions on the whole visible list (Sync all, Pull all), after the search.
  actions?: (filter: Filter<T>, items: T[]) => ReactNode;
  // What to say when nothing is configured: where to declare one.
  empty: ReactNode;
  card: (item: T) => ReactNode;
}

// Every list page: a header, a health bar that filters, a search, then the
// cards, A to Z (the Order menu turns them Z to A). Loading shows skeletons sized by the last visit's count;
// a failed load says so; an empty list says how to add one, and a filter that
// hides everything says how to undo it.
export function ListPage<T>({
  query,
  header,
  noun,
  state,
  labels,
  good,
  search,
  name,
  placeholder,
  actions,
  empty,
  card,
}: ListPageProps<T>) {
  const items = query.data ?? [];
  const filter = useListFilter(items, state, search, {
    name,
    key: noun[1],
    orders: ["az", "za"],
  });
  const remembered = useRememberedCount(
    noun[1],
    query.isSuccess ? query.data?.length : undefined,
  );
  const many = noun[1];

  return (
    <>
      <PageHeader {...header} />
      {query.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {query.isError && (
        <Notice title={`Could not load ${many}`}>{query.error.message}</Notice>
      )}
      {query.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={noun}
            labels={labels}
            good={good}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label={`Search ${many}`}
            placeholder={placeholder}
            orders={orderOptions()}
          >
            {actions?.(filter, items)}
          </ListToolbar>
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? `No ${many} configured`
                  : `No ${many} match`
              }
            >
              {items.length === 0
                ? empty
                : `Clear the search or the filter to see every ${noun[0]}.`}
            </EmptyState>
          ) : (
            <CardGrid>{filter.visible.map(card)}</CardGrid>
          )}
        </>
      )}
    </>
  );
}
