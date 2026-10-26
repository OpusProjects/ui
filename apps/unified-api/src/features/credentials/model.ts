import { CREDENTIAL_LABELS, describeUsers } from "@opusprojects/unified-client";
import { credentialState as stateOf } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";

type Credential = Schemas["CredentialInfo"];

export { CREDENTIAL_LABELS };

export const credentialUsers = ({ used_by: u }: Credential) =>
  u.sources.length + u.projects.length + (u.ldap ? 1 : 0);

export const credentialState = (credential: Credential) =>
  stateOf(credential, credentialUsers(credential));

export const usedBy = ({ used_by: u }: Credential) =>
  describeUsers(
    [
      [u.sources.length, ["source", "sources"]],
      [u.projects.length, ["project", "projects"]],
    ],
    u.ldap,
  );
