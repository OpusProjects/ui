import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useCredentials, useProjects } from "../../api/queries";
import { DetailTitle, common } from "../../shared/Detail";
import { SourceTable } from "../../shared/SourceTable";
import { CREDENTIAL_LABELS, credentialState, credentialUsers } from "./model";
import { PROJECT_LABELS, projectState } from "../projects/model";
import { ICONS } from "../../sections";
import { usedBy } from "./CredentialsPage";

type Credential = Schemas["CredentialInfo"];

// Where the secrets are read from, by the backend's own name.
const BACKENDS: Record<string, string> = {
  vault: "Vault",
  env: "Environment variables",
  file: "JSON file",
  files: "Files only",
};

// What each overview fact means, behind its label. Settings start with
// their key in credentials.yaml, which is where they are changed.
const HINTS: Record<string, string> = {
  Type: "type. username_password, token or ssh_key: what the connector expects to receive.",
  "Read from":
    "Where the secret values come from: a Vault path wins over everything, then env_prefix (environment variables), then secret_file (a JSON file).",
  Status:
    "Whether the secrets resolve right now, asked exactly as a sync asks. Missing means whatever uses this credential fails until it is there.",
  "Env variables":
    "env_prefix with each secret_keys value: the variables read, set by the deployment (a Kubernetes secret, an .env file).",
  "Vault path":
    "vault_path. The KV v2 secret read, under the mount set in config.yaml.",
  "Secret file":
    "secret_file. The JSON file read, and its fields picked by secret_keys.",
  "Secret keys":
    "secret_keys. The names the connector receives the secrets under; never their values.",
  Files:
    "file_keys. Files handed to the script by path, such as an SSH key or a certificate.",
  "Used by":
    "What names this credential: sources (credential_ids), projects (credential_id) and the LDAP login (bind_credential).",
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
          <Overview credential={credential} />
          {/* Shown when sources use it, or when nothing does (so the page
              says so); not as an empty card above the project that does. */}
          {(credential.used_by.sources.length > 0 ||
            credentialUsers(credential) === 0) && (
            <Panel
              title="Sources using it"
              hint="Sources whose credential_ids name it: their connector receives these secrets on every sync."
            >
              <SourceTable
                ids={credential.used_by.sources}
                empty="Nothing uses this credential: no source, project or login names it."
              />
            </Panel>
          )}
          {credential.used_by.projects.length > 0 && (
            <Panel
              title="Projects using it"
              hint="Projects whose credential_id names it: they clone and pull their repository with it."
            >
              <ProjectList ids={credential.used_by.projects} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}

function Overview({ credential }: { credential: Credential }) {
  const location =
    credential.backend === "vault" ? (
      <Fact label="Vault path" hint={HINTS["Vault path"]}>
        <code className={common.mono}>{credential.vault_path}</code>
      </Fact>
    ) : credential.backend === "env" ? (
      <Fact label="Env variables" hint={HINTS["Env variables"]}>
        <code
          className={`${common.mono} ${common.clipText}`}
          title={credential.env_vars.join(", ")}
        >
          {credential.env_vars.join(", ")}
        </code>
      </Fact>
    ) : credential.backend === "file" ? (
      <Fact label="Secret file" hint={HINTS["Secret file"]}>
        <code
          className={`${common.mono} ${common.clipText}`}
          title={credential.secret_file ?? ""}
        >
          {credential.secret_file}
        </code>
      </Fact>
    ) : null;

  return (
    <Panel
      title="Overview"
      aside={
        <HealthPill
          state={credentialState(credential)}
          labels={CREDENTIAL_LABELS}
        />
      }
    >
      {/* What it is and whether it works; then where exactly it is read
          from and what it hands over. */}
      <dl className={common.facts}>
        <Fact label="Type" hint={HINTS["Type"]}>
          {credential.type}
        </Fact>
        <Fact label="Read from" hint={HINTS["Read from"]}>
          {BACKENDS[credential.backend] ?? credential.backend}
        </Fact>
        <Fact label="Used by" hint={HINTS["Used by"]}>
          {usedBy(credential)}
        </Fact>

        {location}
        <Fact label="Secret keys" hint={HINTS["Secret keys"]}>
          {credential.secret_keys.length > 0
            ? credential.secret_keys.join(", ")
            : "None"}
        </Fact>
        <Fact label="Files" hint={HINTS["Files"]}>
          {credential.file_keys.length > 0 ? (
            <span
              className={common.clipText}
              title={credential.file_keys
                .map((f) => `${f.name}: ${f.path}`)
                .join(", ")}
            >
              {credential.file_keys.map((f) => f.name).join(", ")}
            </span>
          ) : (
            "None"
          )}
        </Fact>
      </dl>
      {credential.error && <p className={common.error}>{credential.error}</p>}
      {credential.used_by.ldap && (
        <p className={common.note}>
          The LDAP login binds with it to look users up: if it stops resolving,
          nobody can sign in with a directory account.
        </p>
      )}
    </Panel>
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
