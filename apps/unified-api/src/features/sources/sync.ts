import { api, unwrap } from "../../api/client";

// What every Sync button asks: fresh data, now. A federated source (the
// remote connector) only copies the instance it reads from, so it asks that
// instance to gather again before answering (refresh_origin): without it,
// the copy was as old as the origin's, and the source stayed stale. Every
// other source gathers on its own sync, and is asked nothing more: the flag
// would also stop it reusing a sync already running (two people pressing
// Sync would each start a full gather).
//
// `federated` unknown (the source's details not loaded yet, or failed to):
// asked of the source first, so a Sync pressed early still asks a federated
// source's origin.
export async function syncSource(id: string, federated?: boolean) {
  const remote =
    federated ??
    unwrap(await api.GET("/api/v1/sources/{id}", { params: { path: { id } } }))
      .gathering?.connector_type === "remote";
  return unwrap(
    await api.POST("/api/v1/sources/{id}/sync", {
      params: {
        path: { id },
        query: remote ? { refresh_origin: true } : {},
      },
    }),
  );
}

// The same, in the words a RunButton shows beside it.
export async function syncNow(id: string, federated?: boolean) {
  const result = await syncSource(id, federated);
  return result.success
    ? { ok: true, message: `Synced ${result.total_hosts} hosts` }
    : { ok: false, message: "Sync failed" };
}
