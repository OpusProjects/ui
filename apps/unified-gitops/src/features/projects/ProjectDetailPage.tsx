import { Link, useParams } from "react-router";
import {
  DetailTitle,
  EmptyState,
  ListSoft,
  Notice,
  PageHeader,
  Panel,
  ProjectOverview,
  RunButton,
  RunHistory,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useProjects } from "../../api/queries";
import { ICONS } from "../../sections";
import { ActionTable } from "../../shared/ActionTable";
import { WebhookTable } from "../../shared/WebhookTable";
import { pull } from "./model";

type Project = Schemas["ProjectInfo"];

// The overview's hints that are this app's own: what its checkout is for.
const HINTS = {
  lastSuccess:
    "When a pull last worked: the checkout is at most this old. Recent attempts with an old success mean pulls are failing, and its changes reach no API, script or webhook.",
  pullInterval:
    "sync_interval_seconds. How often the project is pulled. None means only at start-up (with sync_on_boot) or on demand.",
};

export function ProjectDetailPage() {
  const { name = "" } = useParams();
  // A restricted key reads its own projects only: another's reads as
  // absent.
  const projects = useProjects();
  const project = projects.data?.find((p) => p.name === name);

  return (
    <>
      <PageHeader
        icon={ICONS.projects}
        title={
          <DetailTitle section="Projects" to="/projects">
            {name}
          </DetailTitle>
        }
        // The project's own description; the generic line only without one.
        description={
          project?.description ??
          "A git repository whose changes call APIs, run scripts and send webhooks."
        }
        actions={
          project && (
            // Keyed by the project: a pull still running must not show on
            // the next project's page.
            <RunButton
              key={name}
              label="Pull"
              busyLabel="Pulling…"
              invalidate={[["projects"]]}
              run={async () =>
                (await pull(name)).success
                  ? { ok: true, message: "Pulled" }
                  : { ok: false, message: "Pull failed" }
              }
            />
          )
        }
      />
      {projects.isPending && <SkeletonSummary />}
      {projects.isError && (
        <Notice title="Could not load this project">
          {projects.error.message}
        </Notice>
      )}
      {projects.isSuccess && !project && (
        <EmptyState title="No such project">
          Nothing called {name} is configured.{" "}
          <Link to="/projects">See every project</Link>.
        </EmptyState>
      )}
      {project && (
        <>
          <ProjectOverview
            project={project}
            credential={project.credential}
            hints={HINTS}
            at={projects.dataUpdatedAt}
          />
          <UsedBy project={project} />
          {/* An instance older than the history has none to show. */}
          {project.history && (
            <Panel
              title="History"
              hint="The last pulls of this project, newest first, kept in memory since this instance started (up to 50; a restart starts over): why each ran and who asked, and the commit it moved the checkout from and to."
            >
              <RunHistory
                runs={project.history}
                kind="pull"
                gitUrl={project.git_url}
                at={projects.dataUpdatedAt}
              />
            </Panel>
          )}
        </>
      )}
    </>
  );
}

// What acts on this project's changes, one table per kind: the API items
// and script items watching it, and the webhooks telling its events. A
// script reading its file from here while watching another project is
// listed on that project.
function UsedBy({ project }: { project: Project }) {
  const { apis, scripts, webhooks } = project.used_by;
  if (apis.length === 0 && scripts.length === 0 && webhooks.length === 0)
    return (
      <Panel title="Used by">
        <ListSoft>
          Nothing acts on this project&apos;s changes: no API, script or webhook
          names it.
        </ListSoft>
      </Panel>
    );
  return (
    <>
      {apis.length > 0 && (
        <Panel
          title="APIs"
          hint="The API items watching this project: a commit that changes their files calls their API with them."
        >
          <ActionTable
            kind="api"
            names={apis}
            empty="No API watches this project."
          />
        </Panel>
      )}
      {scripts.length > 0 && (
        <Panel
          title="Scripts"
          hint="The script items watching this project: a commit that changes their files runs their script."
        >
          <ActionTable
            kind="script"
            names={scripts}
            empty="No script watches this project."
          />
        </Panel>
      )}
      {webhooks.length > 0 && (
        <Panel
          title="Webhooks"
          hint="The webhooks telling this project's events: a commit pulled, a pull failing or recovering, and its API and script runs."
        >
          <WebhookTable
            hears={(n) => webhooks.includes(n.name)}
            empty="No webhook tells this project's events."
          />
        </Panel>
      )}
    </>
  );
}
