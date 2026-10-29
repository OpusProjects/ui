import { Link, useParams } from "react-router";
import {
  EmptyState,
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  type ListColumn,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useApplications, useCredentials } from "../../api/queries";
import { CredentialOverview, DetailTitle } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import { ProjectTable } from "../../shared/ProjectTable";
import { credentialState, credentialUsers, usedBy } from "./model";
import { CREDENTIAL_LABELS } from "@opusprojects/unified-client";

type Credential = Schemas["CredentialInfo"];

// The overview's hints that are this app's own: what receives the secrets,
// and what can name a credential.
const HINTS = {
  type: "type. username_password, token or ssh_key: what the connector or the git pull expects to receive; or vault, a Vault other credentials are read from.",
  secretKeys:
    "secret_keys. The names the connector receives the secrets under (CREDENTIAL_<KEY>); never their values.",
  usedBy:
    "What names this credential: applications (credentials), projects (credentials), the LDAP login (bind_credential) and, for a Vault, the credentials read from it (vault).",
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
  const apps = new Map((applications.data ?? []).map((a) => [a.name, a]));
  const {
    applications: appNames,
    projects: projectNames,
    ldap,
  } = credential.used_by;
  const readers = credential.used_by.credentials ?? [];
  if (
    readers.length === 0 &&
    appNames.length === 0 &&
    projectNames.length === 0 &&
    !ldap
  )
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
      {readers.length > 0 && (
        <Panel
          title="Credentials"
          hint="The credentials read from this Vault: their vault names it, and each is read at its vault_path."
        >
          <ReaderTable names={readers} />
        </Panel>
      )}
      {appNames.length > 0 && (
        <Panel
          title="Applications"
          hint="The applications using this credential: their credentials name it, and their connector receives these secrets on every run."
        >
          <ListTable
            columns={applicationColumns(
              "connector",
              applications.dataUpdatedAt,
            )}
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
          hint="The projects using this credential: their credentials name it, and they clone and pull their repository with it."
        >
          <ProjectTable names={projectNames} empty="No project uses it." />
        </Panel>
      )}
    </>
  );
}

// The credentials read from a Vault: each linked by name, where in the Vault
// it is read, and whether it resolves.
function ReaderTable({ names }: { names: string[] }) {
  const credentials = useCredentials();
  const byName = new Map((credentials.data ?? []).map((c) => [c.name, c]));
  type Row = { name: string; credential?: Credential };
  const rows: Row[] = [...names]
    .sort()
    .map((name) => ({ name, credential: byName.get(name) }));
  const columns: ListColumn<Row>[] = [
    {
      key: "name",
      label: "Credential",
      role: "name",
      title: (r) => r.name,
      render: (r) => (
        <ListName
          name={r.credential?.description ?? r.name}
          id={r.name}
          link={(className, children) => (
            <Link
              to={`/credentials/${encodeURIComponent(r.name)}`}
              className={className}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
    {
      key: "path",
      label: "Vault path",
      title: (r) => r.credential?.vault_path ?? "",
      render: (r) =>
        r.credential?.vault_path ? (
          <code>{r.credential.vault_path}</code>
        ) : (
          <ListSoft>–</ListSoft>
        ),
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: (r) =>
        r.credential ? (
          <HealthPill
            state={credentialState(r.credential)}
            labels={CREDENTIAL_LABELS}
          />
        ) : (
          <ListSoft>–</ListSoft>
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      empty="No credential is read from this Vault."
      noun="credentials"
    />
  );
}
