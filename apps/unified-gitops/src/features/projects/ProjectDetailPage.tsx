import { Link, useParams } from "react-router";
import {
  detailStyles as common,
  DetailTitle,
  EmptyState,
  HealthPill,
  type ListColumn,
  ListName,
  ListSoft,
  ListTable,
  Notice,
  PageHeader,
  Panel,
  ProjectOverview,
  RunButton,
  RunHistory,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import {
  useApplications,
  useConnectors,
  useProjects,
  useWebhooks,
} from "../../api/queries";
import { ICONS } from "../../sections";
import { WebhookTable } from "../../shared/WebhookTable";
import { applicationColumns } from "../applications/columns";
import { connectorLabels, useConnectorState } from "../connectors/model";
import { pull } from "./model";

type Project = Schemas["ProjectInfo"];

// What each overview fact means, behind its label. Settings start with
// The overview's hints that are this app's own: what its checkout is for.
const HINTS = {
  lastSuccess:
    "When a pull last worked: the checkout is at most this old. Recent attempts with an old success mean pulls are failing and checks read an old commit.",
  pullInterval:
    "sync_interval_seconds. How often the project is pulled, besides before every check. None means only at start-up (with sync_on_boot), before checks or on demand.",
};

// The webhooks hearing this project, when there are any: they name it, or
// all projects.
function Webhooks({ project }: { project: string }) {
  const webhooks = useWebhooks();
  const hears = (n: { all_projects: boolean; projects: string[] }) =>
    n.all_projects || n.projects.includes(project);
  if (!(webhooks.data ?? []).some(hears)) return null;
  return (
    <Panel
      title="Webhooks"
      hint="The webhooks hearing this project: they name it, or all projects, and report its events (a commit pulled, a pull failing or recovering) and its applications'."
    >
      <WebhookTable hears={hears} empty="No webhook hears this project." />
    </Panel>
  );
}

export function ProjectDetailPage() {
  const { name = "" } = useParams();
  // Admin-only, like the Projects page: a restricted key gets the refusal
  // as the page's notice.
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
          "A git repository of desired state and connector scripts."
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
          <Webhooks project={project.name} />
          {/* An instance older than the history has none to show. */}
          {project.history && (
            <Panel
              title="History"
              hint="The last pulls of this project, newest first, kept in memory since this instance started (up to 50; a restart starts over): why each ran and who asked, and the commit it moved the checkout from and to. A pull before a check is listed only when it moved the commit or failed."
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

// Who reads from this project, as unified-api's project page lists the
// sources using it: one table per kind of user, the description to read
// with the name under it, and what this project gives each (the folder an
// application reconciles, the script a connector runs).
function UsedBy({ project }: { project: Project }) {
  const connectorState = useConnectorState();
  const applications = useApplications();
  const connectors = useConnectors();
  const { used_by } = project;

  // Names come from the project itself, so the tables stand even while (or
  // if) the lists behind the other columns do not load.
  const apps = new Map((applications.data ?? []).map((a) => [a.name, a]));
  const scripts = new Map((connectors.data ?? []).map((c) => [c.name, c]));
  const none = <ListSoft>–</ListSoft>;
  const nameCell = (
    section: string,
    name: string,
    description?: string | null,
  ) => (
    <ListName
      name={description ?? name}
      id={name}
      link={(className, children) => (
        <Link
          className={className}
          to={`/${section}/${encodeURIComponent(name)}`}
        >
          {children}
        </Link>
      )}
    />
  );

  type ConnectorRow = { name: string; connector?: Schemas["ConnectorInfo"] };
  const connectorColumns: ListColumn<ConnectorRow>[] = [
    {
      key: "name",
      label: "Connector",
      role: "name",
      title: (r) => r.name,
      render: (r) => nameCell("connectors", r.name, r.connector?.description),
    },
    {
      key: "path",
      label: "Script",
      render: (r) =>
        r.connector ? (
          <code className={common.mono}>{r.connector.path}</code>
        ) : (
          none
        ),
    },
    {
      key: "status",
      label: "Status",
      role: "state",
      render: (r) =>
        r.connector ? (
          <HealthPill
            state={connectorState(r.connector)}
            labels={connectorLabels(r.connector)}
          />
        ) : (
          none
        ),
    },
  ];

  if (used_by.applications.length === 0 && used_by.connectors.length === 0)
    return (
      <Panel title="Used by">
        <ListSoft>Nothing reads from this project.</ListSoft>
      </Panel>
    );
  return (
    <>
      {used_by.applications.length > 0 && (
        <Panel
          title="Applications"
          hint="The applications using this project: their desired state is a folder in its checkout, pulled before every check."
        >
          <ListTable
            columns={applicationColumns("folder", applications.dataUpdatedAt)}
            rows={used_by.applications.map((name) => ({
              name,
              app: apps.get(name),
            }))}
            rowKey={(r) => r.name}
            empty="No application reads from this project."
            noun="applications"
          />
        </Panel>
      )}
      {used_by.connectors.length > 0 && (
        <Panel
          title="Connectors"
          hint="The connectors using this project: their script is a file in its checkout, and a new version is used as soon as it is pulled."
        >
          <ListTable
            columns={connectorColumns}
            rows={used_by.connectors.map((name) => ({
              name,
              connector: scripts.get(name),
            }))}
            rowKey={(r) => r.name}
            empty="No connector reads from this project."
            noun="connectors"
          />
        </Panel>
      )}
    </>
  );
}
