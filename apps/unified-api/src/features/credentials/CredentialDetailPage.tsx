import { Link, useParams } from "react-router";
import {
  EmptyState,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import { useCredentials, useProjects } from "../../api/queries";
import {
  CredentialOverview,
  DetailTitle,
  detailStyles as common,
} from "@opusprojects/unified-ui";
import { SourceTable } from "../../shared/SourceTable";
import { credentialUsers, usedBy } from "./model";
import { PROJECT_LABELS, projectState } from "../projects/model";
import { ICONS } from "../../sections";

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
              <ProjectList ids={credential.used_by.projects} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}

// Projects by name, each with its state and a link to its page.
function ProjectList({ ids }: { ids: string[] }) {
  const projects = useProjects();
  if (ids.length === 0) return null;
  const byId = new Map((projects.data ?? []).map((p) => [p.project_id, p]));
  return (
    <ul className={common.itemList}>
      {[...ids].sort().map((id) => {
        const project = byId.get(id);
        return (
          <li key={id}>
            <Link
              to={`/projects/${encodeURIComponent(id)}`}
              className={common.itemName}
            >
              {project?.name ?? id}
            </Link>
            <code className={common.itemId}>{id}</code>
            {project && (
              <HealthPill
                state={projectState(project)}
                labels={PROJECT_LABELS}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
