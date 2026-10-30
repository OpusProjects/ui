import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./client";

// Runs and sends happen whenever a commit lands (or a person presses Run
// now), so the lists poll.
const POLL_MS = 15_000;

export function useApiIndex() {
  return useQuery({
    queryKey: ["index"],
    queryFn: async () => unwrap(await api.GET("/api/v1/")),
    staleTime: Infinity,
  });
}

// Every API item the caller may see, each with its last run: a commit can
// start one at any time, so the list polls.
export function useApis() {
  return useQuery({
    queryKey: ["apis"],
    queryFn: async () => unwrap(await api.GET("/api/v1/apis")),
    refetchInterval: POLL_MS,
  });
}

// One API item with its recent runs, for its page.
export function useApi(id: string) {
  return useQuery({
    queryKey: ["apis", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/apis/{id}", { params: { path: { id } } })),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

export function useScripts() {
  return useQuery({
    queryKey: ["scripts"],
    queryFn: async () => unwrap(await api.GET("/api/v1/scripts")),
    refetchInterval: POLL_MS,
  });
}

export function useScript(id: string) {
  return useQuery({
    queryKey: ["scripts", id],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/scripts/{id}", { params: { path: { id } } }),
      ),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

// A restricted key reads only its own projects. The ones below are
// admin-only: a restricted key is refused once, and the pages that use
// them say so.
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => unwrap(await api.GET("/api/v1/projects")),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

export function useCredentials() {
  return useQuery({
    queryKey: ["credentials"],
    queryFn: async () => unwrap(await api.GET("/api/v1/credentials")),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

// Each webhook with its last send, which a run can change at any time.
export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => unwrap(await api.GET("/api/v1/webhooks")),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

// One webhook with its recent sends, for its page.
export function useWebhook(name: string) {
  return useQuery({
    queryKey: ["webhooks", name],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/webhooks/{id}", {
          params: { path: { id: name } },
        }),
      ),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => unwrap(await api.GET("/api/v1/settings")),
    retry: false,
  });
}

export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: async () => unwrap(await api.GET("/api/v1/auth")),
    staleTime: 60_000,
  });
}
