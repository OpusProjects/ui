import { Link } from "react-router";
import {
  EmptyState,
  Fact,
  Notice,
  PageHeader,
  Panel,
  SecretsPanel,
  SignInPanels,
  SkeletonSummary,
  formatBytes,
  formatSpan,
} from "@opusprojects/unified-ui";
import { ValueList } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import {
  useAuth,
  useCredentials,
  useProjects,
  useSettings,
} from "../../api/queries";
import { Clip, detailStyles as common, onOff } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";

type AuthInfo = Schemas["AuthInfo"];
type Settings = Schemas["Settings"];

// Said once, after a setting's own explanation, for the settings the
// process reads only when it starts.
const AT_START = " Read at start-up: a change takes effect after a restart.";

// What each setting means, behind its label, starting with its key in
// config.yaml, which is where it is changed.
const HINTS: Record<string, string> = {
  Version: "The release running here.",
  "Running for":
    "Since this process started. A short time with no deploy means it restarted, which is worth a look at its logs.",
  Address:
    "server.url: where people reach this instance, the address it is known by. Unset: server.host and server.port, where the process listens (restart-only).",
  "Web UI":
    "server.ui.enabled. Whether this interface and its sign-in page are served." +
    AT_START,
  "Session length":
    "server.ui.session_ttl_seconds. How long a browser sign-in lasts before asking again." +
    AT_START,
  Metrics:
    "server.metrics_require_auth. Whether /metrics needs an API key. Public by default, since a Prometheus scrape carries no key.",
  "Browser origins":
    "server.cors_allowed_origins. Other websites allowed to call this API from a browser. None means no CORS at all.",
  "Shutdown grace":
    "server.shutdown_grace_seconds. On shutdown, how long a running sync gets to finish its operations before the process exits anyway.",
  "Request size":
    "server.max_body_bytes. The largest request body accepted, such as a configuration push.",
  "State folder":
    "state.dir. Where the local copy of every system's current settings is written, one YAML file per application and kind." +
    AT_START,
  "Projects folder":
    "projects.dir. Where the git projects are cloned." + AT_START,
  Checkouts:
    "The configured git projects with a clone on this instance's disk. One missing has no desired state to compare.",
  "Config API":
    "config_api.enabled. Whether the configuration files can be read, pushed and reloaded over /api/v1/config." +
    AT_START,
};

// Read-only on purpose: every setting is declared in the configuration
// repository and pushed like the rest; this shows what is in force,
// defaults included, and where to change it.
export function ConfigPage() {
  const auth = useAuth();
  const settings = useSettings();

  return (
    <>
      <PageHeader
        icon={ICONS.config}
        title="Configuration"
        description="How this instance is set up, defaults included, and who can sign in. Read-only."
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

function ServerPanels({ settings }: { settings: Settings }) {
  const { server, state, projects, secrets, config_api } = settings;
  const projectList = useProjects().data;
  const credentialList = useCredentials().data;
  const missing = credentialList?.filter((c) => !c.resolves).length ?? 0;
  const credentialSummary = !credentialList
    ? "…"
    : missing > 0
      ? `${missing} of ${credentialList.length} missing`
      : `${credentialList.length}, all working`;
  const checkouts = projectList
    ? `${projectList.filter((p) => p.checkout_present).length} of ${projectList.length} on disk`
    : "…";
  return (
    <>
      <Panel title="Server">
        <dl className={common.facts}>
          <Fact label="Version" hint={HINTS["Version"]}>
            v{settings.version}
          </Fact>
          <Fact label="Address" hint={HINTS["Address"]}>
            {server.url ? (
              <a
                className={`${common.link} ${common.clipText}`}
                href={server.url}
                title={
                  server.host != null
                    ? `Listens on ${server.host}:${server.port}`
                    : undefined
                }
              >
                {server.url}
              </a>
            ) : server.host != null ? (
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
          <Fact label="Browser origins" hint={HINTS["Browser origins"]}>
            <ValueList values={server.cors_allowed_origins} mono />
          </Fact>
          <Fact label="Request size" hint={HINTS["Request size"]}>
            Up to {formatBytes(server.max_body_bytes)}
          </Fact>
          <Fact label="Shutdown grace" hint={HINTS["Shutdown grace"]}>
            {formatSpan(server.shutdown_grace_seconds)}
          </Fact>
        </dl>
      </Panel>

      <Panel title="Storage">
        <dl className={common.facts}>
          <Fact label="State folder" hint={HINTS["State folder"]}>
            {state.dir ? <Clip value={state.dir} /> : "Unknown"}
          </Fact>
          <Fact label="Projects folder" hint={HINTS["Projects folder"]}>
            {projects.dir ? <Clip value={projects.dir} /> : "Unknown"}
          </Fact>
          <Fact label="Checkouts" hint={HINTS["Checkouts"]}>
            {checkouts}
          </Fact>
          <Fact label="Config API" hint={HINTS["Config API"]}>
            {onOff(config_api.enabled)}
          </Fact>
        </dl>
      </Panel>

      <SecretsPanel
        secrets={secrets}
        credentialSummary={credentialSummary}
        aside={
          <Link to="/credentials" className={common.link}>
            See every credential
          </Link>
        }
      />
    </>
  );
}

function SignIn({ auth }: { auth: AuthInfo }) {
  const { me, methods, ldap, api_keys } = auth;
  if (me.role !== "admin") return null;
  return (
    <SignInPanels
      ldapOn={methods.ldap}
      ldap={
        ldap && {
          ...ldap,
          access: ldap.access.map((rule) => ({
            ...rule,
            scope: rule.applications,
          })),
        }
      }
      apiKeys={api_keys?.map((key) => ({ ...key, scope: key.applications }))}
      bindAccountLink={(id, className) => (
        <Link
          className={className}
          to={`/credentials/${encodeURIComponent(id)}`}
        >
          {id}
        </Link>
      )}
      ldapDocs="docs/ldap-login.md in unified-gitops"
    />
  );
}
