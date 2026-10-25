import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

type Credential = Schemas["CredentialInfo"];

// A credential that does not resolve is the problem to see first: whatever
// uses it fails. One that resolves but nothing names is not a fault, only a
// candidate for removal, so it reads as neutral rather than healthy.
export const CREDENTIAL_LABELS = {
  fresh: "Resolves",
  failing: "Missing",
  pending: "Unused",
};

export const credentialUsers = (credential: Credential) =>
  credential.used_by.sources.length +
  credential.used_by.projects.length +
  (credential.used_by.ldap ? 1 : 0);

export const credentialState = (credential: Credential): HealthState => {
  if (!credential.resolves) return "failing";
  return credentialUsers(credential) === 0 ? "pending" : "fresh";
};

// Where the secrets are read from, in a line: the env vars, the Vault path,
// the JSON file, or (for a credential made only of files) their paths.
export function credentialOrigin(credential: Credential): string {
  switch (credential.backend) {
    case "vault":
      return `Vault: ${credential.vault_path ?? ""}`;
    case "env":
      return credential.env_vars.join(", ");
    case "file":
      return credential.secret_file ?? "";
    default:
      return credential.file_keys.map((f) => f.path).join(", ");
  }
}
