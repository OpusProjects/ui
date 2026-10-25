# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

unified-ui is versioned on its own. Each unified-api release pins the
unified-ui version it builds into its image.

## [Unreleased]

## [0.1.0] - 2026-10-25

### Added

- The unified-api web UI (`apps/unified-api`): an overview of what needs
  attention, sources with their groups, hosts and variables, endpoints,
  projects, credentials, the federation topology, metrics charts sampled from
  `/metrics`, and the configuration. Host search from every page (`/` or
  Ctrl+K). Light, dark or system theme. Pages an API key may not read are left
  out of the menu.
- Sign-in through unified-api's own login page (API key or LDAP); writes carry
  the session's CSRF token and retry once if the session changed.
- `@opusprojects/unified-ui`: the shared visual components (app shell, cards,
  health pills and summaries, charts, tree, pagination, code view, theme
  switch) and the `--uu-*` design tokens.
- `@opusprojects/unified-client`: the shared non-visual pieces (the session
  middleware for openapi-fetch, health states, Prometheus parsing and an
  in-browser metrics sampler, the stored theme).
- End-to-end tests with Playwright against a mocked API (`npm run test:e2e`).
- A demo image: the built UI behind nginx, forwarding to a unified-api.
- Requires unified-api 0.34.0 or later, which also serves this UI itself.

[Unreleased]: https://github.com/OpusProjects/unified-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OpusProjects/unified-ui/releases/tag/v0.1.0
