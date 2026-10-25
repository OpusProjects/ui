# Sign-in

The UI has no login form and never sees a password. Sign-in is unified-api's own page at
`/api/v1/login`, with an API key or, where the instance has LDAP configured, a directory account.

- Any API call answered `401` sends the browser to `/api/v1/login?next=<current page>`
- After sign-in unified-api returns the browser to `next`
- Sign out posts to `/api/v1/logout` with `next=/`, so signing in again returns to the UI
- A sign-in with no `next` (someone opening `/api/v1/login` directly) lands on unified-api's
  `server.ui.home`, which is `/` when the instance serves the UI

What a person sees is what their key or LDAP access rule allows: a restricted key sees only its
sources and endpoints, and the admin-only pages (projects, credentials, configuration) are left out
of the menu.

## Sessions and CSRF

A signed-in browser authenticates by cookie, so every write carries the session's CSRF token. The
`session` middleware in `@opusprojects/unified-client` fetches it from `GET /api/v1/auth` on the
first write, and retries a write once if it was refused for CSRF (the session changed in another
tab). Reads never carry it.
