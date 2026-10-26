# Unified UI

[![unified-ui CI](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml/badge.svg)](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/react-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)

The web UI for [unified-api](https://github.com/OpusProjects/unified-api), and the shared packages
it is built from.

Every unified-api image from 0.34.0 on serves this UI on its own address: open the instance in a
browser, sign in, and see what it holds and whether it is keeping up. The UI reads the same REST
API every other consumer uses, and keeps no state of its own beyond a theme choice and half an
hour of metrics in memory.

---

## ✨ Features

- **Overview**: whether anything needs attention, across everything the instance serves
- **Sources**: health and freshness per source, groups, hosts and their variables, sync on demand
- **Endpoints**: the inventories shaped for each consumer, and the sources they are built from
- **Projects**: the git repositories holding the scripts, their pull health, pull on demand
- **Credentials**: where each secret is read from and whether it is there, never the secret itself
- **Topology**: this instance and the instances it federates, and whether each one keeps up
- **Metrics**: charts sampled from `/metrics` every 10 s while the app is open, last 30 minutes
- **Configuration**: the settings in effect, defaults included, and who can sign in; read-only
- **Host search**: `/` or `Ctrl+K` anywhere finds a host and opens it in its source
- **Sign-in**: unified-api's own login page, with an API key or an LDAP account
- **Permissions respected**: a restricted key sees only its sources; admin pages leave the menu
- **Light and dark**: follows the system, or a choice remembered in this browser
- **Shared packages**: `@opusprojects/unified-ui` and `@opusprojects/unified-client` for any
  unified-\* UI

---

## 📚 Documentation

| Document                           | What it covers                                                        |
| ---------------------------------- | --------------------------------------------------------------------- |
| [Layout](docs/layout.md)           | The workspace, the two packages and the app, and where new code goes  |
| [Development](docs/development.md) | Dev server, API types, typecheck, build, end-to-end tests and CI      |
| [Sign-in](docs/sign-in.md)         | How the UI signs in through unified-api, sessions and CSRF on writes  |
| [Demo image](docs/demo.md)         | The UI behind nginx, pointed at any instance, and its safety rules    |
| [Design tokens](docs/design.md)    | The `--uu-*` variables, light and dark, and the four health states    |
| [Releasing](docs/releasing.md)     | Versions, the CHANGELOG, tags, and how unified-api picks up a release |

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
