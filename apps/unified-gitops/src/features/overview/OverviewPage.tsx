import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  AreaCard,
  AreaCardSkeleton,
  AreaGrid,
  Fact,
  InstancePanel,
  NeedsAttention,
  Notice,
  OverviewColumns,
  PageHeader,
  RatePanel,
  countStates,
  perMinuteText,
  LiveSpan,
  useRatePerMinute,
  type Issue,
  type RatePart,
} from "@opusprojects/unified-ui";
import {
  CREDENTIAL_LABELS,
  PROJECT_LABELS,
  taskHealth,
} from "@opusprojects/unified-client";
import {
  useApis,
  useAuth,
  useCredentials,
  useWebhooks,
  useProjects,
  useScripts,
  useSettings,
} from "../../api/queries";
import { ICONS } from "../../sections";
import { credentialState } from "../credentials/model";
import { LABELS as WEBHOOK_LABELS, webhookState } from "../webhooks/model";
import {
  LABELS as ACTION_LABELS,
  actionState,
  type Action,
  type Run,
} from "../../shared/runs";

const link = (to: string, content: ReactNode, className: string) => (
  <Link to={to} className={className}>
    {content}
  </Link>
);

// Why a run failed, in one line: its own error, or its first failing
// step's.
const failure = (run: Run) =>
  run.error ?? run.steps.find((s) => !s.ok)?.error ?? null;

// The front page: whether this instance's projects pull, and whether what
// acts on their changes works. Every number comes from the same rules as
// the page it links to. Areas a restricted key may not see (webhooks,
// credentials) are left out.
export function OverviewPage() {
  const apis = useApis();
  const scripts = useScripts();
  const projects = useProjects();
  const credentials = useCredentials();
  const webhooks = useWebhooks();
  const settings = useSettings();
  // Unknown yet counts as admin, as the menu does: the common caller.
  const admin = useAuth().data?.me.role !== "restricted";

  const issues: Issue[] = [];
  const failed = (
    kind: string,
    section: string,
    items: Action[] | undefined,
  ) => {
    for (const item of items ?? [])
      if (actionState(item) === "failing" && item.last) {
        const why = failure(item.last);
        issues.push({
          key: `${section}-${item.name}`,
          severity: 0,
          text: (
            <>
              {kind} <b>{item.name}</b>{" "}
              {item.last.dry_run ? "would fail" : "failed"}
              {why && `: ${why}`}
            </>
          ),
          to: `/${section}/${encodeURIComponent(item.name)}`,
        });
      }
  };
  failed("API", "apis", apis.data);
  failed("Script", "scripts", scripts.data);
  for (const p of projects.data ?? []) {
    if (taskHealth(p.sync_health) === "failing")
      issues.push({
        key: `project-${p.name}`,
        severity: 0,
        text: (
          <>
            Project <b>{p.name}</b> cannot be pulled
          </>
        ),
        to: `/projects/${encodeURIComponent(p.name)}`,
      });
  }
  for (const c of credentials.data ?? []) {
    if (!c.resolves)
      issues.push({
        key: `credential-${c.name}`,
        severity: 0,
        text: (
          <>
            Credential <b>{c.name}</b> is missing
            {c.error && `: ${c.error}`}
          </>
        ),
        to: "/credentials",
      });
  }
  for (const n of webhooks.data ?? []) {
    if (n.last && !n.last.ok)
      issues.push({
        key: `webhook-${n.name}`,
        severity: 0,
        text: (
          <>
            Webhook <b>{n.name}</b> could not send
            {n.last.error && `: ${n.last.error}`}
          </>
        ),
        to: `/webhooks/${encodeURIComponent(n.name)}`,
      });
  }
  const restart = settings.data?.restart_pending ?? [];
  if (restart.length > 0)
    issues.push({
      key: "restart",
      severity: 1,
      text: <>A restart is needed to apply {restart.join(", ")}</>,
      to: "/config",
    });

  return (
    <>
      <PageHeader
        icon={ICONS.overview}
        title="Overview"
        description="Whether the projects pull, whether what acts on their changes works, and what needs fixing."
      />
      {apis.isError && (
        <Notice title="Could not check this instance">
          {apis.error.message}
        </Notice>
      )}

      {/* Each card holds its place while its list loads: the row keeps its
          five slots rather than filling in and reflowing card by card. A list
          only an admin may read gets none for a restricted key, whose request
          is refused: its slot would show and then vanish. */}
      <AreaGrid
        loading={
          apis.isLoading ||
          scripts.isLoading ||
          projects.isLoading ||
          (admin && webhooks.isLoading) ||
          (admin && credentials.isLoading)
        }
      >
        {apis.isLoading ? (
          <AreaCardSkeleton />
        ) : (
          apis.isSuccess && (
            <AreaCard
              to="/apis"
              link={link}
              icon={ICONS.apis}
              title="APIs"
              counts={countStates(apis.data, actionState)}
              labels={ACTION_LABELS}
              goodWord="Working"
            />
          )
        )}
        {scripts.isLoading ? (
          <AreaCardSkeleton />
        ) : (
          scripts.isSuccess && (
            <AreaCard
              to="/scripts"
              link={link}
              icon={ICONS.scripts}
              title="Scripts"
              counts={countStates(scripts.data, actionState)}
              labels={ACTION_LABELS}
              goodWord="Working"
            />
          )
        )}
        {admin && webhooks.isLoading ? (
          <AreaCardSkeleton />
        ) : (
          webhooks.isSuccess && (
            <AreaCard
              to="/webhooks"
              link={link}
              icon={ICONS.webhooks}
              title="Webhooks"
              counts={countStates(webhooks.data, webhookState)}
              labels={WEBHOOK_LABELS}
              goodWord="Working"
            />
          )
        )}
        {projects.isLoading ? (
          <AreaCardSkeleton />
        ) : (
          projects.isSuccess && (
            <AreaCard
              to="/projects"
              link={link}
              icon={ICONS.projects}
              title="Projects"
              counts={countStates(projects.data, (p) =>
                taskHealth(p.sync_health),
              )}
              labels={PROJECT_LABELS}
              goodWord="Synced"
            />
          )
        )}
        {admin && credentials.isLoading ? (
          <AreaCardSkeleton />
        ) : (
          credentials.isSuccess && (
            <AreaCard
              to="/credentials"
              link={link}
              icon={ICONS.credentials}
              title="Credentials"
              // Resolving is what this card counts: an unused credential
              // resolves too (it is only a candidate for removal).
              counts={countStates(credentials.data, (c) =>
                credentialState(c) === "pending" ? "fresh" : credentialState(c),
              )}
              labels={CREDENTIAL_LABELS}
              goodWord="Working"
            />
          )
        )}
      </AreaGrid>

      <OverviewColumns>
        <NeedsAttention
          hint="What needs a person, worst first. Red: something broken (an API or script whose last run failed, a project that cannot be pulled, a missing credential, a webhook that could not send). Amber: a restart is needed. Each line opens the page to act on."
          issues={issues}
          link={link}
          failed={
            apis.isError ? "the list of APIs could not be loaded." : undefined
          }
          loading={apis.isPending || scripts.isPending}
        />
        <ThisInstance
          apis={apis.data}
          scripts={scripts.data}
          uptime={settings.data?.uptime_seconds}
          at={settings.dataUpdatedAt}
        />
      </OverviewColumns>

      <RatePanel
        title="Runs (per minute)"
        hint="The runs of this instance's API and script items, dry runs left out: a commit that changes what they watch, a schedule, start-up or a person. From its own /metrics, sampled every ten seconds while the app is open; the app keeps the last half hour."
        metric={RUNS}
        parts={RUN_PARTS}
      />
      <RatePanel
        title="Requests sent to repositories (per minute)"
        hint="The requests this instance makes to git servers: a clone the first time a project is checked out, a pull on each of its intervals or schedules. From its own /metrics, sampled every ten seconds while the app is open; the app keeps the last half hour."
        metric={GIT}
        parts={GIT_PARTS}
        series={7}
      />
    </>
  );
}

