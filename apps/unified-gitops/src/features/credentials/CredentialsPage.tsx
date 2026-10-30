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
        id: c.name,
        title: c.name,
        description: c.description,
        users: credentialUsers(c),
      })}
      icon={ICONS.credentials}
      description="Secrets for API calls, scripts, webhooks and git pulls: where each is read from, and whether it resolves."
      placeholder="Search by name, description, variable or Vault path"
      empty="Declare one under credentials: in the configuration when a project, an API, a script, a webhook or the LDAP login needs a secret."
    />
  );
}
