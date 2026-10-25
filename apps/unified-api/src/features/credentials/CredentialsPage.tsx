import { Link } from "react-router";
import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useCredentials } from "../../api/queries";
import { ListToolbar } from "../../shared/ListToolbar";
import { useListFilter } from "../../shared/useListFilter";
import { CREDENTIAL_LABELS, credentialOrigin, credentialState } from "./model";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

type Credential = Schemas["CredentialInfo"];

const searchText = (c: Credential) =>
  `${c.credential_id} ${c.name} ${c.env_vars.join(" ")} ${c.vault_path ?? ""}`;

// "23 sources, 1 project, the LDAP login": what breaks if it goes.
export function usedBy(credential: Credential): string {
  const { sources, projects, ldap } = credential.used_by;
  const parts = [
    sources.length > 0 &&
      `${sources.length} ${sources.length === 1 ? "source" : "sources"}`,
    projects.length > 0 &&
      `${projects.length} ${projects.length === 1 ? "project" : "projects"}`,
    ldap && "the LDAP login",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Nothing";
}

export function CredentialsPage() {
  const credentials = useCredentials();
  const items = credentials.data ?? [];
  const filter = useListFilter(items, credentialState, searchText);
  const remembered = useRememberedCount(
    "credentials",
    credentials.isSuccess ? credentials.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.credentials}
        title="Credentials"
        description="The secrets this instance uses, where each one is read from, and whether it is there. Never the secrets themselves."
      />
      {credentials.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {credentials.isError && (
        <Notice title="Could not load credentials">
          {credentials.error.message}
        </Notice>
      )}
      {credentials.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["credential", "credentials"]}
            labels={CREDENTIAL_LABELS}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search credentials"
            placeholder="Search by name, id, variable or Vault path"
          />
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No credentials configured"
                  : "No credentials match"
              }
            >
              {items.length === 0
                ? "Declare one in credentials.yaml when a source, project or the LDAP login needs a secret."
                : "Clear the search or the filter to see every credential."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((credential) => (
                <ResourceCard
                  key={credential.credential_id}
                  title={credential.name}
                  id={credential.credential_id}
                  state={credentialState(credential)}
                  labels={CREDENTIAL_LABELS}
                  error={credential.error}
                  titleLink={(title, className) => (
                    <Link
                      to={`/credentials/${encodeURIComponent(credential.credential_id)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                >
                  <Fact label="Type">{credential.type}</Fact>
                  <Fact label="Read from">
                    <code
                      className={styles.mono}
                      title={credentialOrigin(credential)}
                    >
                      {credentialOrigin(credential)}
                    </code>
                  </Fact>
                  <Fact label="Used by">{usedBy(credential)}</Fact>
                </ResourceCard>
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}
