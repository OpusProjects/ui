# Unified UI

[![unified-ui CI](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml/badge.svg)](https://github.com/OpusProjects/unified-ui/actions/workflows/ci.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/react-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)

The web UIs for [unified-api](https://github.com/OpusProjects/unified-api) and
[unified-gitops](https://github.com/OpusProjects/unified-gitops), and the shared packages they are
built from.

Each tool serves its own UI on its own address: open the instance in a browser, sign in, and see
what it holds and whether it is keeping up. The UIs read the same REST API every other consumer
uses, and keep no state of their own beyond a theme choice and half an hour of metrics in memory.
Both are built from the same packages, so they look and behave alike.

---

## ✨ Features

**unified-gitops** (`apps/unified-gitops`):

- **Overview**: applications by sync status, and what needs fixing: failed, out of sync, missing
- **Applications**: each one's status, commit and pending changes; Check compares, Sync applies
- **Application page**: its overview (system, project, status, commit) and what past runs did
- **Connectors**: the scripts that read and change each kind of system, their kinds in apply order
- **Connector page**: script, project and time limit, kinds in apply order, and the applications using it
- **Project page**: repository, branch, credential, pull health, Pull now, and what reads from it
- **Object search**: `/` or Ctrl+K from any page finds an object by key or value, and if git declares it
- **Projects, credentials, metrics, configuration**: as in unified-api, for this instance

**unified-api** (`apps/unified-api`):

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

## 🚀 Getting started

**Using it:** run unified-api 0.34.0 or later, or unified-gitops, with the UI turned on. Each
image ships its UI and its bundled config turns it on; see unified-api's
[docs/ui.md](https://github.com/OpusProjects/unified-api/blob/main/docs/ui.md).

**Working on it:**

```bash
npm install
UNIFIED_API_URL=http://localhost:8182 npm run dev            # unified-api UI on :5173
UNIFIED_GITOPS_URL=http://127.0.0.1:8183 npm run dev:gitops  # unified-gitops UI on :18192
npm run test:e2e                                             # Playwright, mocked APIs
```

---

## 📚 Documentation

| Document                           | What it covers                                                        |
| ---------------------------------- | --------------------------------------------------------------------- |
| [Layout](docs/layout.md)           | The workspace, the two packages and the apps, and where new code goes |
| [Development](docs/development.md) | Dev server, API types, typecheck, build, end-to-end tests and CI      |
| [Sign-in](docs/sign-in.md)         | How the UI signs in through unified-api, sessions and CSRF on writes  |
| [Demo image](docs/demo.md)         | The UI behind nginx, pointed at any instance, and its safety rules    |
| [Design tokens](docs/design.md)    | The `--uu-*` variables, light and dark, and the four health states    |
| [Releasing](docs/releasing.md)     | Versions, the CHANGELOG, tags, and how unified-api picks up a release |

---

## 🤝 Contributing

Contributions are welcome through pull requests against `main`. Every PR runs the same checks as
[docs/development.md](docs/development.md) describes: formatting, typecheck, build, the end-to-end
suite and the demo image. Commit messages and PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/).

Security issues: please report them privately through
[GitHub's security advisories](https://github.com/OpusProjects/unified-ui/security/advisories/new),
not in a public issue.

---

## 👥 Authors

- [Fernando Roca](https://github.com/fernandorocagonzalez)
- [Blai Peidro](https://github.com/blaipr)

---

## ⚖️ License

[Apache 2.0](LICENSE)
