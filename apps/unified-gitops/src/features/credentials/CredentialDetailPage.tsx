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
import { useCredentials } from "../../api/queries";
import { CredentialOverview, DetailTitle } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";
import { ActionTable } from "../../shared/ActionTable";
import { WebhookTable } from "../../shared/WebhookTable";
import { ProjectTable } from "../../shared/ProjectTable";
import { credentialState, credentialUsers, usedBy } from "./model";
import { CREDENTIAL_LABELS } from "@opusprojects/unified-client";

type Credential = Schemas["CredentialInfo"];

// The overview's hints that are this app's own: what receives the secrets,
// and what can name a credential.
const HINTS = {
  type: "type. username_password, token or ssh_key: what an API call, a webhook, a script or a git pull expects to receive; or vault, a Vault other credentials are read from.",
  secretKeys:
    "secret_keys. The names its secrets go by: the fields an API's or a webhook's auth reads, and a script's CREDENTIAL_<KEY> variables; never their values.",
  usedBy:
    "What names this credential: projects, API items, script items and webhooks (credential, and the auth that reads it), the LDAP login (bind_credential) and, for a Vault, the credentials read from it (vault).",
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

// Who receives these secrets, one table per kind of user, as a project's
// page lists what acts on it.
function Users({ credential }: { credential: Credential }) {
  const {
    credentials: readers,
    projects,
    apis,
    scripts,
    webhooks,
    ldap,
  } = credential.used_by;
  if (
    readers.length +
      projects.length +
      apis.length +
      scripts.length +
      webhooks.length ===
      0 &&
    !ldap
  )
    return (
      <Panel title="Used by">
        <ListSoft>
          Nothing uses this credential: no project, API, script, webhook or
          login names it.
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
      {projects.length > 0 && (
        <Panel
          title="Projects"
          hint="The projects using this credential: they clone and pull their repository with it."
        >
          <ProjectTable names={projects} empty="No project uses it." />
        </Panel>
      )}
      {apis.length > 0 && (
        <Panel
          title="APIs"
          hint="The API items using this credential: their auth sends it with every request."
        >
          <ActionTable kind="api" names={apis} empty="No API uses it." />
        </Panel>
      )}
      {scripts.length > 0 && (
        <Panel
          title="Scripts"
          hint="The script items given this credential: its fields reach the script as CREDENTIAL_<FIELD> variables."
        >
          <ActionTable
            kind="script"
            names={scripts}
            empty="No script uses it."
          />
        </Panel>
      )}
      {webhooks.length > 0 && (
        <Panel
          title="Webhooks"
          hint="The webhooks using this credential: to authenticate, to sign the body, or as a client certificate."
        >
          <WebhookTable
            hears={(n) => webhooks.includes(n.name)}
            empty="No webhook uses it."
          />
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
