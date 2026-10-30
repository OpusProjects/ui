# Layout

An npm workspace: two packages anyone can build a unified-\* UI from, and one app per tool.

```
packages/
├── client/           @opusprojects/unified-client: non-visual, no components
│   └── src/
│       ├── http.ts         openapi-fetch session middleware and unwrap()
│       ├── health.ts       sync_health → fresh / stale / failing / pending
│       ├── prometheus.ts   exposition parser, rates, histogram quantiles
│       ├── metrics.ts      in-browser /metrics sampler (10 s, last 30 min)
│       ├── listFilter.ts   useListFilter: search + state filter for card lists
│       ├── git.ts          git URLs without credentials, repository names and pages
│       ├── credentials.ts  credential labels, health and "read from" text
│       └── theme.ts        stored light / dark / system choice
└── ui/               @opusprojects/unified-ui: visual only
    └── src/
        ├── components/     AppShell, Page, Health, Charts, Tree, Pagination,
        │                   InfoHint, Skeleton, Lift, ThemeSwitch, CodeView,
        │                   Detail (DetailTitle), ListToolbar, RunButton,
        │                   RunAllButton, Overview (area cards, needs attention,
        │                   requests), Metrics (process, traffic, routes),
        │                   SignIn (LDAP, API keys, secrets), Common styles
        ├── lib/format.ts   ages, sizes, intervals
        └── theme.css       design tokens (--uu-*)
apps/
├── unified-api/      the unified-api UI
│   └── src/
│       ├── api/            generated schema.ts, typed client, TanStack Query hooks
│       ├── shared/         pieces its sections share (host search, source table,
│       │                   the router wrapper for DetailTitle)
│       └── features/       one folder per section: overview, sources, endpoints,
│                           projects, credentials, topology, metrics, config
└── unified-gitops/   the unified-gitops UI
    └── src/
        ├── api/            generated schema.ts, typed client, TanStack Query hooks
        ├── shared/         what its sections share: runs (Run now, Dry run,
                            history with steps), item, project and webhook
                            tables, the name search
        └── features/       overview, apis, scripts, webhooks, projects,
                            credentials, metrics, config
tests/e2e/            Playwright, one folder per app, each against its own mocked API
docker/               demo image: nginx serving the build and proxying the API
compose.yaml          local demo: unified-api with its sample config, the UI in front
```

`ui` depends on `client` (a health pill needs the health states); `client` depends on neither. Each
app builds against both packages' source (aliases in its `vite.config.ts` and paths in
`tsconfig.base.json`), so a change in a package shows up immediately in both apps, without
publishing or rebuilding it.

## Where code goes

- A section's pages and its own rules live in `apps/<app>/src/features/<section>`; the rules
  for judging its items (labels, states) sit next to them in `model.ts`
- Something two sections of one app use moves to `apps/<app>/src/shared`
- Anything another unified-\* UI could use moves to a package: `client` if it renders nothing,
  `ui` if it does
