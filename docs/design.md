# Design tokens

Components and apps use the CSS variables in `packages/ui/src/theme.css` (`--uu-*`) rather than
literal colors. Light and dark follow the system setting; `data-theme="light"` or `"dark"` on
`<html>` forces one, which is what the theme switch does (`chooseTheme` in
`@opusprojects/unified-client`, remembered in the browser).

Every periodic task is shown in one of four states, from `packages/client/src/health.ts`:

| State   | Meaning                                                      |
| ------- | ------------------------------------------------------------ |
| Fresh   | Has data inside its freshness window, last attempt worked    |
| Stale   | Has data, but older than its TTL                             |
| Failing | The last attempt failed (it may still serve older data)      |
| Pending | Has never completed a run, shown as "Waiting for first sync" |

A failure outranks freshness: data can still be fresh while every new attempt fails, and that is
the moment someone should look.
