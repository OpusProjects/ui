import { CredentialsPage as Page } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useCredentials } from "../../api/queries";
import { ICONS } from "../../sections";
import { credentialUsers } from "./model";

type Credential = Schemas["CredentialInfo"];

export function CredentialsPage() {
  return (
    <Page
      query={useCredentials()}
      view={(c: Credential) => ({
        id: c.credential_id,
        title: c.name,
        idTag: c.credential_id,
        users: credentialUsers(c),
      })}
      icon={ICONS.credentials}
      description="The secrets this instance uses, where each one is read from, and whether it is there. Never the secrets themselves."
      placeholder="Search by name, id, variable or Vault path"
      empty="Declare one under credentials: in the configuration when a source, a project or the LDAP login needs a secret."
    />
  );
}
