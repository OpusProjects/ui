import { Link, useParams } from "react-router";
import {
  EmptyState,
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  LiveAge,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useCredentials, useProjects } from "../../api/queries";
import { CredentialOverview, DetailTitle } from "@opusprojects/unified-ui";
import { SourceTable } from "../../shared/SourceTable";
import { credentialUsers, usedBy } from "./model";
import { PROJECT_LABELS, projectState } from "../projects/model";
import { ICONS } from "../../sections";

type Project = Schemas["ProjectInfo"];

// The overview's hints that are this app's own: what receives the secrets,
// and what can name a credential.
const HINTS = {
  type: "type. username_password, token or ssh_key: what the connector expects to receive.",
  secretKeys:
    "secret_keys. The names the connector receives the secrets under; never their values.",
  usedBy:
    "What names this credential: sources (credentials), projects (credential) and the LDAP login (bind_credential).",
};

export function CredentialDetailPage() {
  const { id = "" } = useParams();
  const credentials = useCredentials();
  const credential = credentials.data?.find((c) => c.credential_id === id);

  return (
    <>
      <PageHeader
        icon={ICONS.credentials}
        title={
          <DetailTitle section="Credentials" to="/credentials">
            {id}
          </DetailTitle>
        }
        description={credential?.name}
      />
      {credentials.isPending && <SkeletonSummary />}
      {credentials.isError && (
        <Notice title="Could not load this credential">
          {credentials.error.message}
        </Notice>
      )}
      {credentials.isSuccess && !credential && (
        <EmptyState title="No such credential">
          Nothing called {id} is configured.{" "}
          <Link to="/credentials">See every credential</Link>.
        </EmptyState>
      )}
      {credential && (
        <>
          <CredentialOverview
            credential={credential}
            users={credentialUsers(credential)}
            usedBy={usedBy(credential)}
            hints={HINTS}
          />
          {/* Shown when sources use it, or when nothing does (so the page
              says so); not as an empty card above the project that does. */}
          {(credential.used_by.sources.length > 0 ||
            credentialUsers(credential) === 0) && (
            <Panel
              title="Sources"
              hint="The sources using this credential: their credentials name it, and their connector receives these secrets on every sync."
            >
              <SourceTable
                brief
                ids={credential.used_by.sources}
                empty="Nothing uses this credential: no source, project or login names it."
              />
            </Panel>
          )}
          {credential.used_by.projects.length > 0 && (
            <Panel
              title="Projects"
              hint="The projects using this credential: their credential names it, and they clone and pull their repository with it."
            >
              <ProjectTable ids={credential.used_by.projects} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}

// The projects using it, as unified-gitops lists a credential's projects:
// each linked by name, with its last pull and its state.
function ProjectTable({ ids }: { ids: string[] }) {
  const projects = useProjects();
  const byId = new Map((projects.data ?? []).map((p) => [p.project_id, p]));
  type Row = { id: string; project?: Project };
  const rows: Row[] = [...ids]
    .sort()
    .map((id) => ({ id, project: byId.get(id) }));
  const none = <ListSoft>–</ListSoft>;
  const columns: ListColumn<Row>[] = [
    {
      key: "name",
      label: "Project",
      role: "name",
      title: (r) => r.id,
      render: (r) => (
        <ListName
          name={r.project?.name ?? r.id}
          link={(className, children) => (
            <Link
              to={`/projects/${encodeURIComponent(r.id)}`}
              className={className}
            >
              {children}
            </Link>
          )}
          id={r.id}
        />
      ),
    },
    {
      key: "pulled",
      label: "Last pull",
      render: (r) =>
        r.project ? (
          <LiveAge
            seconds={r.project.sync_health?.last_success_age_seconds}
            at={projects.dataUpdatedAt}
          />
        ) : (
          none
        ),
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: (r) =>
        r.project ? (
          <HealthPill state={projectState(r.project)} labels={PROJECT_LABELS} />
        ) : (
          none
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty="No project uses this credential."
      noun="projects"
    />
  );
}