// The work this instance does: its own HTTP routes are mostly this app
// polling it, so they say nothing about what it does.
const RUNS = "unified_gitops_runs_total";
// Every run is an API's or a script's, so the two add up to the point's
// total; failed is counted within them.
const RUN_PARTS: RatePart[] = [
  { name: ["API run", "API runs"], filter: (l) => l.kind === "api" },
  { name: ["script run", "script runs"], filter: (l) => l.kind === "script" },
  {
    name: ["failed", "failed"],
    filter: (l) => l.outcome === "error",
    subset: true,
  },
];

// The same, to git servers: every clone, pull and fetch.
const GIT = "unified_gitops_git_requests_total";
const GIT_PARTS: RatePart[] = [
  { name: ["pull", "pulls"], filter: (l) => l.operation === "pull" },
  { name: ["clone", "clones"], filter: (l) => l.operation === "clone" },
  { name: ["fetch", "fetches"], filter: (l) => l.operation === "fetch" },
  {
    name: ["failed", "failed"],
    filter: (l) => l.outcome === "error",
    subset: true,
  },
];

function ThisInstance({
  apis,
  scripts,
  uptime,
  at,
}: {
  apis?: Action[];
  scripts?: Action[];
  uptime?: number;
  at: number;
}) {
  const runs = useRatePerMinute(RUNS);
  const toRepositories = useRatePerMinute(GIT);
  const items = [...(apis ?? []), ...(scripts ?? [])];
  const failing = items.filter((i) => actionState(i) === "failing").length;
  return (
    <InstancePanel>
      <Fact label="Failing">
        {failing} of {items.length} {items.length === 1 ? "item" : "items"}
      </Fact>
      <Fact label="Runs">{perMinuteText(runs)}</Fact>
      <Fact label="Requests to repositories">
        {perMinuteText(toRepositories)}
      </Fact>
      {uptime != null && (
        <Fact label="Running for">
          <LiveSpan seconds={uptime} at={at} />
        </Fact>
      )}
    </InstancePanel>
  );
}
