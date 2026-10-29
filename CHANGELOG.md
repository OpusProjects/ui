# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

unified-ui is versioned on its own. Each unified-api release pins the
unified-ui version it builds into its image.

## [Unreleased]

### Added

- What reads an item, as tables: on a unified-api source's page the endpoints whose output it is part of (marked where it limits the hosts) and the views it is a member of; on a unified-gitops project's page the webhooks hearing it; on a unified-gitops webhook's page the projects it hears, beside its applications. History stays the last table on every page that has one.
- A History panel on a unified-api source's page (its last syncs: why and by whom, what each covered, the hosts and groups it brought or why it failed, how long it took) and on a project's page in both apps (its last pulls: why and by whom, the commit each moved the checkout from and to, with links), from the new `history` fields: unified-api 0.37.0 and unified-gitops 0.4.0; an older instance shows none. One `RunHistory` table in `@opusprojects/unified-ui`.
- An Order menu ends every list page's toolbar (both apps): A to Z and Z to A, A to Z the default; on Sources also Fresh to Stale and Stale to Fresh, with worst first (Stale to Fresh) staying its default. The choice is remembered per list in the browser; arrow keys, Enter and Escape work, and on a narrow screen it opens leftwards when it would not fit. `useListFilter` takes the card's name, the orders offered and a key, `ListPage` a `name`, and `ListToolbar` its `orders` (`orderOptions()`, or `orderOptions([good, bad])` for the health ones).
- Vaults as credentials (unified-api 0.37.0, unified-gitops 0.4.0): a Vault's page says which variable holds its token (or Kubernetes auth) and lists the credentials read from it, with their vault path and state; a credential read from a Vault links to it beside its vault path; a Vault read from by other credentials counts as used.

### Changed

- A project's card (both apps) always has its Credentials row, saying None for a public repository cloned without one, so every card has the same rows; the row and the project page's fact say Credentials, as the item's `credentials:` key now does.
- unified-api project page: its Endpoints are a table (Endpoint, Output, Sources ready, State), like its Sources and Connectors, in place of a list of links.
- unified-api credential page: its Projects are a table (Project, Last pull, State), as its Sources above them and a credential's projects in unified-gitops, in place of a list of links.
- Cron schedules read in words, as intervals do: "daily at 04:15 UTC", "every 4h", "every 2h, at :15", "Mon–Fri at 06:00 UTC", "yearly on 1 Jan at 00:00 UTC", the expression on hover (`formatSchedule` and `Schedule` in `@opusprojects/unified-ui`); on a source's card and page and a project's, where a project on a schedule showed nothing on its card. One too irregular to say plainly is shown as written.
- unified-api connector page: its Sources table is the one every other page lists sources with (Source, Hosts, Groups, Data from, State), in place of its own (Source, Timeout, State). A source's own timeout shows on its page.
- Configuration, both apps: the Secrets card lists one row per Vault (its name, linking to its page, its address and its cache), in place of the secret cache, the single Vault's settings and the credentials count; with no Vault it says every secret is read from environment variables or files.
- A Vault's credential page (both apps) shows its Address, Mount, Login (the token's variable, or its Kubernetes role), Timeout and Cache, and reads from "This is a Vault"; Login replaces the separate Token from. Its card reads from its address, where it said "Vault:" with nothing after it.

### Fixed

