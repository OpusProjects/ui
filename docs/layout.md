# Layout

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
        │                   InfoHint, Skeleton, Lift, ThemeSwitch, CodeView
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

`ui` depends on `client` (a health pill needs the health states); `client` depends on neither. The
app builds against both packages' source (aliases in `apps/unified-api/vite.config.ts` and paths in
`tsconfig.base.json`), so a change in a package shows up immediately, without publishing or
rebuilding it.

## Where code goes

- A section's pages and its own rules live in `apps/unified-api/src/features/<section>`; the rules
  for judging its items (labels, states) sit next to them in `model.ts`
- Something two sections use moves to `apps/unified-api/src/shared`
- Anything another unified-\* UI could use moves to a package: `client` if it renders nothing,
  `ui` if it does
