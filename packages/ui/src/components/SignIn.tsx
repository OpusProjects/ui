import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Fact } from "./Health";
import { Badge, ChipList, Panel } from "./Page";
import detail from "./Detail.module.css";
import common from "./Common.module.css";

// The parts of a unified-* Configuration page that are the same in every
// app: how people sign in (LDAP, API keys) and where secrets come from. What
// a restricted rule or key may use differs per app (sources there,
// applications here), so the app passes it as `scope`: the ids, already
// joined into one list.

export interface AccessRuleView {
  name: string;
  role: string;
  groups: string[];
  users: string[];
  scope: string[];
}

export interface LdapView {
  url: string;
  starttls: boolean;
  ca_file?: string | null;
  bind_credential: string;
  search_base: string;
  access: AccessRuleView[];
}

export interface ApiKeyView {
  name: string;
  role: string;
  scope: string[];
}

const HINTS: Record<string, string> = {
  Server: "server.ui.ldap.url. The directory sign-ins are checked against.",
  Encryption:
    "ldaps:// is encrypted from the start; ldap:// with server.ui.ldap.starttls upgrades the connection first.",
  "Trusted CA":
    "server.ui.ldap.ca_file. The certificate authority the directory's certificate must chain to.",
  "LDAP sign-in":
    "server.ui.ldap. Whether people can sign in with their directory username and password. API keys are always accepted, by header or on the sign-in page.",
  "Bind account":
    "server.ui.ldap.bind_credential. The credential of the service account that looks users up.",
  "Search base": "server.ui.ldap.search_base. Where users are looked for.",
};

// "app-a, app-b", or Everything for an admin.
function scopeText(role: string, scope: string[]) {
  if (role === "admin") return "Everything";
  return scope.length > 0 ? scope.join(", ") : "Nothing";
}

function Clip({ value }: { value: string }) {
  return (
    <code className={`${detail.mono} ${detail.clipText}`} title={value}>
      {value}
    </code>
  );
}

export function SignInPanels({
  ldapOn,
  ldap,
  apiKeys,
  bindAccountLink,
  ldapDocs,
}: {
  ldapOn: boolean;
  ldap?: LdapView | null;
  apiKeys?: ApiKeyView[] | null;
  // The bind credential, as a link to its page (the app's router link).
  bindAccountLink: (credentialId: string, className: string) => ReactNode;
  // Where the LDAP set-up is documented, in the note shown while it is off.
  ldapDocs: string;
}) {
  return (
    <>
      <Panel title="LDAP">
        <dl className={detail.facts}>
          <Fact label="LDAP sign-in" hint={HINTS["LDAP sign-in"]}>
            {ldapOn ? "On" : "Off"}
          </Fact>
          {ldap && (
            <>
              <Fact label="Server" hint={HINTS["Server"]}>
                <Clip value={ldap.url} />
              </Fact>
              <Fact label="Encryption" hint={HINTS["Encryption"]}>
                {ldap.url.toLowerCase().startsWith("ldaps://")
                  ? "LDAPS"
                  : ldap.starttls
                    ? "StartTLS"
                    : "None"}
              </Fact>
              <Fact label="Bind account" hint={HINTS["Bind account"]}>
                {bindAccountLink(ldap.bind_credential, detail.link)}
              </Fact>
              <Fact label="Search base" hint={HINTS["Search base"]}>
                <Clip value={ldap.search_base} />
              </Fact>
              <Fact label="Trusted CA" hint={HINTS["Trusted CA"]}>
                {ldap.ca_file ? (
                  <Clip value={ldap.ca_file} />
                ) : (
                  "System trust store"
                )}
              </Fact>
            </>
          )}
        </dl>
        {!ldap && (
          <p className={detail.note}>
            To let people sign in with their directory account, add
            server.ui.ldap to config.yaml with the groups that may sign in (see{" "}
            {ldapDocs}).
          </p>
        )}
        {ldap && (
          // Folded by default: who may sign in is looked up now and then,
          // the directory's settings above every time.
          <details className={common.fold}>
            <summary title="Who may sign in with LDAP, and what they may use. Combined: admin in any matching rule is admin. Someone no rule names cannot sign in, even with the right password.">
              LDAP access rules ({ldap.access.length})
              <ChevronDown aria-hidden />
            </summary>
            <div className={common.plainWrap}>
              <table className={common.plain}>
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Role</th>
                    <th scope="col">Who</th>
                    <th scope="col">May use</th>
                  </tr>
                </thead>
                <tbody>
                  {ldap.access.map((rule) => (
                    <tr key={rule.name}>
                      <th scope="row">{rule.name}</th>
                      <td>
                        <Badge
                          tone={rule.role === "admin" ? "accent" : "neutral"}
                        >
                          {rule.role === "admin" ? "Admin" : "Restricted"}
                        </Badge>
                      </td>
                      <td>
                        <ChipList
                          items={[...rule.groups, ...rule.users]}
                          limit={3}
                        />
                      </td>
                      <td>{scopeText(rule.role, rule.scope)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Panel>

      {apiKeys && (
        <Panel
          title="API keys"
          hint="For automation, and break-glass access when the directory is down. Declared in api_keys.yaml; only names and scopes are shown, never a key."
        >
          <div className={common.plainWrap}>
            <table className={common.plain}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">May use</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.name}>
                    <th scope="row">
                      <code className={detail.mono}>{key.name}</code>
                    </th>
                    <td>
                      <Badge tone={key.role === "admin" ? "accent" : "neutral"}>
                        {key.role === "admin" ? "Admin" : "Restricted"}
                      </Badge>
                    </td>
                    <td>{scopeText(key.role, key.scope)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
