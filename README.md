# Unified UI

[![unified-ui CI](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml/badge.svg)](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/react-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-7.0-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)

The web UIs for [unified-api](https://github.com/OpusProjects/unified-api) and
[unified-gitops](https://github.com/OpusProjects/unified-gitops), and the shared packages they are
built from.

Each tool serves its own UI on its own address: open it in a browser, sign in, and see what it
holds and whether it is keeping up. The UIs read the same REST API any other consumer uses and
keep no state of their own, and both are built from the same packages, so they look alike.

---

## ✨ Features

- **One look, every tool**: the shell, menu, search, tables, cards and charts live in shared packages
- **Thin apps**: each app passes only its own words and data; the shared pieces do the rest
- **Typed from the API**: each app's client is generated from its tool's OpenAPI spec
- **No state of its own**: everything shown comes from the tool's REST API, read live
- **Signs in through the tool**: API keys or LDAP accounts, sessions and CSRF on every write
- **Permissions respected**: a restricted key sees only what it may; admin pages leave the menu
- **Light and dark**: follows the system, or a choice remembered in this browser
- **Search anywhere**: `/` or Ctrl+K finds configured items by name, then the tool's own objects
- **Live metrics**: charts sampled from `/metrics` while the app is open, the last half hour
- **Pinned per release**: each tool builds a tagged version into its image, nothing to deploy apart
- **Tested end to end**: Playwright against each app's mocked API, on every pull request

---

## 📚 Documentation

| Document                           | What it covers                                                        |
| ---------------------------------- | --------------------------------------------------------------------- |
| [Layout](docs/layout.md)           | The workspace, the two packages and the apps, and where new code goes |
| [Development](docs/development.md) | Dev server, API types, typecheck, build, end-to-end tests and CI      |
| [Sign-in](docs/sign-in.md)         | How the UI signs in, sessions and CSRF on writes                      |
| [Demo image](docs/demo.md)         | The UI behind nginx, pointed at any instance, and its safety rules    |
| [Design tokens](docs/design.md)    | The `--uu-*` variables, light and dark, and the four health states    |
| [Releasing](docs/releasing.md)     | Versions, the CHANGELOG, tags, and how a tool picks up a release      |

---

## 🤝 Contributing

Contributions are welcome: [CONTRIBUTING.md](CONTRIBUTING.md) covers the PR workflow, commit style, CI gates and design rules.

Security issues: see [SECURITY.md](SECURITY.md) for private reporting.

---

## 👥 Authors

- [Fernando Roca](https://github.com/fernandorocagonzalez)
- [Blai Peidro](https://github.com/blaipr)

---

## ⚖️ License

[Apache 2.0](LICENSE)
