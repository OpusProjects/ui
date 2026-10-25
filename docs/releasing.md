# Releasing

unified-ui is versioned on its own, with [Semantic Versioning](https://semver.org/). While it is
pre-1.0, anything added or breaking is a MINOR release and fixes only are a PATCH.

## Cutting a version

1. On a branch named `release/x.y.z`, rename `## [Unreleased]` in `CHANGELOG.md` to
   `## [x.y.z] - YYYY-MM-DD`, leave a fresh empty `## [Unreleased]` above it, update the link refs
   at the bottom, and set `"version"` in the three `package.json` files
2. Open the PR, wait for the checks, squash-merge it
3. Pull `main` and tag the squashed commit: `git tag vx.y.z && git push origin vx.y.z`

The tag runs CI once more, and the `release` job creates the GitHub Release with the notes from
that version's CHANGELOG section. Never create a release by hand.

## How unified-api picks it up

unified-api builds a pinned unified-ui version into its image: `UI_REF` in its
`docker/Dockerfile`. A new unified-ui release reaches users when a unified-api release bumps that
pin, so a UI change that needs a newer API route ships together with the API that has it.
