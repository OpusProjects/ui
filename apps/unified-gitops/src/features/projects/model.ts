import { api, unwrap } from "../../api/client";

// Pulls one project now: the list's cards and the project's page share it.
export const pull = async (id: string) =>
  unwrap(
    await api.POST("/api/v1/projects/{id}/sync", {
      params: { path: { id } },
    }),
  );
