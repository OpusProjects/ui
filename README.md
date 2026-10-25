# Unified UI

[![unified-ui CI](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml/badge.svg)](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

The web UI for [unified-api](https://github.com/OpusProjects/unified-api), and the shared packages
it is built from.

The UI reads the same REST API every other consumer uses, from the same origin as unified-api. It
holds no state of its own beyond a theme choice and half an hour of metrics in memory. The packages
keep the shell, the health vocabulary and the API session rules in one place, so every unified-\*
UI looks and behaves alike.

## Features

- **Overview**: whether anything needs attention, across everything the instance serves
- **Sources**: health and freshness per source, groups, hosts and their variables, sync on demand
- **Endpoints**: the inventories shaped for each consumer, and the sources they are built from
- **Projects**: the git repositories holding the scripts, their pull health, pull on demand
- **Credentials**: where each secret is read from and whether it is there, never the secret itself
- **Topology**: this instance and the instances it federates, and whether each one keeps up
- **Metrics**: charts sampled from `/metrics` every 10 s while the app is open, last 30 minutes
- **Configuration**: the settings in effect, defaults included, and who can sign in; read-only
- **Host search**: `/` or `Ctrl+K` anywhere finds a host and opens it in its source
- **Light and dark**: follows the system, or a choice remembered in this browser

## Layout

An npm workspace: two packages anyone can build a unified-\* UI from, and one app.

```
packages/
├── client/           @opusprojects/unified-client: non-visual, no components
│   └── src/
│       ├── http.ts         openapi-fetch session middleware and unwrap()
│       ├── health.ts       sync_health → fresh / stale / failing / pending
│       ├── prometheus.ts   exposition parser, rates, histogram quantiles
│       ├── metrics.ts      in-browser /metrics sampler (10 s, last 30 min)
│       └── theme.ts        stored light / dark / system choice
└── ui/               @opusprojects/unified-ui: visual only
    └── src/
        ├── components/     AppShell, Page, Health, Charts, Tree, Pagination,
        │                   InfoHint, Skeleton, ThemeSwitch, CodeView
        ├── lib/format.ts   ages, sizes, intervals
        └── theme.css       design tokens (--uu-*)
apps/
└── unified-api/      the unified-api UI
    └── src/
        ├── api/            generated schema.ts, typed client, TanStack Query hooks
        ├── shared/         pieces several sections use (host search, tables, run buttons)
        └── features/       one folder per section: overview, sources, endpoints,
                            projects, credentials, topology, metrics, config
tests/e2e/            Playwright against a mocked API (fixtures/api.ts)
docker/               demo image: nginx serving the build and proxying the API
compose.yaml          local demo: unified-api with its sample config, the UI in front
```

The app builds against the packages' source (aliases in `apps/unified-api/vite.config.ts`), so a
change in a package shows up immediately, without publishing or rebuilding it.

## Requirements

The UI talks to unified-api on the same origin: in development Vite's proxy forwards the API
routes, and the demo image does the same with nginx. Forwarded routes are `/api`, `/swagger-ui`,
`/api-docs`, `/metrics`, `/healthz` and `/readyz`.

Parts of the UI need routes newer than unified-api 0.33.0, the version `compose.yaml` pins:

- `/api/v1/hosts/search`: host search
- `/api/v1/topology`: Topology, and the federation summary on Overview
- `/api/v1/auth` and `/api/v1/settings`: Configuration, Overview and the sign-out button
- `/api/v1/credentials`: Credentials, Overview and Configuration
- `/api/v1/endpoints/{id}/counts`: the host counts on an endpoint's page

Against 0.33.0 those parts show an error. Sources, Endpoints, Projects and Metrics work. The demo
will show every page once `compose.yaml` moves to the next unified-api release.

## Try it

```bash
docker compose -p unified-ui-demo up -d --build
# open http://localhost:18190
```

This starts unified-api with its bundled sample config, and the UI in front of it. Set `UI_PORT`
to use another port; the port is bound to `127.0.0.1` only.

To look at a real instance instead, put its address in `.env` (git-ignored) and start only the UI:

```bash
cat > .env <<'EOF'
UNIFIED_API_URL=https://unified-api.example.net
UNIFIED_API_KEY=...
UI_READ_ONLY=true
EOF
docker compose up -d --build --no-deps ui
```

| Variable          | Default                   | What it does                                       |
| ----------------- | ------------------------- | -------------------------------------------------- |
| `UNIFIED_API_URL` | `http://unified-api:8182` | The instance nginx forwards the API routes to      |
| `UNIFIED_API_KEY` | empty                     | Sent as `X-API-Key` by nginx, never to the browser |
| `UI_READ_ONLY`    | `false`                   | `true` refuses every write before it leaves nginx  |
| `UI_PORT`         | `18190`                   | Local port of the UI (compose only)                |

Anyone who can open the page acts with `UNIFIED_API_KEY`, which is why the image is for local
demos only. Requests from other websites cannot borrow it:

- A request the browser marks `Sec-Fetch-Site: cross-site` or `same-site` goes on without the key
- A write from such a request is refused with `403` before it reaches unified-api
- Tools like curl send no such header and are treated as the page itself

`/metrics` is both a page and an API route: a browser navigation (`Accept: text/html`) gets the
app, and anything else, including the Metrics page's own fetch, gets the Prometheus text.

## Sign-in

The UI has no login form and never sees a password. Sign-in is unified-api's own page at
`/api/v1/login`, where you sign in with an API key. It exists only with `server.ui.enabled: true`:

- Any API call answered `401` sends the browser to `/api/v1/login?next=<current page>`
- After sign-in unified-api returns the browser to `next`
- Sign out posts to `/api/v1/logout` with `next=/`, so signing in again returns to the UI

Returning to `next`, and `server.ui.home: "/"` for landing on the Overview when no page was asked
for, arrive in the next unified-api release. Until then, 0.33.0 sends every sign-in to `/api/v1/`.

A signed-in browser authenticates by cookie, so every write carries the session's CSRF token. The
`session` middleware fetches it from `GET /api/v1/auth` on the first write, and retries a write
once if it was refused for CSRF (the session changed in another tab).

## Develop

```bash
npm install
UNIFIED_API_URL=http://localhost:8182 npm run dev    # Vite on :5173, proxying the API
npm run typecheck                                    # every workspace, plus tests/e2e
npm run build                                        # client, then ui, then the app
npm run test:e2e                                     # Playwright, mocked API
npx prettier --check .                               # formatting, as CI runs it
```

`UNIFIED_API_URL` defaults to `http://localhost:8182`. Set `UNIFIED_API_KEY` as well when the
instance has keys: the dev server adds it server side, with the same cross-site rules as nginx.

### API types

`apps/unified-api/src/api/schema.ts` is generated from the unified-api OpenAPI spec. Regenerate it
after an API change:

```bash
UNIFIED_API_URL=http://localhost:8182 npm run generate:api -w unified-api-ui
```

The e2e fixtures are typed against the same schema, so an API change that breaks the UI's
assumptions breaks the typecheck too.

### End-to-end tests

`npm run test:e2e` starts Vite and runs Playwright (Chromium) against it. Every `/api` and
`/metrics` call is answered in the browser from `tests/e2e/fixtures/api.ts`, an invented instance.

- No unified-api is needed, and no real inventory is ever touched
- The proxy points at a closed port, so a call the fixtures miss fails loudly
- Run `npx playwright install chromium` once before the first run

### Where code goes

- A section's pages and its own rules live in `apps/unified-api/src/features/<section>`
- Something two sections use moves to `apps/unified-api/src/shared`
- Anything another unified-\* UI could use moves to a package: `client` if it renders nothing,
  `ui` if it does

## Design tokens

Components and apps use the CSS variables in `packages/ui/src/theme.css` (`--uu-*`) rather than
literal colors. Light and dark follow the system setting; `data-theme="light"` or `"dark"` on
`<html>` forces one, which is what the theme switch does.

Every periodic task is shown in one of four states, from `packages/client/src/health.ts`:

| State   | Meaning                                                      |
| ------- | ------------------------------------------------------------ |
| Fresh   | Has data inside its freshness window, last attempt worked    |
| Stale   | Has data, but older than its TTL                             |
| Failing | The last attempt failed (it may still serve older data)      |
| Pending | Has never completed a run, shown as "Waiting for first sync" |

## CI

`.github/workflows/ci.yaml` runs on every pull request and on pushes to `main`:

- `test`: `prettier --check .`, typecheck, build, and the Playwright suite
- `build-image`: builds the demo image from `docker/Dockerfile`

## License

[Apache 2.0](LICENSE)
