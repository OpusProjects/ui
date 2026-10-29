# Security Policy

## Supported versions

Only the latest release line receives security fixes.

| Version              | Supported |
| -------------------- | --------- |
| 0.x (latest release) | Yes       |
| older tags           | No        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting instead:
[Report a vulnerability](https://github.com/OpusProjects/ui/security/advisories/new)
— it opens a private thread with the maintainers.

Include what you can: affected page or component, reproduction steps, and
impact. You should hear back within a week. Once a fix ships, the advisory is
published and credited unless you prefer otherwise.

## Scope notes

- The UI holds **no credentials of its own**. It signs in through the API it
  is served by (unified-api or unified-gitops): an API key or a directory
  login exchanged for a session cookie, which the browser sends with every
  call. Writes carry the session's CSRF token.
- The UI is served by the API itself, on the same origin, so its pages see
  only what the signed-in key is allowed to see; access control is the API's.
- The **demo image** puts the UI behind nginx, pointed at an instance of your
  choice. Treat the proxy's target and who can reach the demo as part of your
  deployment's threat model.
