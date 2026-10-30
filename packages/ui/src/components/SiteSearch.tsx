import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "./Page";
import { QuickSearch, quickSearchStyles as styles } from "./QuickSearch";

// One kind of configured item the search finds by name: sources,
// applications, connectors... Each opens its own page, /<key>/<id>.
export interface SearchSection {
  // The route and the list's cache key: "connectors".
  key: string;
  // What one is called, on its result: "Connector".
  label: string;
  // The list, as the app's API answers it, reduced to what is searched.
  load: () => Promise<{ id: string; title?: string | null }[]>;
}

// What the app searches besides names: hosts in the caches, objects on the
// systems. Its results follow the items, drawn and opened by the app.
export interface DeepSearch<T> {
  search: (query: string) => Promise<T[]>;
  key: (found: T) => string;
  render: (found: T) => ReactNode;
  open: (found: T) => void;
}

type Result<T> =
  | { item: { section: SearchSection; id: string; title?: string | null } }
  | { deep: T };

const LIMIT = 12;

// "Search" in both apps' menus: configured items by name or label first,
// each opening its page (names that start with the query before those that
// contain it), then whatever the app searches deeper, if anything. A list this key may
// not read (an admin-only one, for a restricted key) is left out.
export function SiteSearch<T>({
  sections,
  deep,
  what,
}: {
  sections: SearchSection[];
  deep?: DeepSearch<T>;
  // What the deep search looks through, for the hint: "hosts by name".
  what?: string;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();

  const items = async () => {
    const lists = await Promise.allSettled(
      sections.map((section) =>
        client.fetchQuery({
          queryKey: ["search", section.key],
          queryFn: section.load,
          staleTime: 30_000,
          retry: false,
        }),
      ),
    );
    return lists.flatMap((list, i) =>
      list.status === "fulfilled"
        ? list.value.map((item) => ({ section: sections[i], ...item }))
        : [],
    );
  };

  return (
    <QuickSearch<Result<T>>
      label="Search"
      placeholder="Search"
      intro={
        deep && what
          ? `Two characters or more: names first, then ${what}.`
          : "Two characters or more, to find anything configured by name."
      }
      noMatch={(query) => `Nothing matches “${query}”.`}
      queryKey="site-search"
      search={async (query) => {
        const needle = query.trim().toLowerCase();
        // Settled, not all: a deep search that fails (a backend without
        // it, an error) still leaves the name matches, and says so.
        const [configured, found] = await Promise.all([
          items(),
          (deep?.search(query) ?? Promise.resolve([] as T[])).then(
            (list) => ({ list, error: undefined }),
            (e: unknown) => ({
              list: [] as T[],
              error: e instanceof Error ? e.message : String(e),
            }),
          ),
        ]);
        const matching = configured
          .filter((item) =>
            `${item.id} ${item.title ?? ""}`.toLowerCase().includes(needle),
          )
          .sort(
            (a, b) =>
              Number(!a.id.toLowerCase().startsWith(needle)) -
              Number(!b.id.toLowerCase().startsWith(needle)),
          );
        return {
          items: [
            ...matching.map((item) => ({ item })),
            ...found.list.map((deep) => ({ deep })),
          ].slice(0, LIMIT),
          warning: found.error && `Could not search ${what}: ${found.error}`,
        };
      }}
      itemKey={(result) =>
        "item" in result
          ? `${result.item.section.key}/${result.item.id}`
          : `deep/${deep!.key(result.deep)}`
      }
      onOpen={(result) =>
        "item" in result
          ? navigate(
              `/${result.item.section.key}/${encodeURIComponent(result.item.id)}`,
            )
          : deep!.open(result.deep)
      }
      renderItem={(result) => {
        if (!("item" in result)) return deep!.render(result.deep);
        const { item } = result;
        return (
          <>
            <span className={styles.nameRow}>
              <span className={styles.name}>{item.id}</span>
              <Badge tone="neutral">{item.section.label}</Badge>
            </span>
            {item.title && item.title !== item.id && (
              <span className={styles.detail}>{item.title}</span>
            )}
          </>
        );
      }}
    />
  );
}
