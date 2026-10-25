# unified-ui

Shared React components for the unified-* tools, and the web UI for
[unified-api](https://github.com/OpusProjects/unified-api) built with them.

Each product keeps its own UI on its own address; this repository is what makes them look and behave
alike: the shell, the health vocabulary every API shares (`sync_health`), cards, summaries and search.

## Layout

```
packages/ui/          @opusprojects/unified-ui: components, theme, health and formatting helpers
apps/unified-api/     the unified-api UI: Sources, Endpoints, Enrichers, Projects
docker/               demo image: the built UI behind nginx, forwarding the API
compose.yaml          local demo with unified-api and its bundled sample config
```

## Try it

```bash
docker compose -p unified-ui-demo up -d --build
# open http://localhost:18190
```

Use `UI_PORT` to pick another port. To point the UI at an instance that has API keys, set
`UNIFIED_API_KEY`; nginx adds it server side, so it never reaches the browser. Anyone who can open
the page acts with that key, so the demo image is for local use only.

## Develop

```bash
npm install
UNIFIED_API_URL=http://localhost:8182 npm run dev      # Vite on :5173, proxying the API
npm run typecheck
npm run build
```

The app builds against the library's source, so a component change shows up immediately.

API types come from the unified-api OpenAPI spec. Regenerate them after an API change:

```bash
UNIFIED_API_URL=http://localhost:8182 npm run generate:api -w unified-api-ui
```

## Design tokens

Apps use the CSS variables in `packages/ui/src/theme.css` (`--uu-*`) rather than literal colors.
Light and dark follow the system setting; `data-theme="light"` or `"dark"` on `<html>` forces one.

| State   | Meaning                                                   |
| ------- | --------------------------------------------------------- |
| Fresh   | Has data inside its freshness window, last attempt worked |
| Stale   | Has data, but older than its TTL                          |
| Failing | The last attempt failed (it may still serve older data)   |
| Pending | Has never completed a run                                 |

## License

Apache 2.0
