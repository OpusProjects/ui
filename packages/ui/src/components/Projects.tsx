import type { ReactNode } from "react";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  PROJECT_LABELS,
  commitPage,
  repositoryName,
  repositoryPage,
  taskHealth,
  withoutCredentials,
  type SyncHealth,
} from "@opusprojects/unified-client";
import { Fact, HealthPill, ResourceCard } from "./Health";
import { Panel } from "./Page";
import detail from "./Detail.module.css";
import { ListPage } from "./ListPage";
import { RunAllButton } from "./RunAllButton";
import { RunButton } from "./RunButton";
import { LiveAge } from "./LiveAge";
import { formatCount, formatEvery, formatSpan } from "../lib/format";
import { Schedule } from "./Detail";
import styles from "./Common.module.css";

// What every unified-* app's git projects have in common. How one is named,
// and the route that pulls it, differ: each app passes a `view` and `pull`.
export interface ProjectLike {
  git_url: string;
  branch: string;
  revision?: string | null;
  sync_health?: SyncHealth | null;
  sync_interval_seconds?: number | null;
  // A cron schedule (UTC), used instead of the interval.
  schedule?: string | null;
}

export interface ProjectView {
  // The identity: its URL and what references name.
  id: string;
  // The name, as on every card and the page it opens; the description goes
  // under it.
  title: string;
  description?: string | null;
  // The credential it pulls with, if any.
  credential?: string | null;
}

export const projectState = (project: ProjectLike) =>
  taskHealth(project.sync_health);

// The commit a checkout is at: its short id, the whole id on hover, and a
// link to the commit's page when the repository has one.
export function Commit({
  gitUrl,
  revision,
}: {
  gitUrl: string;
  revision?: string | null;
}) {
  if (!revision) return <span className={styles.soft}>None yet</span>;
  const short = <code className={styles.mono}>{revision.slice(0, 7)}</code>;
  const page = commitPage(gitUrl, revision);
  return page ? (
    <a
      className={styles.link}
      href={page}
      target="_blank"
      rel="noreferrer"
      title={revision}
    >
      {short}
    </a>
  ) : (
    <span title={revision}>{short}</span>
  );
}

// The repository's web page, when it has one: a project card's way out.
export function OpenRepository({ gitUrl }: { gitUrl: string }) {
  const page = repositoryPage(gitUrl);
  return page ? (
    <a className={styles.link} href={page} target="_blank" rel="noreferrer">
      Open repository
      <ExternalLink aria-hidden />
    </a>
  ) : null;
}

type Pull = (id: string) => Promise<{ success: boolean }>;

export function ProjectsPage<T extends ProjectLike>({
  query,
  view,
  pull,
  icon,
  description,
  placeholder,
  empty,
}: {
  query: UseQueryResult<T[]>;
  view: (project: T) => ProjectView;
  pull: Pull;
  icon: ReactNode;
  description: string;
  placeholder: string;
  empty: ReactNode;
}) {
  return (
    <ListPage
      query={query}
      header={{ icon, title: "Projects", description }}
      noun={["project", "projects"]}
      state={projectState}
      labels={PROJECT_LABELS}
      good="synced"
      search={(p) => {
        const v = view(p);
        return `${v.id} ${v.title} ${v.description ?? ""} ${withoutCredentials(p.git_url)}`;
      }}
      name={(p) => view(p).title}
      placeholder={placeholder}
      actions={(filter, items) => (
        <RunAllButton
          ids={filter.visible.map((p) => view(p).id)}
          filtered={filter.visible.length !== items.length}
          words={{
            verb: "Pull",
            busy: "Pulling…",
            done: "pulled",
            noun: ["project", "projects"],
          }}
          invalidate={[["projects"]]}
          run={async (id) => (await pull(id)).success}
        />
      )}
      empty={empty}
      card={(project) => {
        const v = view(project);
        return (
          <ResourceCard
            key={v.id}
            title={v.title}
            description={v.description}
            state={projectState(project)}
            labels={PROJECT_LABELS}
            error={project.sync_health?.last_error}
            titleLink={(title, className) => (
              <Link
                to={`/projects/${encodeURIComponent(v.id)}`}
                className={className}
              >
                {title}
              </Link>
            )}
            footer={
              <>
                <OpenRepository gitUrl={project.git_url} />
                <RunButton
                  label="Pull"
                  busyLabel="Pulling…"
                  invalidate={[["projects"]]}
                  run={async () =>
                    (await pull(v.id)).success
                      ? { ok: true, message: "Pulled" }
                      : { ok: false, message: "Pull failed" }
                  }
                />
              </>
            }
          >
            <Fact label="Repository">
              <code
                className={styles.mono}
                title={withoutCredentials(project.git_url)}
              >
                {repositoryName(project.git_url)}
              </code>
            </Fact>
            <Fact label="Branch">
              <code className={styles.mono}>{project.branch}</code>
            </Fact>
            <Fact label="Commit">
              <Commit gitUrl={project.git_url} revision={project.revision} />
            </Fact>
            {/* Always the row, so every card has the same rows: a public
                repository is cloned with no credential, said as None. */}
            <Fact label="Credentials">
              {v.credential ? (
                <Link
                  className={styles.link}
                  to={`/credentials/${encodeURIComponent(v.credential)}`}
                >
                  {v.credential}
                </Link>
              ) : (
                "None"
              )}
            </Fact>
            <Fact label="Last pull">
              <LiveAge
                seconds={project.sync_health?.last_success_age_seconds}
                at={query.dataUpdatedAt}
              />
            </Fact>
            {project.schedule ? (
              <Fact label="Pulls">
                <Schedule cron={project.schedule} />
              </Fact>
            ) : (
              project.sync_interval_seconds != null && (
                <Fact label="Pulls">
                  {formatEvery(project.sync_interval_seconds)}
                </Fact>
              )
            )}
          </ResourceCard>
        );
      }}
    />
  );
}

