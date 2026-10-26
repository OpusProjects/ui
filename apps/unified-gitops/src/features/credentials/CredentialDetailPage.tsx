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
import { PROJECT_LABELS, taskHealth } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import {
  useApplications,
  useCredentials,
  useProjects,
} from "../../api/queries";
import { CredentialOverview, DetailTitle } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import { credentialUsers, usedBy } from "./model";

type Credential = Schemas["CredentialInfo"];

// The overview's hints that are this app's own: what receives the secrets,
// and what can name a credential.
const HINTS = {
  type: "type. username_password, token or ssh_key: what the connector or the git pull expects to receive.",
  secretKeys:
    "secret_keys. The names the connector receives the secrets under (CREDENTIAL_<KEY>); never their values.",
  usedBy:
    "What names this credential: applications (credentials), projects (credential) and the LDAP login (bind_credential).",
};

export function CredentialDetailPage() {
  const { name = "" } = useParams();
  const credentials = useCredentials();
  const credential = credentials.data?.find((c) => c.name === name);

  return (
    <>
      <PageHeader
        icon={ICONS.credentials}
        title={
          <DetailTitle section="Credentials" to="/credentials">
            {name}
          </DetailTitle>
        }
        description={
          credential?.description ??
          "Where this credential's secrets come from, and what uses them."
        }
      />
      {credentials.isPending && <SkeletonSummary />}
      {credentials.isError && (
        <Notice title="Could not load this credential">
          {credentials.error.message}
        </Notice>
      )}
      {credentials.isSuccess && !credential && (
        <EmptyState title="No such credential">
          Nothing called {name} is configured.{" "}
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
          <Users credential={credential} />
        </>
      )}
    </>
  );
}

// Who receives these secrets, one table per kind of user, as the project
// and connector pages list theirs.
function Users({ credential }: { credential: Credential }) {
  const applications = useApplications();
  const projects = useProjects();
  const apps = new Map((applications.data ?? []).map((a) => [a.name, a]));
  const repos = new Map((projects.data ?? []).map((p) => [p.name, p]));
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

  type ProjectRow = { name: string; project?: Schemas["ProjectInfo"] };
  const projectColumns: ListColumn<ProjectRow>[] = [
    {
      key: "name",
      label: "Project",
      role: "name",
      title: (r) => r.name,
      render: (r) => nameCell("projects", r.name, r.project?.description),
    },
    {
      key: "pulled",
      label: "Last pull",
      render: (r) =>
        r.project ? (
          <LiveAge seconds={r.project.sync_health?.last_success_age_seconds} />
        ) : (
          none
        ),
    },
    {
      key: "status",
      label: "Status",
      role: "state",
      render: (r) =>
        r.project ? (
          <HealthPill
            state={taskHealth(r.project.sync_health)}
            labels={PROJECT_LABELS}
          />
        ) : (
          none
        ),
    },
  ];

  const {
    applications: appNames,
    projects: projectNames,
    ldap,
  } = credential.used_by;
  if (appNames.length === 0 && projectNames.length === 0 && !ldap)
    return (
      <Panel title="Used by">
        <ListSoft>
          Nothing uses this credential: no application, project or login names
          it.
        </ListSoft>
      </Panel>
    );
  return (
    <>
      {appNames.length > 0 && (
        <Panel
          title="Applications"
          hint="The applications using this credential: their credentials name it, and their connector receives these secrets on every run."
        >
          <ListTable
            columns={applicationColumns("connector")}
            rows={appNames.map((n) => ({ name: n, app: apps.get(n) }))}
            rowKey={(r) => r.name}
            empty="No application uses it."
            noun="applications"
          />
        </Panel>
      )}
      {projectNames.length > 0 && (
        <Panel
          title="Projects"
          hint="The projects using this credential: their credential names it, and they clone and pull their repository with it."
        >
          <ListTable
            columns={projectColumns}
            rows={projectNames.map((n) => ({ name: n, project: repos.get(n) }))}
            rowKey={(r) => r.name}
            empty="No project uses it."
            noun="projects"
          />
        </Panel>
      )}
    </>
  );
}
