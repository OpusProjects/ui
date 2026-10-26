import { describeUsers } from "@opusprojects/unified-client";
import { credentialState as stateOf } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";

type Credential = Schemas["CredentialInfo"];

export const credentialUsers = ({ used_by: u }: Credential) =>
  u.applications.length + u.projects.length + (u.ldap ? 1 : 0);

export const credentialState = (credential: Credential) =>
  stateOf(credential, credentialUsers(credential));

export const usedBy = ({ used_by: u }: Credential) =>
  describeUsers(
    [
      [u.applications.length, ["application", "applications"]],
      [u.projects.length, ["project", "projects"]],
    ],
    u.ldap,
  );
