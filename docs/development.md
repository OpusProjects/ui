# Development

```bash
npm install
UNIFIED_API_URL=http://localhost:8182 npm run dev    # Vite on :5173, proxying the API
npm run typecheck                                    # every workspace, plus tests/e2e
npm run build                                        # client, then ui, then the app
npm run test:e2e                                     # Playwright, mocked API
npx prettier --check .                               # formatting, as CI runs it
```

The dev server forwards `/api`, `/swagger-ui`, `/api-docs`, `/metrics`, `/healthz` and `/readyz` to
`UNIFIED_API_URL` (default `http://localhost:8182`), so the app and the API share an origin as
they do in production. Set `UNIFIED_API_KEY` as well when the instance has keys: the dev server
adds it server side, with the same cross-site rules as the [demo image](demo.md).

## API types

`apps/unified-api/src/api/schema.ts` is generated from the unified-api OpenAPI spec. Regenerate it
after an API change:

```bash
UNIFIED_API_URL=http://localhost:8182 npm run generate:api -w unified-api-ui
```

The e2e fixtures are typed against the same schema, so an API change that breaks the UI's
assumptions breaks the typecheck too.

## End-to-end tests

`npm run test:e2e` starts Vite and runs Playwright (Chromium) against it. Every `/api` and
`/metrics` call is answered in the browser from `tests/e2e/fixtures/api.ts`, an invented instance.

- No unified-api is needed, and no real inventory is ever touched
- The proxy points at a closed port, so a call the fixtures miss fails loudly
- Run `npx playwright install chromium` once before the first run

## CI

`.github/workflows/ci.yaml` runs on every pull request, on pushes to `main` and on version tags:

- `test`: `prettier --check .`, typecheck, build, and the Playwright suite
- `build-image`: builds the demo image from `docker/Dockerfile`
- `release`: on a `v*` tag only, once both pass, the GitHub Release (see [releasing](releasing.md))
