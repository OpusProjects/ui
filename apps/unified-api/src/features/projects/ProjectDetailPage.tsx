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
import { api, unwrap, type Schemas } from "../../api/client";
import { useConnectors, useProjects } from "../../api/queries";
import { SourceTable } from "../../shared/SourceTable";
import { EndpointTable } from "../../shared/EndpointTable";
import {
  connectorLabels,
  connectorPath,
  connectorState,
  stateDetail,
} from "../connectors/model";
import { ICONS } from "../../sections";

type Connector = Schemas["ConnectorInfo"];

// What each overview fact means, behind its label. Settings start with
// The overview's hints that are this app's own: what its checkout is for.
const HINTS = {
  lastSuccess:
    "When a pull last worked: the checkout is at most this old. Recent attempts with an old success mean pulls are failing and the scripts are running from an old commit.",
  pullInterval:
    "sync_interval_seconds. How often the project is pulled. None means only at start-up (with sync_on_boot) or on demand.",
};

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const projects = useProjects();
  const project = projects.data?.find((p) => p.project_id === id);

  return (
    <>
      <PageHeader
        icon={ICONS.projects}
        title={
          <DetailTitle section="Projects" to="/projects">
            {id}
          </DetailTitle>
        }
        description={project?.name}
        actions={
          project && (
            // Keyed by the project: a pull still running must not show on
            // the next project's page.
            <RunButton
              key={id}
              label="Pull"
              busyLabel="Pulling…"
              invalidate={[["projects"]]}
              run={async () => {
                const result = unwrap(
                  await api.POST("/api/v1/projects/{id}/sync", {
                    params: { path: { id } },
                  }),
                );
                return result.success
                  ? { ok: true, message: "Pulled" }
                  : { ok: false, message: "Pull failed" };
              }}
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
          Nothing called {id} is configured.{" "}
          <Link to="/projects">See every project</Link>.
        </EmptyState>
      )}
      {project && (
        <>
          <ProjectOverview
            project={project}
            credential={project.credential_id}
            hints={HINTS}
            at={projects.dataUpdatedAt}
          />
          <Panel
            title="Sources"
            hint="The sources using this project: they run from its checkout, through their connector or (a static inventory) by naming it themselves."
          >
            <SourceTable
              ids={project.used_by.sources}
              empty="No source uses this project."
            />
          </Panel>
          {project.used_by.connectors.length > 0 && (
            <Panel
              title="Connectors"
              hint="The connectors using this project: their project names it, and their script is read from its checkout for every source using them."
            >
              <ConnectorTable ids={project.used_by.connectors} />
            </Panel>
          )}
          {project.used_by.endpoints.length > 0 && (
            <Panel
              title="Endpoints"
              hint="The endpoints using this project: their project names it, and their transformer script is read from its checkout."
            >
              <EndpointTable
                ids={project.used_by.endpoints}
                empty="No endpoint uses this project."
              />
            </Panel>
          )}
          <Panel
            title="History"
            hint="The last pulls of this project, newest first, kept in memory since this instance started (up to 50; a restart starts over): why each ran and who asked, and the commit it moved the checkout from and to."
          >
            <RunHistory
              runs={project.history ?? []}
              kind="pull"
              gitUrl={project.git_url}
            />
          </Panel>
        </>
      )}
    </>
  );
}

// Connectors by id, each with its type, how many sources use it and their
// state, and a link to its page.
function ConnectorTable({ ids }: { ids: string[] }) {
  const connectors = useConnectors();
  const byId = new Map((connectors.data ?? []).map((c) => [c.connector_id, c]));
  type Row = { id: string; connector?: Connector };
  const rows: Row[] = [...ids]
    .sort()
    .map((id) => ({ id, connector: byId.get(id) }));
  const columns: ListColumn<Row>[] = [
    {
      key: "connector",
      label: "Connector",
      role: "name",
      render: ({ id, connector }) => (
        <ListName
          name={connector?.name ?? id}
          link={(className, children) => (
            <Link className={className} to={connectorPath(id)}>
              {children}
            </Link>
          )}
          id={id}
        />
      ),
    },
    {
      key: "type",
      label: "Type",
      render: ({ connector }) =>
        connector ? (
          <code className={common.mono}>{connector.connector_type}</code>
        ) : (
          "–"
        ),
    },
    {
      key: "file",
      label: "File",
      // The script in this project's checkout: its name, the whole path on
      // hover, as the connector cards show it.
      title: ({ connector }) => connector?.path ?? undefined,
      render: ({ connector }) =>
        connector?.path ? (
          <code className={common.mono}>
            {connector.path.split("/").at(-1)}
          </code>
        ) : (
          "–"
        ),
    },
    {
      key: "sources",
      label: "Sources",
      numeric: true,
      render: ({ connector }) => connector?.health.sources ?? "–",
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: ({ connector }) =>
        connector ? (
          <HealthPill
            state={connectorState(connector)}
            labels={connectorLabels(connector)}
            detail={stateDetail(connector)}
          />
        ) : (
          <ListSoft>{connectors.isPending ? "…" : "Not visible"}</ListSoft>
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty="No connector uses this project."
      noun="connectors"
    />
  );
}
