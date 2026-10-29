# Contributing to Unified UI

Thanks for helping out! This is a small project with a few firm conventions —
following them keeps the history clean and the two apps alike.

## Workflow: one logical change per PR

`main` moves only through squash-merged pull requests, one **logical change** per PR —
a fix, a dependency bump, a doc edit each get their own. This keeps every change
independently reviewable, bisectable, and revertable.

```bash
git checkout main && git pull
git checkout -b <type>/<short-name>       # e.g. fix/card-title-overflow
# ...make exactly one change, test it...
git commit -am "Short imperative title"
git push -u origin <type>/<short-name>
gh pr create --base main
```

### Commit / PR message style

Commit and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
release-please reads them to pick the next version and to write the CHANGELOG.

- Title: `<type>: short imperative summary`, lowercase after the colon —
  `feat: add a hosts and groups switch to the source page`, `fix: popover
widening the page`. Types in use: `feat`, `fix`, `perf`, `refactor`, `docs`,
  `test`, `build`, `ci`, `chore`.
- A breaking change adds `!` after the type (`feat!: ...`) or a
  `BREAKING CHANGE:` footer in the body.
- The squashed title is the CHANGELOG line and decides the next version, so
  write it for someone reading the release notes: what changes for them. See
  [docs/releasing.md](docs/releasing.md).
- Body (when the change needs explaining): plain prose, _what_ and _why_, wrapped
  at ~72 columns. The problem first, then the change.

## CI gates

Every PR must pass, in this order (run them locally before pushing):

```bash
npx prettier --check .
npm run typecheck
npm run build
npm run test:e2e                # Playwright, against mocked APIs
docker build -f docker/Dockerfile .
```

[docs/development.md](docs/development.md) covers the dev server, regenerating
the API types, and running a subset of the end-to-end suite.

## Design rules

The workspace is two shared packages and one app per product — see
[docs/layout.md](docs/layout.md). The rules that matter when writing code:

1. **What both apps do alike lives once, in the packages.** A page, a card, a
   table or a dialog that both apps need goes into `@opusprojects/unified-ui`
   (or `@opusprojects/unified-client` when it has no UI); each app passes only
   its own words and data. Copying a component between apps is a bug.
2. **Tokens, not values.** Colours, radii and spacing come from the `--uu-*`
   variables ([docs/design.md](docs/design.md)), so light and dark stay right.
3. **The API's types are generated, never written by hand.** Regenerate an
   app's `src/api/schema.ts` from its backend's OpenAPI after an API change.

## Code comments

Comment only when the _why_ is non-obvious: a constraint, a trade-off, a bug
that a simpler version had. Comments are in English.

## Releases

Releases are cut by release-please; no one bumps a version, edits the CHANGELOG
or pushes a tag by hand. Every merge into `main` updates one open
`chore: release vX.Y.Z` pull request, and merging it creates the tag and the
GitHub Release. See [docs/releasing.md](docs/releasing.md).
