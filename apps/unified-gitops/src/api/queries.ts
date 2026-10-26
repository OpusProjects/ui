import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./client";

// Status changes with every check (and with a person pressing Sync), so the
// lists poll. Fifteen seconds is well under the shortest check interval
// anyone configures.
const POLL_MS = 15_000;

export function useApiIndex() {
  return useQuery({
    queryKey: ["index"],
    queryFn: async () => unwrap(await api.GET("/api/v1/")),
    staleTime: Infinity,
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => unwrap(await api.GET("/api/v1/applications")),
    refetchInterval: POLL_MS,
  });
}

// One application whole: its pending plan and its run history.
export function useApplication(id: string, enabled = true) {
  return useQuery({
    queryKey: ["application", id],
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/applications/{id}", {
          params: { path: { id } },
        }),
      ),
    refetchInterval: POLL_MS,
  });
}

// Admin-only, like the rest below: a restricted key is refused once, and
// the pages that use them say so.
export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    queryFn: async () => unwrap(await api.GET("/api/v1/connectors")),
    staleTime: 60_000,
    retry: false,
  });
}

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

// Each notification with its last send, which a run can change at any time.
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => unwrap(await api.GET("/api/v1/notifications")),
    refetchInterval: POLL_MS,
    retry: false,
  });
}

// One notification with its recent sends, for its page.
export function useNotification(name: string) {
  return useQuery({
    queryKey: ["notifications", name],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/notifications/{id}", {
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
