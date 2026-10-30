import { describeUsers } from "@opusprojects/unified-client";
import { credentialState as stateOf } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";

type Credential = Schemas["CredentialInfo"];

export const credentialUsers = ({ used_by: u }: Credential) =>
  u.credentials.length +
  u.projects.length +
  u.webhooks.length +
  u.apis.length +
  u.scripts.length +
  (u.ldap ? 1 : 0);

export const credentialState = (credential: Credential) =>
  stateOf(credential, credentialUsers(credential));

export const usedBy = ({ used_by: u }: Credential) =>
  describeUsers(
    [
      [u.credentials.length, ["credential", "credentials"]],
      [u.projects.length, ["project", "projects"]],
      [u.apis.length, ["API", "APIs"]],
      [u.scripts.length, ["script", "scripts"]],
      [u.webhooks.length, ["webhook", "webhooks"]],
    ],
    u.ldap,
  );
