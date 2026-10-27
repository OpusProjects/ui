import { Link } from "react-router";
import {
  EmptyState,
  Fact,
  formatBytes,
  formatCount,
  formatSpan,
  LiveAge,
  Notice,
  PageHeader,
  Panel,
  SecretsPanel,
  SignInPanels,
  SkeletonSummary,
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
    "server.url: where people reach this instance, the address it is known by. Unset: server.host and server.port, where the process listens (restart-only).",
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
          {settings.data && (
            <ServerPanels
              settings={settings.data}
              at={settings.dataUpdatedAt}
            />
          )}
          <SignIn auth={auth.data} />
        </>
      )}
    </>
  );
}

function ServerPanels({
  settings,
  at,
}: {
  settings: Settings;
  // When the settings were fetched: the last save restarts on every answer.
  at: number;
}) {
  const { server, cache, projects, secrets, config_api } = settings;
  const projectList = useProjects().data;
  const credentialList = useCredentials().data;
  const missing = credentialList?.filter((c) => !c.resolves).length ?? 0;
  const credentialSummary = !credentialList
    ? "…"
    : missing > 0
      ? `${formatCount(missing)} of ${formatCount(credentialList.length)} missing`
      : `${formatCount(credentialList.length)}, all working`;
  const checkouts = projectList
    ? `${formatCount(projectList.filter((p) => p.checkout_present).length)} of ${formatCount(projectList.length)} on disk`
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

          <Fact label="Readiness" hint={HINTS["Readiness"]}>
            {server.readyz_require_all_sources
              ? "Every source synced"
              : "Any source synced"}
          </Fact>
          <Fact label="Browser origins" hint={HINTS["Browser origins"]}>
            <ValueList values={server.cors_allowed_origins} mono />
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
              <Clip value={cache.persistence_path} />
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
            {cache.persistence_path == null ? (
              "Never"
            ) : cache.consecutive_failures > 0 ? (
              `Failing, ${formatCount(cache.consecutive_failures)} in a row`
            ) : cache.last_saved_age_seconds != null ? (
              <LiveAge seconds={cache.last_saved_age_seconds} at={at} />
            ) : (
              "Not yet"
            )}
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
            scope: [...rule.sources, ...rule.endpoints],
          })),
        }
      }
      apiKeys={api_keys?.map((key) => ({
        ...key,
        scope: [...key.sources, ...key.endpoints],
      }))}
      bindAccountLink={(id, className) => (
        <Link
          className={className}
          to={`/credentials/${encodeURIComponent(id)}`}
        >
          {id}
        </Link>
      )}
      ldapDocs="docs/ldap-login.md in unified-api"
    />
  );
}