// What each overview fact means, behind its label, starting with its key in
// the project's item file, which is where it is changed. What a checkout is
// FOR differs per app, so those two hints come from the app.
const HINTS = {
  Repository:
    "git_url. Where the project is cloned from; opens the repository's page when its address has one.",
  Branch: "branch. The branch the checkout follows.",
  Commit:
    "The commit the checkout is at: what this instance reads now. Each pull moves it to the branch's latest commit; a link opens it when the repository has a web page.",
  Credentials:
    "credentials. What the clone and pulls authenticate with, when the repository needs it: None for a public one.",
  "Last attempt":
    "When this project was last pulled, whether it worked or not.",
  Schedule:
    "schedule. When the project is pulled, from a cron expression (UTC, shown on hover), used instead of an interval.",
  "Pull on start":
    "sync_on_boot. Whether this instance pulls the project when it starts.",
  Timeout:
    "timeout_seconds. How long one clone or pull may take. One that takes longer is stopped and counts as failed.",
};

export interface ProjectDetailLike extends ProjectLike {
  checkout_present: boolean;
  schedule?: string | null;
  sync_on_boot: boolean;
  timeout_seconds: number;
}

// A project's own page, its overview panel. Three rows of three: where it
// comes from, how pulls are going, and how it is pulled. A failing streak is
// on the status pill ("3 in a row"), not a fact that reads 0 when all is well.
export function ProjectOverview({
  project,
  credential,
  hints,
  at,
}: {
  project: ProjectDetailLike;
  credential?: string | null;
  hints: { lastSuccess: string; pullInterval: string };
  // When the project was fetched (the query's dataUpdatedAt): its ages
  // restart on every answer, so a pull resets them even when the age it
  // reports is the same as the last one (0 after a pull, 0 after the next).
  at?: number;
}) {
  const health = project.sync_health;
  const failures = health?.consecutive_failures ?? 0;
  const page = repositoryPage(project.git_url);
  const repository = repositoryName(project.git_url);
  const address = withoutCredentials(project.git_url);

  return (
    <Panel
      title="Overview"
      hint="The git repository behind this project: where it is pulled from, how often, and how its last pulls went."
      aside={
        <HealthPill
          state={projectState(project)}
          labels={PROJECT_LABELS}
          detail={
            failures > 1 ? `${formatCount(failures)} in a row` : undefined
          }
        />
      }
    >
      <dl className={detail.facts}>
        <Fact label="Repository" hint={HINTS.Repository}>
          {page ? (
            <a
              className={detail.link}
              href={page}
              target="_blank"
              rel="noreferrer"
              title={address}
            >
              {repository}
            </a>
          ) : (
            <span className={detail.clipText} title={address}>
              {repository}
            </span>
          )}
        </Fact>
        <Fact label="Branch" hint={HINTS.Branch}>
          <code className={detail.mono}>{project.branch}</code>
        </Fact>
        <Fact label="Commit" hint={HINTS.Commit}>
          <Commit gitUrl={project.git_url} revision={project.revision} />
        </Fact>
        <Fact label="Credentials" hint={HINTS.Credentials}>
          {credential ? (
            <Link
              className={detail.link}
              to={`/credentials/${encodeURIComponent(credential)}`}
            >
              {credential}
            </Link>
          ) : (
            "None"
          )}
        </Fact>

        <Fact label="Last attempt" hint={HINTS["Last attempt"]}>
          <LiveAge seconds={health?.last_attempt_age_seconds} at={at} />
        </Fact>
        <Fact label="Last success" hint={hints.lastSuccess}>
          {health?.last_success_age_seconds != null ? (
            <LiveAge seconds={health.last_success_age_seconds} at={at} />
          ) : (
            "Never"
          )}
        </Fact>

        {project.schedule ? (
          <Fact label="Schedule" hint={HINTS.Schedule}>
            <Schedule cron={project.schedule} />
          </Fact>
        ) : (
          <Fact label="Pull interval" hint={hints.pullInterval}>
            {formatEvery(project.sync_interval_seconds) ?? "None"}
          </Fact>
        )}
        <Fact label="Pull on start" hint={HINTS["Pull on start"]}>
          {project.sync_on_boot ? "Yes" : "No"}
        </Fact>
        <Fact label="Timeout" hint={HINTS.Timeout}>
          {formatSpan(project.timeout_seconds)}
        </Fact>
      </dl>
      {health?.last_error && (
        <p className={detail.error}>{health.last_error}</p>
      )}
    </Panel>
  );
}
