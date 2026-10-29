// How a credential is described the same way in every unified-* app. What
// USES a credential differs (sources there, applications here), so each app counts
// its users itself and passes the count in.
import { countOf } from "./format";
import type { HealthState } from "./health";

// A credential that does not resolve is the problem to see first: whatever
// uses it fails. One that resolves but nothing names is not a fault, only a
// candidate for removal, so it reads as neutral rather than healthy.
export const CREDENTIAL_LABELS = {
  fresh: "Working",
  failing: "Missing",
  pending: "Unused",
};

export function credentialHealth(
  resolves: boolean,
  users: number,
): HealthState {
  if (!resolves) return "failing";
  return users === 0 ? "pending" : "fresh";
}

export interface CredentialSource {
  backend: string;
  vault_path?: string | null;
  env_vars: string[];
  secret_file?: string | null;
  file_keys: { path: string }[];
  // Set on a `type: vault` credential only: the Vault it is.
  vault_connection?: { address: string } | null;
}

// Where the secrets are read from, in a line: the env vars, the Vault path,
// the JSON file, or (for a credential made only of files) their paths. A
// Vault itself has no vault_path: its line is its address.
export function credentialOrigin(credential: CredentialSource): string {
  switch (credential.backend) {
    case "vault":
      return credential.vault_connection
        ? credential.vault_connection.address
        : `Vault: ${credential.vault_path ?? ""}`;
    case "env":
      return credential.env_vars.join(", ");
    case "file":
      return credential.secret_file ?? "";
    default:
      return credential.file_keys.map((f) => f.path).join(", ");
  }
}

// "23 sources, 1 project, the LDAP login": what breaks if a credential goes,
// from each kind of user's count and its [one, many] nouns. Kinds with none
// are left out; nothing at all reads "Nothing".
export function describeUsers(
  counts: [number, [string, string]][],
  ldap = false,
): string {
  const parts = counts
    .filter(([n]) => n > 0)
    .map(([n, [one, many]]) => countOf(n, one, many));
  if (ldap) parts.push("the LDAP login");
  return parts.length > 0 ? parts.join(", ") : "Nothing";
}
