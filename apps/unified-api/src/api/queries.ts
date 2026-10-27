import { useQueries, useQuery } from "@tanstack/react-query";
import { api, unwrap, type Schemas } from "./client";

// Ages and health change with the clock, so every list polls. Fifteen seconds
// is well under the shortest sync interval anyone configures.
const POLL_MS = 15_000;

export function useApiIndex() {
  return useQuery({
    queryKey: ["index"],
    queryFn: async () => unwrap(await api.GET("/api/v1/")),
    staleTime: Infinity,
  });
}

export interface SourceRow {
  summary: Schemas["CachedSourceInfo"];
  detail?: Schemas["SourceDetail"];
}

// The list says whether each source is healthy; only the detail carries its
// name, TTL and how it gathers. Fetched per source, in parallel, and the card
// renders from the summary until its detail arrives.
// The list alone, without each source's detail: enough to know how they are
// doing. Shares its cache entry with useSources.
export function useSourceList() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: async () => unwrap(await api.GET("/api/v1/sources")),
    refetchInterval: POLL_MS,
  });
}

// Every source, each with its detail. `only`, when given, fetches the
// details of those sources alone (the others' rows carry none): a page
// listing three sources need not poll every source's detail, each with its
// history, every 15 seconds. The cache keys are the detail pages', so they
// share what is fetched.
export function useSources(
  only?: (summary: { source_id: string; kind: string }) => boolean,
) {
  const list = useSourceList();
  const wanted = (list.data ?? []).filter((s) => !only || only(s));

  const details = useQueries({
    queries: wanted.map((source) => ({
      queryKey: ["source", source.source_id],
      queryFn: async () =>
        unwrap(
          await api.GET("/api/v1/sources/{id}", {
            params: { path: { id: source.source_id } },
          }),
        ),
      refetchInterval: POLL_MS,
    })),
  });

  const byId = new Map(
    wanted.map((source, index) => [source.source_id, details[index]?.data]),
  );
  const rows: SourceRow[] = (list.data ?? []).map((summary) => ({
    summary,
    detail: byId.get(summary.source_id),
  }));

  return { ...list, rows };
}

export function useEndpoints() {
  return useQuery({
    queryKey: ["endpoints"],
    queryFn: async () => unwrap(await api.GET("/api/v1/endpoints")),
    refetchInterval: POLL_MS,
  });
}

// Hosts and groups in an endpoint's default output, merged by the API
// without rendering it. Refetched with the list, since a source's sync
// changes them.
export function useEndpointCounts(id: string) {
  return useQuery({
    queryKey: ["endpoint", id, "counts"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/endpoints/{id}/counts", {
          params: { path: { id } },
        }),
      ),
    refetchInterval: POLL_MS,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => unwrap(await api.GET("/api/v1/projects")),
    refetchInterval: POLL_MS,
  });
}

// Every connector (the configured ones and the two built-ins), what it runs
// and how the sources using it are doing. Admin-only, like projects.
export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    queryFn: async () => unwrap(await api.GET("/api/v1/connectors")),
    refetchInterval: POLL_MS,
  });
}

// One connector, or null when none has that id (a 404), so the page can say
// so instead of showing an error.
export function useConnector(id: string) {
  return useQuery({
    queryKey: ["connector", id],
    queryFn: async () => {
      const result = await api.GET("/api/v1/connectors/{id}", {
        params: { path: { id } },
      });
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
    refetchInterval: POLL_MS,
  });
}

// The credentials configured here, whether each resolves, and what uses
// it. Admin-only, like projects. Polled: a secret set or removed shows up.
export function useCredentials() {
  return useQuery({
    queryKey: ["credentials"],
    queryFn: async () => unwrap(await api.GET("/api/v1/credentials")),
    refetchInterval: POLL_MS,
  });
}

// The configuration in force, defaults included. Admin-only: a restricted
// caller is refused, once (no retries), and the page shows the rest.
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => unwrap(await api.GET("/api/v1/settings")),
    retry: false,
  });
}

// Who is signed in, and (for an admin) every way in. Changes only with a
// configuration push, so it does not poll.
export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: async () => unwrap(await api.GET("/api/v1/auth")),
    staleTime: 60_000,
  });
}

// The federation map. Each load asks every peer to describe itself, so it
// refreshes once a minute rather than on the lists' fifteen seconds.
// One definition for the page and for the prefetch the app starts on load,
// so both fill the same cache entry. Asking every peer takes as long as the
// slowest one (seconds, over a slow resolver or a far datacentre), so the
// answer is kept for the whole visit: going back to the page shows the last
// map at once while a fresh one loads behind it.
export const topologyQuery = {
  queryKey: ["topology"],
  queryFn: async () =>
    unwrap(
      await api.GET("/api/v1/topology", { params: { query: { depth: 2 } } }),
    ),
  staleTime: 60_000,
  gcTime: Infinity,
};

export function useTopology() {
  return useQuery({ ...topologyQuery, refetchInterval: 60_000 });
}

// The federation maps instances reading from this one pushed here: on an
// edge, the picture of the federation it belongs to. Admin-only; any other
// caller (and an instance nothing reads from) simply has none.
export function useFederation() {
  return useQuery({
    queryKey: ["topology", "federation"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/topology/federation");
      return data ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

// ------------------------------------------------------------ one source

export function useSourceDetail(id: string) {
  return useQuery({
    queryKey: ["source", id],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/sources/{id}", { params: { path: { id } } }),
      ),
    refetchInterval: POLL_MS,
  });
}

export function useSourceGroups(id: string) {
  return useQuery({
    queryKey: ["source", id, "groups"],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/sources/{id}/groups", {
          params: { path: { id } },
        }),
      ),
    staleTime: 60_000,
  });
}

// Host names only (no variables): cheap even for a thousand hosts, and what
// the list on the left needs.
export function useSourceHosts(id: string, group: string | null) {
  return useQuery({
    queryKey: ["source", id, "hosts", group],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/sources/{id}/hosts", {
          params: { path: { id }, query: group ? { group } : {} },
        }),
      ),
    staleTime: 60_000,
  });
}

// One group: its variables, children and size, asked for alone rather than
// read out of the whole dataset.
export function useSourceGroup(id: string, group: string | null) {
  return useQuery({
    queryKey: ["source", id, "group", group],
    enabled: group !== null,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/sources/{id}/groups/{group}", {
          params: { path: { id, group: group! } },
        }),
      ),
    staleTime: 30_000,
  });
}

// One host's variables, asked for alone: the dataset's host filter, without
// groups, so a source of a thousand hosts sends only this one.
export function useHostVars(id: string, host: string | null) {
  return useQuery({
    queryKey: ["source", id, "host", host],
    enabled: host !== null,
    queryFn: async () => {
      const page = unwrap(
        await api.GET("/api/v1/sources/{id}/dataset", {
          params: { path: { id }, query: { host: host!, groups: "none" } },
        }),
        // The spec leaves the dataset's body untyped (it is the inventory
        // itself); its shape is fixed by the API's docs.
      ) as unknown as { hostvars?: Record<string, Record<string, unknown>> };
      return page.hostvars?.[host!] ?? {};
    },
    staleTime: 30_000,
  });
}
