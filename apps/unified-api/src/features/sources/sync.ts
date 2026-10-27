import { api, unwrap } from "../../api/client";

// What every Sync button asks: fresh data, now. For a federated source that
// means the instance it reads from gathers again before answering
// (refresh_origin); without it, a sync only copied that instance's cache,
// however old, and the source stayed stale. A local source ignores the flag:
// its sync always gathers.
export async function syncSource(id: string) {
  return unwrap(
    await api.POST("/api/v1/sources/{id}/sync", {
      params: { path: { id }, query: { refresh_origin: true } },
    }),
  );
}

// The same, in the words a RunButton shows beside it.
export async function syncNow(id: string) {
  const result = await syncSource(id);
  return result.success
    ? { ok: true, message: `Synced ${result.total_hosts} hosts` }
    : { ok: false, message: "Sync failed" };
}
