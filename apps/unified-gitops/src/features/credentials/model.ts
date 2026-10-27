import { describeUsers } from "@opusprojects/unified-client";
import { credentialState as stateOf } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";

type Credential = Schemas["CredentialInfo"];

// A Vault's users are the credentials reading from it. Absent from an
// instance older than Vault credentials (0.3): none.
const readers = (u: Credential["used_by"]) => u.credentials?.length ?? 0;

export const credentialUsers = ({ used_by: u }: Credential) =>
  readers(u) + u.applications.length + u.projects.length + (u.ldap ? 1 : 0);

export const credentialState = (credential: Credential) =>
  stateOf(credential, credentialUsers(credential));

export const usedBy = ({ used_by: u }: Credential) =>
  describeUsers(
    [
      [readers(u), ["credential", "credentials"]],
      [u.applications.length, ["application", "applications"]],
      [u.projects.length, ["project", "projects"]],
    ],
    u.ldap,
  );
