# Demo image

unified-api serves this UI itself, which is how it is meant to be used. The demo image is for
working on the UI, or for looking at an instance from your own machine: the built UI behind nginx,
forwarding the API routes to a unified-api.

```bash
docker compose -p unified-ui-demo up -d --build
# open http://localhost:18190
```

This starts unified-api with its bundled sample config, and the UI in front of it. Set `UI_PORT`
to use another port; the port is bound to `127.0.0.1` only.

To look at a real instance instead, put its address in `.env` (git-ignored) and start only the UI:

```bash
cat > .env <<'ENV'
UNIFIED_API_URL=https://unified-api.example.net
UNIFIED_API_KEY=...
UI_READ_ONLY=true
ENV
docker compose up -d --build --no-deps ui
```

| Variable          | Default                   | What it does                                       |
| ----------------- | ------------------------- | -------------------------------------------------- |
| `UNIFIED_API_URL` | `http://unified-api:8182` | The instance nginx forwards the API routes to      |
| `UNIFIED_API_KEY` | empty                     | Sent as `X-API-Key` by nginx, never to the browser |
| `UI_READ_ONLY`    | `false`                   | `true` refuses every write before it leaves nginx  |
| `UI_PORT`         | `18190`                   | Local port of the UI (compose only)                |

## Safety

Anyone who can open the page acts with `UNIFIED_API_KEY`, which is why the image is for local use
only. Requests from other websites cannot borrow it:

- A request the browser marks `Sec-Fetch-Site: cross-site` or `same-site` goes on without the key
- A write from such a request is refused with `403` before it reaches unified-api
- Tools like curl send no such header and are treated as the page itself

`/metrics` is both a page and an API route: a browser navigation (`Accept: text/html`) gets the
app, and anything else, including the Metrics page's own fetch, gets the Prometheus text.
