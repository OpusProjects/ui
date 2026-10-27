import type { ReactNode } from "react";
import { Link } from "react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  CREDENTIAL_LABELS,
  credentialHealth,
  credentialOrigin,
  type CredentialSource,
} from "@opusprojects/unified-client";
import { Fact, HealthPill, ResourceCard } from "./Health";
import { Panel } from "./Page";
import { ValueList } from "./Detail";
import detail from "./Detail.module.css";
import { ListPage } from "./ListPage";
import commonStyles from "./Common.module.css";

// What every unified-* app's credentials have in common. Who USES one
// differs (sources there, applications here), and so does how one is named,
// so each app passes a `view` that says both.
export interface CredentialLike extends CredentialSource {
  type: string;
  resolves: boolean;
  error?: string | null;
}

export interface CredentialView {
  // The identity: its URL and what references name.
  id: string;
  // The name, as on every card and the page it opens; the description goes
  // under it.
  title: string;
  description?: string | null;
  // How many things name it: none is "unused", not healthy.
  users: number;
}

export const credentialState = (credential: CredentialLike, users: number) =>
  credentialHealth(credential.resolves, users);

export function CredentialsPage<T extends CredentialLike>({
  query,
  view,
  icon,
  description,
  placeholder,
  empty,
}: {
  query: UseQueryResult<T[]>;
  view: (credential: T) => CredentialView;
  icon: ReactNode;
  description: string;
  placeholder: string;
  empty: ReactNode;
}) {
  return (
    <ListPage
      query={query}
      header={{ icon, title: "Credentials", description }}
      noun={["credential", "credentials"]}
      state={(c) => credentialState(c, view(c).users)}
      labels={CREDENTIAL_LABELS}
      good="working"
      search={(c) => {
        const v = view(c);
        return `${v.id} ${v.title} ${v.description ?? ""} ${c.env_vars.join(" ")} ${c.vault_path ?? ""}`;
      }}
      placeholder={placeholder}
      empty={empty}
      card={(credential) => {
        const v = view(credential);
        const origin = credentialOrigin(credential);
        return (
          <ResourceCard
            key={v.id}
            title={v.title}
            description={v.description}
            state={credentialState(credential, v.users)}
            labels={CREDENTIAL_LABELS}
            error={credential.error}
            titleLink={(title, className) => (
              <Link
                to={`/credentials/${encodeURIComponent(v.id)}`}
                className={className}
              >
                {title}
              </Link>
            )}
          >
            <Fact label="Type">{credential.type}</Fact>
            <Fact label="Read from">
              <code className={commonStyles.mono} title={origin}>
                {origin}
              </code>
            </Fact>
          </ResourceCard>
        );
      }}
    />
  );
}

// Where the secrets are read from, by the backend's own name.
const BACKENDS: Record<string, string> = {
  vault: "Vault",
  env: "Environment variables",
  file: "JSON file",
  files: "Files only",
};

// What each overview fact means, behind its label, starting with its key in
// the credential's item file, which is where it is changed. What uses a
// credential differs per app, so that hint (and how the connector receives
// the secrets) comes from the app.
const HINTS = {
  "Read from":
    "Where the secret values come from: a Vault path wins over everything, then env_prefix (environment variables), then secret_file (a JSON file).",
  "Env variables":
    "env_prefix with each secret_keys value: the variables read, set by the deployment (a Kubernetes secret, an .env file).",
  "Vault path":
    "vault_path. The KV v2 secret read, under the mount set in config.yaml.",
  "Secret file":
    "secret_file. The JSON file read, and its fields picked by secret_keys.",
  Files:
    "file_keys. Files handed to the script by path, such as an SSH key or a certificate.",
};

export interface CredentialDetailLike extends CredentialLike {
  backend: string;
  secret_keys: string[];
  file_keys: { name: string; path: string }[];
  used_by: { ldap: boolean };
}

// A credential's own page, its overview panel: what it is and who needs it;
// then where exactly it is read from and what it hands over.
export function CredentialOverview({
  credential,
  users,
  usedBy,
  hints,
}: {
  credential: CredentialDetailLike;
  // How many things name it, and the same said in words.
  users: number;
  usedBy: string;
  hints: { type: string; secretKeys: string; usedBy: string };
}) {
  const location =
    credential.backend === "vault" ? (
      <Fact label="Vault path" hint={HINTS["Vault path"]}>
        <code className={detail.mono}>{credential.vault_path}</code>
      </Fact>
    ) : credential.backend === "env" ? (
      <Fact label="Env variables" hint={HINTS["Env variables"]}>
        <ValueList values={credential.env_vars} mono />
      </Fact>
    ) : credential.backend === "file" ? (
      <Fact label="Secret file" hint={HINTS["Secret file"]}>
        <code
          className={`${detail.mono} ${detail.clipText}`}
          title={credential.secret_file ?? ""}
        >
          {credential.secret_file}
        </code>
      </Fact>
    ) : null;

  return (
    <Panel
      title="Overview"
      hint="Where this credential's secrets are read from and whether they resolve now. Never the secrets themselves."
      aside={
        <HealthPill
          state={credentialState(credential, users)}
          labels={CREDENTIAL_LABELS}
        />
      }
    >
      <dl className={detail.facts}>
        <Fact label="Type" hint={hints.type}>
          {credential.type}
        </Fact>
        <Fact label="Read from" hint={HINTS["Read from"]}>
          {BACKENDS[credential.backend] ?? credential.backend}
        </Fact>
        <Fact label="Used by" hint={hints.usedBy}>
          {usedBy}
        </Fact>
        {location}
        <Fact label="Secret keys" hint={hints.secretKeys}>
          <ValueList values={credential.secret_keys} />
        </Fact>
        <Fact label="Files" hint={HINTS.Files}>
          <ValueList
            values={credential.file_keys.map((f) => (
              <span key={f.name} title={`${f.name}: ${f.path}`}>
                {f.name}
              </span>
            ))}
          />
        </Fact>
      </dl>
      {credential.error && <p className={detail.error}>{credential.error}</p>}
      {credential.used_by.ldap && (
        <p className={detail.note}>
          The LDAP login binds with it to look users up: if it stops resolving,
          nobody can sign in with a directory account.
        </p>
      )}
    </Panel>
  );
}
