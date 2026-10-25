import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import {
  Badge,
  ChipList,
  EmptyState,
  Fact,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  formatAge,
  formatBytes,
  formatSpan,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import {
  useAuth,
  useCredentials,
  useProjects,
  useSettings,
} from "../../api/queries";
import { common } from "../../shared/Detail";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

type AuthInfo = Schemas["AuthInfo"];
type Settings = Schemas["Settings"];

// Said once, after a setting's own explanation, for the settings the
// process reads only when it starts.
const AT_START = " Read at start-up: a change takes effect after a restart.";

// What each setting means, behind its label, starting with its key in
// config.yaml (or the file it lives in), which is where it is changed.
const HINTS: Record<string, string> = {
  Version: "The unified-api release running here.",
  "Running for":
    "Since this process started. A short time with no deploy means it restarted, which is worth a look at its logs.",
  "Last saved":
    "When the cache snapshot was last written. An idle cache skips snapshots on purpose, so this ages while nothing changes; failing writes say so.",
  Checkouts:
    "The configured git projects with a clone on this instance's disk. One missing cannot run its scripts.",
  Address:
    "server.host and server.port. Where this instance listens." + AT_START,
  "Web UI":
    "server.ui.enabled. Whether this interface and its sign-in page are served." +
    AT_START,
  "Session length":
    "server.ui.session_ttl_seconds. How long a browser sign-in lasts before asking again.",
  Metrics:
    "server.metrics_require_auth. Whether /metrics needs an API key. Public by default, since a Prometheus scrape carries no key.",
  Readiness:
    "server.readyz_require_all_sources. When /readyz reports ready: as soon as one source has data, or only once every source has.",
  "Browser origins":
    "server.cors_allowed_origins. Other websites allowed to call this API from a browser. None means no CORS at all.",
  "Refresh wait":
    "server.refresh_timeout_seconds. How long a read with refresh=true waits for fresh data before answering from cache.",
  "Refresh limit":
    "server.refresh_max_concurrent. How many on-demand refreshes may run at once.",
  "Shutdown grace":
    "server.shutdown_grace_seconds. On shutdown, how long running syncs get to finish before the last cache snapshot is written.",
  "Request size":
    "server.max_body_bytes. The largest request body accepted, such as a configuration push.",
  "Cache snapshot":
    "cache.persistence.path. Where the cache is saved, so a restart starts with data instead of empty. Off: a restart starts empty and waits for every source to sync." +
    AT_START,
  "Saved every":
    "cache.persistence.interval_seconds. How often the snapshot is written (skipped when nothing changed)." +
    AT_START,
  "Projects folder":
    "projects.dir. Where the git projects are cloned." + AT_START,
  "Config API":
    "config_api.enabled. Whether the configuration files can be read, pushed and reloaded over /api/v1/config." +
    AT_START,
  "Secret cache":
    "secrets.cache_ttl_seconds. How long a resolved secret is reused, which is also how long a rotated secret takes to be picked up.",
  Vault:
    "secrets.vault.address. The Vault credentials can be read from (with vault_path in credentials.yaml). Not used: secrets come only from environment variables and files.",
  Credentials:
    "The credentials configured, and whether their secrets resolve right now. The Credentials page has each one.",
  "Vault timeout":
    "secrets.vault.timeout_seconds. How long a Vault call may take before resolution fails.",
  "Vault mount": "secrets.vault.mount. The KV v2 engine secrets are read from.",
  "Vault sign-in":
    "secrets.vault.kubernetes_role, or token_env. How this instance signs in to Vault: as its Kubernetes service account, or with a token from an environment variable.",
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

// Read-only on purpose: every setting here is declared in the configuration
// repository and pushed like the rest, so this page shows what is in force
// (defaults included, which the file leaves unsaid) and where to change it,
// not a form that the next push would undo.
export function ConfigPage() {
  const auth = useAuth();
  // Admin-only: a restricted caller is refused, and sees only the part
  // about themselves and how to sign in.
  const settings = useSettings();

  return (
    <>
      <PageHeader
        icon={ICONS.config}
        title="Configuration"
        description="How this instance is set up, defaults included, and who can sign in. Read-only: change it in the configuration repository."
      />
      {settings.data && settings.data.restart_pending.length > 0 && (
        <Notice title="Restart needed">
          A reload changed {settings.data.restart_pending.join(", ")}, which
          take effect only after this instance restarts.
        </Notice>
      )}
      {auth.isPending && <SkeletonSummary />}
      {auth.isError && (
        <Notice title="Could not load the configuration">
          {auth.error.message}
        </Notice>
      )}
      {auth.isSuccess && (
        <>
          {auth.data.me.role !== "admin" && (
            // Everything below is admin-only: say why the page is empty
            // rather than leaving it blank.
            <EmptyState title="Visible to admins only">
              You are signed in as {auth.data.me.name ?? "nobody"}, with
              restricted access. The configuration of this instance is shown to
              admins.
            </EmptyState>
          )}
          {settings.data && <ServerPanels settings={settings.data} />}
          <SignIn auth={auth.data} />
        </>
      )}
    </>
  );
}

const onOff = (on: boolean | null | undefined) =>
  on == null ? "Unknown" : on ? "On" : "Off";

function ServerPanels({ settings }: { settings: Settings }) {
  const { server, cache, projects, secrets, config_api } = settings;
  const vault = secrets.vault;
  const projectList = useProjects().data;
  const credentialList = useCredentials().data;
  const missing = credentialList?.filter((c) => !c.resolves).length ?? 0;
  const credentialSummary = !credentialList
    ? "…"
    : missing > 0
      ? `${missing} of ${credentialList.length} missing`
      : `${credentialList.length}, all resolve`;
  const checkouts = projectList
    ? `${projectList.filter((p) => p.checkout_present).length} of ${projectList.length} on disk`
    : "…";
  return (
    <>
      <Panel title="Server">
        {/* Rows of three: what is running and since when; who may reach
            it and how it reports; how it bounds work. */}
        <dl className={common.facts}>
          <Fact label="Version" hint={HINTS["Version"]}>
            v{settings.version}
          </Fact>
          <Fact label="Address" hint={HINTS["Address"]}>
            {server.host != null ? (
              <code className={common.mono}>
                {server.host}:{server.port}
              </code>
            ) : (
              "Unknown"
            )}
          </Fact>
          <Fact label="Running for" hint={HINTS["Running for"]}>
            {formatSpan(settings.uptime_seconds)}
          </Fact>

          <Fact label="Web UI" hint={HINTS["Web UI"]}>
            {onOff(server.ui.enabled)}
          </Fact>
          <Fact label="Session length" hint={HINTS["Session length"]}>
            {formatSpan(server.ui.session_ttl_seconds)}
          </Fact>
          <Fact label="Metrics" hint={HINTS["Metrics"]}>
            {server.metrics_require_auth ? "Requires an API key" : "Public"}
          </Fact>

          <Fact label="Readiness" hint={HINTS["Readiness"]}>
            {server.readyz_require_all_sources
              ? "Every source synced"
              : "Any source synced"}
          </Fact>
          <Fact label="Browser origins" hint={HINTS["Browser origins"]}>
            {server.cors_allowed_origins.length > 0 ? (
              <span
                className={common.clipText}
                title={server.cors_allowed_origins.join(", ")}
              >
                {server.cors_allowed_origins.join(", ")}
              </span>
            ) : (
              "None"
            )}
          </Fact>
          <Fact label="Request size" hint={HINTS["Request size"]}>
            Up to {formatBytes(server.max_body_bytes)}
          </Fact>

          <Fact label="Refresh wait" hint={HINTS["Refresh wait"]}>
            {formatSpan(server.refresh_timeout_seconds)}
          </Fact>
          <Fact label="Refresh limit" hint={HINTS["Refresh limit"]}>
            {server.refresh_max_concurrent} at once
          </Fact>
          <Fact label="Shutdown grace" hint={HINTS["Shutdown grace"]}>
            {formatSpan(server.shutdown_grace_seconds)}
          </Fact>
        </dl>
      </Panel>

      <Panel title="Storage">
        {/* The cache snapshot, then the git checkouts and the files. */}
        <dl className={common.facts}>
          <Fact label="Cache snapshot" hint={HINTS["Cache snapshot"]}>
            {cache.persistence_path ? (
              <code
                className={`${common.mono} ${common.clipText}`}
                title={cache.persistence_path}
              >
                {cache.persistence_path}
              </code>
            ) : (
              "Off"
            )}
          </Fact>
          <Fact label="Saved every" hint={HINTS["Saved every"]}>
            {cache.persistence_interval_seconds != null
              ? formatSpan(cache.persistence_interval_seconds)
              : "Never"}
          </Fact>
          <Fact label="Last saved" hint={HINTS["Last saved"]}>
            {cache.persistence_path == null
              ? "Never"
              : cache.consecutive_failures > 0
                ? `Failing, ${cache.consecutive_failures} in a row`
                : cache.last_saved_age_seconds != null
                  ? formatAge(cache.last_saved_age_seconds)
                  : "Not yet"}
          </Fact>

          <Fact label="Projects folder" hint={HINTS["Projects folder"]}>
            {projects.dir ? (
              <code
                className={`${common.mono} ${common.clipText}`}
                title={projects.dir}
              >
                {projects.dir}
              </code>
            ) : (
              "Unknown"
            )}
          </Fact>
          <Fact label="Checkouts" hint={HINTS["Checkouts"]}>
            {checkouts}
          </Fact>
          <Fact label="Config API" hint={HINTS["Config API"]}>
            {onOff(config_api.enabled)}
          </Fact>
        </dl>
      </Panel>

      <Panel
        title="Secrets"
        aside={
          <Link to="/credentials" className={common.link}>
            See every credential
          </Link>
        }
      >
        <dl className={common.facts}>
          <Fact label="Secret cache" hint={HINTS["Secret cache"]}>
            {formatSpan(secrets.cache_ttl_seconds)}
          </Fact>
          <Fact label="Vault" hint={HINTS["Vault"]}>
            {vault ? (
              <code
                className={`${common.mono} ${common.clipText}`}
                title={vault.address}
              >
                {vault.address}
              </code>
            ) : (
              "Not used"
            )}
          </Fact>
          <Fact label="Credentials" hint={HINTS["Credentials"]}>
            {credentialSummary}
          </Fact>
          {vault && (
            <>
              <Fact label="Vault mount" hint={HINTS["Vault mount"]}>
                <code className={common.mono}>{vault.mount}</code>
              </Fact>
              <Fact label="Vault sign-in" hint={HINTS["Vault sign-in"]}>
                {vault.auth === "kubernetes"
                  ? `Kubernetes role ${vault.kubernetes_role ?? ""}`
                  : `Token from ${vault.token_env ?? "an env var"}`}
              </Fact>
              <Fact label="Vault timeout" hint={HINTS["Vault timeout"]}>
                {formatSpan(vault.timeout_seconds)}
              </Fact>
            </>
          )}
        </dl>
      </Panel>
    </>
  );
}

// "src-vmware, ep-ansible-full", or Everything for an admin.
function scope(role: string, sources: string[], endpoints: string[]) {
  if (role === "admin") return "Everything";
  const all = [...sources, ...endpoints];
  return all.length > 0 ? all.join(", ") : "Nothing";
}

function SignIn({ auth }: { auth: AuthInfo }) {
  const { me, methods, ldap, api_keys } = auth;
  if (me.role !== "admin") return null;
  return (
    <>
      <Panel title="LDAP">
        <dl className={common.facts}>
          <Fact label="LDAP sign-in" hint={HINTS["LDAP sign-in"]}>
            {methods.ldap ? "On" : "Off"}
          </Fact>
          {ldap && (
            <>
              <Fact label="Server" hint={HINTS["Server"]}>
                <code
                  className={`${common.mono} ${common.clipText}`}
                  title={ldap.url}
                >
                  {ldap.url}
                </code>
              </Fact>
              <Fact label="Encryption" hint={HINTS["Encryption"]}>
                {ldap.url.toLowerCase().startsWith("ldaps://")
                  ? "LDAPS"
                  : ldap.starttls
                    ? "StartTLS"
                    : "None"}
              </Fact>
              <Fact label="Bind account" hint={HINTS["Bind account"]}>
                <Link
                  className={common.link}
                  to={`/credentials/${encodeURIComponent(ldap.bind_credential)}`}
                >
                  {ldap.bind_credential}
                </Link>
              </Fact>
              <Fact label="Search base" hint={HINTS["Search base"]}>
                <code
                  className={`${common.mono} ${common.clipText}`}
                  title={ldap.search_base}
                >
                  {ldap.search_base}
                </code>
              </Fact>
              <Fact label="Trusted CA" hint={HINTS["Trusted CA"]}>
                {ldap.ca_file ? (
                  <code
                    className={`${common.mono} ${common.clipText}`}
                    title={ldap.ca_file}
                  >
                    {ldap.ca_file}
                  </code>
                ) : (
                  "System trust store"
                )}
              </Fact>
            </>
          )}
        </dl>
        {!ldap && (
          <p className={common.note}>
            To let people sign in with their directory account, add
            server.ui.ldap to config.yaml with the groups that may sign in (see
            docs/ldap-login.md in unified-api).
          </p>
        )}
        {ldap && (
          // Folded by default: who may sign in is looked up now and then,
          // the directory's settings above every time.
          <details className={styles.fold}>
            <summary title="Who may sign in with LDAP, and what they may use. Combined: admin in any matching rule is admin. Someone no rule names cannot sign in, even with the right password.">
              LDAP access rules ({ldap.access.length})
              <ChevronDown aria-hidden />
            </summary>
            <div className={styles.plainWrap}>
              <table className={styles.plain}>
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
                      <td>{scope(rule.role, rule.sources, rule.endpoints)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Panel>

      {api_keys && (
        <Panel
          title="API keys"
          hint="For automation, and break-glass access when the directory is down. Declared in api_keys.yaml; only names and scopes are shown, never a key."
        >
          <div className={styles.plainWrap}>
            <table className={styles.plain}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">May use</th>
                </tr>
              </thead>
              <tbody>
                {api_keys.map((key) => (
                  <tr key={key.name}>
                    <th scope="row">
                      <code className={common.mono}>{key.name}</code>
                    </th>
                    <td>
                      <Badge tone={key.role === "admin" ? "accent" : "neutral"}>
                        {key.role === "admin" ? "Admin" : "Restricted"}
                      </Badge>
                    </td>
                    <td>{scope(key.role, key.sources, key.endpoints)}</td>
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
