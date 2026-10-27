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
import { ListName, ListSoft, ListTable, type ListColumn } from "./ListTable";
import { formatSpan } from "../lib/format";
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
      name={(c) => view(c).title}
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
    "Where the secret values come from: a vault_path in the Vault it names wins over everything, then env_vars (environment variables), then secret_file (a JSON file).",
  "Env variables":
    "env_vars. The variables read, each named in full, set by the deployment (a Kubernetes secret, an .env file).",
  Vault:
    "vault. The type: vault credential this one is read from: its address, how it logs in and how long it keeps what it read.",
  "Vault path": "vault_path. The KV v2 secret read, under that Vault's mount.",
  "Token from":
    "env_vars.token. The variable holding the token this Vault is logged in to with (or Kubernetes auth, when none is listed).",
  "Secret file":
    "secret_file. The JSON file read, and its fields picked by secret_keys.",
  Files:
    "file_keys. Files handed to the script by path, such as an SSH key or a certificate.",
};

export interface CredentialDetailLike extends CredentialLike {
  type: string;
  backend: string;
  vault?: string | null;
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
  // A Vault connection hands nothing to a script: what it shows is how it
  // logs in.
  const isVault = credential.type === "vault";
  const location = isVault ? (
    <Fact label="Token from" hint={HINTS["Token from"]}>
      {credential.env_vars.length > 0 ? (
        <ValueList values={credential.env_vars} mono />
      ) : (
        "Kubernetes auth"
      )}
    </Fact>
  ) : credential.backend === "vault" ? (
    <>
      <Fact label="Vault" hint={HINTS.Vault}>
        {credential.vault ? (
          <Link
            className={commonStyles.link}
            to={`/credentials/${encodeURIComponent(credential.vault)}`}
          >
            {credential.vault}
          </Link>
        ) : (
          "config.yaml (deprecated)"
        )}
      </Fact>
      <Fact label="Vault path" hint={HINTS["Vault path"]}>
        <code className={detail.mono}>{credential.vault_path}</code>
      </Fact>
    </>
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
        {!isVault && (
          <Fact label="Secret keys" hint={hints.secretKeys}>
            <ValueList values={credential.secret_keys} />
          </Fact>
        )}
        {!isVault && (
          <Fact label="Files" hint={HINTS.Files}>
            <ValueList
              values={credential.file_keys.map((f) => (
                <span key={f.name} title={`${f.name}: ${f.path}`}>
                  {f.name}
                </span>
              ))}
            />
          </Fact>
        )}
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

// One Vault on the Configuration page: a `type: vault` credential (linked to
// its page), or the deprecated config.yaml secrets.vault (no page: `id` null).
export interface VaultRow {
  id: string | null;
  name: string;
  address: string;
  cache_ttl_seconds: number | null;
}

// Where secrets can come from besides the environment: one row per Vault,
// its address and how long it keeps what it read. Its login, mount and the
// credentials read from it are on its own page.
export function SecretsPanel({
  vaults,
  loading,
}: {
  vaults: VaultRow[];
  loading?: boolean;
}) {
  const columns: ListColumn<VaultRow>[] = [
    {
      key: "name",
      label: "Vault",
      role: "name",
      title: (v) => v.id ?? v.name,
      render: (v) =>
        v.id ? (
          <ListName
            name={v.name}
            id={v.id}
            link={(className, children) => (
              <Link
                to={`/credentials/${encodeURIComponent(v.id ?? "")}`}
                className={className}
              >
                {children}
              </Link>
            )}
          />
        ) : (
          v.name
        ),
    },
    {
      key: "address",
      label: "Address",
      title: (v) => v.address,
      render: (v) => <code className={detail.mono}>{v.address}</code>,
    },
    {
      key: "cache",
      label: "Cache",
      numeric: true,
      render: (v) =>
        v.cache_ttl_seconds == null ? (
          <ListSoft>–</ListSoft>
        ) : v.cache_ttl_seconds === 0 ? (
          "None"
        ) : (
          formatSpan(v.cache_ttl_seconds)
        ),
    },
  ];
  return (
    <Panel
      title="Secrets"
      hint="The Vaults credentials can be read from (type: vault credentials, named by their vault), and how long each keeps what it read: also how long a rotation there takes to be seen. Everything else is read from environment variables or files, fresh on every use."
    >
      <ListTable
        columns={columns}
        rows={vaults}
        rowKey={(v) => v.id ?? "config.yaml"}
        empty={
          loading
            ? "Loading…"
            : "No Vault: every secret is read from environment variables or files."
        }
        noun="Vaults"
      />
    </Panel>
  );
}
