import type { Middleware } from "openapi-fetch";

// The session rules every unified-* API shares, as one openapi-fetch
// middleware and one result helper: a client made with openapi-fetch for any
// of them calls `client.use(session)` and wraps its results in `unwrap`.

// A signed-in browser authenticates by cookie, and a unified-* API refuses a
// cookie-authenticated write without the session's CSRF token (otherwise any
// page could make the browser sync or reload on the user's behalf). The
// token comes from GET /auth, asked only when a write needs it; reads never
// carry it. Only a token is kept: a failed lookup is asked again next time
// rather than remembered, or one network blip would break every write until
// a reload.
let csrfToken: Promise<string | undefined> | undefined;

interface AuthInfo {
  me?: { csrf_token?: string | null } | null;
}

function csrf() {
  csrfToken ??= fetch("/api/v1/auth", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : undefined))
    .then((auth: AuthInfo | undefined) => auth?.me?.csrf_token ?? undefined)
    .catch(() => undefined)
    .then((token) => {
      if (!token) csrfToken = undefined;
      return token;
    });
  return csrfToken;
}

const isWrite = (method: string) => method !== "GET" && method !== "HEAD";

// A copy of each write as it was before sending, for the one retry below:
// sending consumes a request's body, so the original cannot be sent twice.
const unsent = new WeakMap<Request, Request>();

export const session: Middleware = {
  async onRequest({ request }) {
    if (!isWrite(request.method)) return;
    const token = await csrf();
    if (token) request.headers.set("X-CSRF-Token", token);
    unsent.set(request, request.clone());
    return request;
  },
  // The session changed under this page (signed out and in again in another
  // tab): the token it holds belongs to the old session, and the write is
  // refused for CSRF. Forget the token, ask for the current one, and send the
  // write once more; any other refusal is the caller's to show.
  async onResponse({ request, response }) {
    if (response.status !== 403 || !isWrite(request.method)) return;
    const copy = unsent.get(request);
    if (!copy) return;
    const body = await response.clone().text();
    if (!/csrf/i.test(body)) return;
    csrfToken = undefined;
    const token = await csrf();
    if (!token) return;
    copy.headers.set("X-CSRF-Token", token);
    return fetch(copy);
  },
};

// Every unified-* failure carries {"error": "..."}; surface that sentence
// rather than a bare status code.
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (result.data !== undefined) return result.data;
  // No session (or it expired): the API's own sign-in page, which sends the
  // browser back here afterwards.
  if (result.response.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/api/v1/login?next=${encodeURIComponent(next)}`);
  }
  const message =
    typeof result.error === "object" && result.error && "error" in result.error
      ? String((result.error as { error: unknown }).error)
      : `${result.response.status} ${result.response.statusText}`;
  throw new Error(message);
}