- unified-api Topology: every card takes one width. Side by side they were matched to the widest only when that fit, and otherwise kept their own widths (one edge narrower than the rest); now the room is shared evenly instead, while each share is at least a card's 360px, what a card holds adapting (fewer chips before "+N more"). Stacked, they stretched to what each level's indent left; now they are one width too.
- A project's Last attempt and Last success (its page and card, both apps) restart when it is pulled, as Data from does after a Sync: they were counted on from the first answer whenever the next one reported the same age, so a Pull seemed not to reset them. The same for an application's Last check (card and tables), the projects on a credential's page, a source's Last success and the last cache save on Configuration.
- Tables size each column from its content's real width, rounded up, and again when that content or the fonts change: a state pill ("Not synced yet" on a connector's sources) could overhang its column by a fraction of a pixel and give the table a horizontal scrollbar on a screen with classic scrollbars.
- unified-api source page: between about 860 and 980px wide the hosts list kept its full width and squeezed the selected host beside it to a sliver, its search and switches overflowing the card. The two now stack until both have room (measured against the page's column, not the window), and side by side the hosts give way first.
- Metrics: the API routes table scrolled sideways at 1280px when a route was long. A table too narrow for its columns now cuts its widest text column short with an ellipsis, the whole value on hover.
- Overview (both apps): its first row of cards filled in one by one as each list arrived, the row reflowing each time. Each card now holds its place as a placeholder of its size while its list loads (`AreaCardSkeleton`); a restricted key gets none for the lists it may not read.
- Counts group thousands with a comma everywhere in both apps, 1,023 rather than 1023: cards, facts, tables, health summaries, the overview, pagination, "+N more", run and sync messages. They followed the browser's language, which in Spanish wrote 1023 and 10.000; one `formatCount` (and `countOf`, "1,023 hosts") in `@opusprojects/unified-ui` now formats them all the same way.
- Cron schedules with a named form the words cannot say are shown as written: `FRI#2`, `FRIL` and `MON-FRI/2` read as "every Fri" or "every Mon", names being matched on their first three letters; and `0,7` read "Sun and Sun".
- Configuration, Secrets card (both apps): config.yaml's deprecated `secrets.cache_ttl_seconds`, a cache over every credential, is a row of its own, and the card no longer says env and file credentials are read fresh on every use while it is set; the deprecated config.yaml Vault shows that cache, or 60s without it, in place of "–". A failed credentials request shows its error rather than "Loading…" forever.
- The Order menu's button no longer swallows Home, End, ArrowUp and Escape while the menu is closed, so they scroll the page again; ArrowDown still opens it.
- Counts in "used by" lines (credential pages) and in a connector's script summary ("Shell script, 1,023 lines") group thousands and take the singular for one, as every other count does. `formatCount` and `countOf` now live in `@opusprojects/unified-client`, re-exported by `@opusprojects/unified-ui` as before.
- unified-api source page: at a fractional width just under 676px the hosts list and the selected host stayed side by side and overflowed by half a pixel; they now stack below 676px.
- Tables no longer scroll sideways for a long cell: a column with a hover (an error, what a sync covered, a path, an address) gives way like the name, cut short with the whole value on hover, so a 2,000-character sync error no longer made History 11,334px wide in a 934px panel; until measured, and on a screen too narrow for the other columns, such a cell still clips rather than widening the table. History's Covered names at most two hosts ("Hosts a, b +38 more"), every one on hover.
- Table columns no longer shift as an age ticks ("9s ago", "10s ago"): the columns are measured again only when a cell outgrows the room its column has, not whenever its text changes.
- History's When counts from the run's `age_seconds` (unified-api 0.37.0, unified-gitops 0.4.0), measured by the server as the facts above it are, rather than from the browser's clock; an older instance still counts from `started_at`.
- Configuration, Secrets card: config.yaml's Vault and its cache over every credential are called deprecated only when the instance says so (`settings.secrets.deprecated`); on unified-api 0.36 or unified-gitops 0.3, where that block is the normal setup, they read "config.yaml" and "All credentials (config.yaml)". A Vault credential shows the cache the API reports as in effect.
- unified-gitops Metrics: an application name cut short in Requests by application or Check health by application has its whole name on hover; a metrics table only ever cuts a column that has a hover, never a pill.
- Metrics tables size their columns from each cell's real width rounded up and the panel's rounded down, and again when a font arrives late, so a cell no longer overhangs its column by a fraction of a pixel.
- Credential pages (both apps): the hints say a project names its credential with `credentials`, as the item now does, not `credential`.
- A cron schedule's expression, shown on hover, is also read out by screen readers ("(cron 15 4 * * *, UTC)").
- Configuration: the LDAP access rules count groups thousands with a comma, as every other count does.

## [0.5.0] - 2026-10-27

### Added

- unified-api Connectors: an ssh connector shows what it runs. Files on the host: Runs and its path, Location On the host, Project _On the host_. A script here: File and its Project, as a script connector. A script written in the connector: Runs with it in a few words ("Shell script, 8 lines" rather than a fragment cut at its last `/`), Project _Inline script_, and on its page the whole script in a Script panel. Every connector's Overview is six facts on two full rows: Type, Project, Path (or Runs, or Script), Script args and Timeout, plus Location for an ssh connector and Host args for a script one. Output format is gone: unified-api 0.36.0 reads one output, Ansible inventory JSON. A connector with no project says why in italic (_Local file_, _On the host_, _Inline script_), as a built-in says _Built in_. Requires unified-api 0.36.0.
- `ChipList` takes `limit="line"`: as many chips as fit on one line with "+N more" on that line, counted from the chips' real widths and again whenever they or the line change size (a font arriving late), never fewer than one, which is cut short with "…" when it and "+N more" do not fit the line together. `HealthSummary` without `onSelect` shows its counts as labels rather than filter buttons.
- unified-api Overview: an "Outgoing requests (per minute)" chart under the incoming one, in its own colour, counting the calls to the external systems' APIs (each connector script run, full or partial, and each enricher run, with the split and the failures in the tooltip; from `unified_api_source_requests_total`); This instance shows Incoming requests and Outgoing requests on separate rows. Requires unified-api 0.36.0.

### Fixed

- unified-api: Sync gets fresh data for a federated source now. A source copied from another unified-api (the remote connector, `federated` in the source list since unified-api 0.36.0, for every key) asks that instance to gather again before answering (`refresh_origin=true`); before, its sync only copied the origin's cache, however old, and the source stayed stale. Such a sync now also fails when the origin's own gather fails, where it used to copy the old data. Other sources are asked nothing more: they gather on their own sync, and still reuse one already running. Every Sync button (a source's page, its card, Sync all) decides it the same way. The button says Syncing… until the new data has loaded, and Data from and its freshness meter then start again from the new age, even when the server reports the same age as before; the meter fills every second as the count beside it goes up (`useLiveSeconds`, shared by `LiveAge` and `FreshnessMeter`). The fresh and stale counts in the Sources header and on the Overview come from the same query and change with it.

### Changed

- **Breaking (who renders `CredentialView` or `ProjectView` from `@opusprojects/unified-ui`):** they no longer take `idTag`: the card is titled by the item's name, with its description under it.
- unified-api Topology: opens with one summary card of its instances, connected or unreachable, as every other section does, in place of the four tiles (the federated host entries counted a host twice when two sources held it). Each card's Sources is one line of chips; the cards are narrower (360px at least, was 520px), wider on a wide screen so the lines between them stay short, and where the levels side by side do not fit the page at the cards' own widths the tree stacks instead of scrolling sideways (its cards' lines wrapping on a phone), decided by measuring rather than at one window width. The summary counts this instance as connected, a pushed map's root as its card judges it, and shows nothing without peers.
- unified-api source page: an ssh source shows Runs and its path for files on the host, _Inline script_ for a script written in its connector, and its Project as _On the host_, _Inline script_ or _Local file_, as the connector's page does. Its host variables column fits a 1024px window: the search box shrinks and the controls wrap (they ran 14px past the edge).
- unified-api Sources, Endpoints, Projects and Credentials cards are titled by the item's name with its description under it, as every other card and the page each one opens (they showed the description first and the name under it).

## [0.4.0] - 2026-10-27

### Added

- unified-gitops Webhooks: a webhook can listen to projects (`projects:`), so its card and page show Projects, Applications, or both, with the project linked; its Applications panel lists every application it reaches, by name or through a project; the history's About column names the project of a project event; and the new events read Commit pulled, Pull failed and Pull recovered. A webhook naming neither is Unused. Requires unified-gitops 0.3.0.

### Changed

- unified-gitops Overview: the Webhooks card is always there, saying None when no webhook is configured, as the other areas do.
- The menu's search box is 175px wide (was 170px), in both apps.
- A webhook's Applications and Projects say Application and Project when it names exactly one, on its card and its page.

## [0.3.0] - 2026-10-26

### Added

- unified-gitops Webhooks: a page per webhook and a list of them, each with its type, applications (every one, some, or none), what it starts (Ascender and AWX, with a link to the template's own page and the variable its playbook reads the message from) and its last send; a webhook's page shows its events, destination and credentials, the applications it listens to and a history of its sends (Event, When, Application, Answer, Message, Result), with Send test. The Overview counts them and names one whose last send failed.
- Every age in both apps (last check, last attempt, data from, last pull, sends, run history) counts on live, every second, between polls (`LiveAge`, on one shared clock that `LiveSpan` uses too).
- Requires unified-gitops 0.2.0 for the Webhooks pages and the repositories chart (its `/api/v1/webhooks` routes and `unified_gitops_git_requests_total`).

### Changed

- unified-gitops Overview: "Requests sent to applications (per minute)", and under it "Requests sent to repositories (per minute)" in its own colour (every clone, pull and rollback fetch, from `unified_gitops_git_requests_total`); This instance counts the two on separate rows. Rate charts in both apps put the unit in parentheses, and This instance's labels share one column as wide as the longest.
- Detail panels' facts sit in at most three columns, as Ascender and AWX lay out theirs: two when the panel is under 1024px wide, one under 672px (they filled as many 320px columns as fitted, four or five on a wide screen).
- A fact with several values (`ValueList`: a source's credentials, a webhook's events, CORS origins, config keys) has "+N more" beside its first value instead of on a line of its own; "Show fewer" stays on its own line after the open list.
- A fact whose value is a web address (an http or https URL, whole) is a link out, opened in a new tab with the external-link icon, in both apps (`linkify`, in `Fact` and `ValueList`); a webhook's Sends to is one.

## [0.2.0] - 2026-10-26

### Added

- unified-api Topology on an edge: the federation the central pushed, with the central at the root and this instance marked; the Overview's Instances card counts the same map.
- unified-api source page: each credential links to its page, one per line under the value column (detail style `stack`).
- Topology: the lines meet their cards and re-measure as cards resize; a softer green, with a soft glowing dot crossing a link each time a pull lands on it (none with reduced motion), so a busy link shows often and a quiet one stays still. Oldest data counts on live. Cards share one width (the widest one's content, capped); wide screens get longer lines.
- unified-api source page: a Hosts | Groups switch (`SegmentedSwitch`, which YAML | JSON now uses too) replaces the group filter; Groups lists the source's groups and shows a group's own variables. Instances are named by their `server.name` where they set one.
- unified-api source page: a group's card switches between Hosts and Variables (JSON | YAML, then Hosts | Variables, then Copy); Hosts lists the group's own hosts one per line, in the same box as the variables, searchable and copied as plain lines. `LinesView`; `SegmentedSwitch` and `FormatSwitch` take `disabled`.
- unified-gitops applications: a View changes button between Check and Push, usable when an application is out of sync with changes to apply; it opens the plan with Push at its foot.
- `Tree` takes a `link` state per node ("ok" green, "failing" red); its lines are 3px.

- The unified-gitops web UI (`apps/unified-gitops`): an overview of applications by sync status and what needs fixing, the applications with their connector, commit, pending changes and Check/Push, each one's page (its description in the header, an overview and the run history); connectors, projects, credentials, metrics and the configuration. Admin-only sections are left out of a restricted key's menu. `npm run dev:gitops`, `npm run build:gitops`.
- Object search in the gitops menu ("Find an object", `/` or Ctrl+K): finds objects in every application's local copy by key or by value, with the field that matched, whether git declares it and how old the copy is; Enter opens its application.
- A connector page in the gitops UI (`/connectors/{name}`, linked from each connector card and from an application's page): its script, project and time limit, its kinds in apply order with key and dependencies, and a table of the applications using it with their status and changes to apply. Connector chips on project cards link to it.
- A project page in the gitops UI (`/projects/{name}`, linked from each project card, a connector's page and an application's page): its repository (never with a token), branch, credential, pull health and settings, Pull now, and a table of the applications and connectors reading from it.
- `QuickSearch` in `@opusprojects/unified-ui`: the menu's search button and dialog (shortcuts, debounced query, keyboard choice, focus return) with the query and the result rows left to the app. unified-api's host search now uses it, unchanged in look and behaviour.
- Badge tones `good`, `warning` and `danger`, in the health colours.
- `ResourceCard` takes an optional `description`: a line of plain words under the title, for cards whose title is the name in the configuration.
- End-to-end tests for the gitops app against its own mocked API; the suite now runs one Playwright project per app.

### Changed

- One search in both apps (`SiteSearch`), called Search: configured items by name first, each opening its page, then the app's own (hosts, objects). Its hint and footer keep to one line.
- The menu: API docs and Sign out follow the last section, no dividers; the theme switch stays at the foot. The app's icon sits over its name.
- Tables size their columns to their contents with an even gap between them, page inside their panel once past 10 rows (`usePagination`), and keep the page in the address (`?history-page=2`). The pager shows the range only ("1–10 of 23").
- The Metrics tables (requests by route, by application, check health) space their columns evenly too, numbers still aligned right.
- Status words line up: projects Synced, credentials and connectors Working, overview cards capitalized.
- Configuration shows `server.url` as the Address when set.
- unified-api Overview: the requests card is called Incoming requests per minute.
- Times are exact everywhere: "43d 23h 4m 3s", "2m 13s ago", "every 10m" (zero parts left out). "Running for" counts on live, a second at a time.
- Overview: per-minute figures and charts count the real last minute; the requests chart's tooltip parts add up to its total. unified-api's cards follow the menu (Sources, Connectors, Endpoints, Projects, Credentials).
- An instance reached by IP address or `localhost` is named by its address and port (`127.0.0.1:8191`) instead of "127".

- What both apps did alike now lives once in the packages, and each app passes only its own words and data: `startApp` (the shell, menu, routing, sign-out), `ListPage` (every list page's frame), `CredentialsPage`/`CredentialOverview`, `ProjectsPage`/`ProjectOverview`/`Commit`, the Metrics page frame, `SECTION_ICONS`, `Clip`/`onOff`, and `createApi`/`describeUsers` in the client. `@opusprojects/unified-ui` takes `react-router` as a peer dependency.
- unified-api project cards and pages show the commit and the credential, as unified-gitops does; its menu hides admin-only sections from restricted keys; its hints name the 0.35 keys and item files.
- unified-gitops application history: the result is a status pill with its dot; the Errors column is gone (a run's errors open with its changes); a View column opens a run's changes as a diff, as the rollback dialog shows a rollback's.
- unified-gitops: a credential named on the Configuration page opens that credential's page.

- Buttons drop "now": Sync, Pull (was Sync now, Pull now), in both apps.
- unified-gitops: Sync is now Push (Push, Push all, "Pushing…"), with its own icon, and an applying run's type reads Push; Check has its own icon too.
- Button labels stay on one line, and a card's buttons share the bottom line in one row: only the first gives way, by writing its outcome above itself.

- Pieces both apps use moved into the packages instead of being copied: `DetailTitle`, `ListToolbar`, `RunButton` (now with `variant` and `icon`), `RunAllButton`, the Overview cards and lists, the Metrics panels and route table (by metric prefix), the sign-in and secrets panels and the shared page styles into `@opusprojects/unified-ui`; `useListFilter`, the git URL helpers and the credential labels into `@opusprojects/unified-client`. The unified-api UI looks and behaves as before.
- `@opusprojects/unified-ui` now has `@tanstack/react-query` as a peer dependency (for the run buttons).
- A notice keeps a panel's spacing below it.

### Fixed

- Dialogs: keyboard focus reaches links and expandable rows, and a long diff scrolls by keyboard; a click on the dialog's text no longer sends focus out of it.
- Search: when the host or object search fails, name matches still show, with a notice.
- Tables: going back to page 1 keeps a page size that came from a shared link; Hosts and Groups keep a page size each.
- Topology: lines follow a peer swapped for another, and a refetch no longer sends a dot along a link that has not pulled again.

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

[Unreleased]: https://github.com/OpusProjects/unified-ui/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/OpusProjects/unified-ui/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/OpusProjects/unified-ui/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/OpusProjects/unified-ui/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/OpusProjects/unified-ui/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/OpusProjects/unified-ui/releases/tag/v0.1.0
