import { api, unwrap } from "../../api/client";

// Sends a test message now and says how it went, in the words a RunButton
// shows beside it.
export async function sendTest(name: string) {
  const delivery = unwrap(
    await api.POST("/api/v1/notifications/{id}/test", {
      params: { path: { id: name } },
    }),
  );
  return delivery.ok
    ? { ok: true, message: "Test sent" }
    : { ok: false, message: delivery.error ?? "Test failed" };
}
