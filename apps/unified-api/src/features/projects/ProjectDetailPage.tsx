import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  formatAge,
  formatEvery,
  formatSpan,
} from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../../api/client";
import { useEndpoints, useProjects } from "../../api/queries";
import { DetailTitle, common } from "../../shared/Detail";
import { RunButton } from "../../shared/RunButton";
import { SourceTable } from "../../shared/SourceTable";
import { ENDPOINT_LABELS, endpointState } from "../endpoints/model";
import {
  PROJECT_LABELS,
  projectState,
  repositoryName,
  repositoryPage,
  withoutCredentials,
} from "./model";
import { ICONS } from "../../sections";

type Project = Schemas["ProjectInfo"];

// What each overview fact means, behind its label. Settings start with
// their key in projects.yaml, which is where they are changed.
const HINTS: Record<string, string> = {
  Repository:
    "git_url. Where the project is cloned from; opens the repository's page when its address has one.",
  Branch: "branch. The branch the checkout follows.",
  Checkout:
    "Whether a clone of the project is on this instance's disk. Scripts are read from it, so without one they cannot run.",
  "Last attempt":
    "When this project was last pulled, whether it worked or not.",
  "Last success":
    "When a pull last worked: the checkout is at most this old. Recent attempts with an old success mean pulls are failing and the scripts are running from an old commit.",
  "Failures in a row":
    "Pulls that have failed since the last one that worked. Zero when the last pull worked.",
  "Pull interval":
    "sync_interval_seconds. How often the project is pulled. None means only at start-up (with sync_on_boot) or on demand.",
  Schedule:
    "schedule. A cron expression (UTC) for when the project is pulled, used instead of an interval.",
  "Pull on start":
    "sync_on_boot. Whether this instance pulls the project when it starts.",
  Timeout:
    "timeout_seconds. How long one clone or pull may take. One that takes longer is stopped and counts as failed.",
};

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const projects = useProjects();
  const project = projects.data?.find((p) => p.project_id === id);

  return (
    <>
      <PageHeader
        icon={ICONS.projects}
        title={
          <DetailTitle section="Projects" to="/projects">
            {id}
          </DetailTitle>
        }
        description={project?.name}
        actions={
          project && (
            // Keyed by the project: a pull still running must not show on
            // the next project's page.
            <RunButton
              key={id}
              label="Pull now"
              busyLabel="Pulling…"
              invalidate={[["projects"]]}
              run={async () => {
                const result = unwrap(
                  await api.POST("/api/v1/projects/{id}/sync", {
                    params: { path: { id } },
                  }),
                );
                return result.success
                  ? { ok: true, message: "Pulled" }
                  : { ok: false, message: "Pull failed" };
              }}
            />
          )
        }
      />
      {projects.isPending && <SkeletonSummary />}
      {projects.isError && (
        <Notice title="Could not load this project">
          {projects.error.message}
        </Notice>
      )}
      {projects.isSuccess && !project && (
        <EmptyState title="No such project">
          Nothing called {id} is configured.{" "}
          <Link to="/projects">See every project</Link>.
        </EmptyState>
      )}
      {project && (
        <>
          <Overview project={project} />
          <Panel
            title="Sources using it"
            hint="Sources whose project_id names this project: their scripts are read from its checkout."
          >
            <SourceTable
              ids={project.used_by.sources}
              empty="No source uses this project."
            />
          </Panel>
          {project.used_by.endpoints.length > 0 && (
            <Panel
              title="Endpoints using it"
              hint="Endpoints whose project_id names this project: their transformer script is read from its checkout."
            >
              <EndpointList ids={project.used_by.endpoints} />
            </Panel>
          )}
        </>
      )}
    </>
  );
}

function Overview({ project }: { project: Project }) {
  const health = project.sync_health;
  const failures = health?.consecutive_failures ?? 0;
  const page = repositoryPage(project.git_url);
  const repository = repositoryName(project.git_url);
  const address = withoutCredentials(project.git_url);

  return (
    <Panel
      title="Overview"
      aside={
        <HealthPill
          state={projectState(project)}
          labels={PROJECT_LABELS}
          detail={failures > 1 ? `${failures} in a row` : undefined}
        />
      }
    >
      {/* Three rows of three: where it comes from, how pulls are going, and
          how it is pulled. */}
      <dl className={common.facts}>
        <Fact label="Repository" hint={HINTS["Repository"]}>
          {page ? (
            <a
              className={common.link}
              href={page}
              target="_blank"
              rel="noreferrer"
              title={address}
            >
              {repository}
            </a>
          ) : (
            <span className={common.clipText} title={address}>
              {repository}
            </span>
          )}
        </Fact>
        <Fact label="Branch" hint={HINTS["Branch"]}>
          {project.branch}
        </Fact>
        <Fact label="Checkout" hint={HINTS["Checkout"]}>
          {project.checkout_present ? "On disk" : "Not on disk"}
        </Fact>

        <Fact label="Last attempt" hint={HINTS["Last attempt"]}>
          {formatAge(health?.last_attempt_age_seconds)}
        </Fact>
        <Fact label="Last success" hint={HINTS["Last success"]}>
          {health?.last_success_age_seconds != null
            ? formatAge(health.last_success_age_seconds)
            : "Never"}
        </Fact>
        <Fact label="Failures in a row" hint={HINTS["Failures in a row"]}>
          {failures}
        </Fact>

        {project.schedule ? (
          <Fact label="Schedule" hint={HINTS["Schedule"]}>
            <code className={common.mono}>{project.schedule}</code>
          </Fact>
        ) : (
          <Fact label="Pull interval" hint={HINTS["Pull interval"]}>
            {formatEvery(project.sync_interval_seconds) ?? "None"}
          </Fact>
        )}
        <Fact label="Pull on start" hint={HINTS["Pull on start"]}>
          {project.sync_on_boot ? "Yes" : "No"}
        </Fact>
        <Fact label="Timeout" hint={HINTS["Timeout"]}>
          {formatSpan(project.timeout_seconds)}
        </Fact>
      </dl>
      {health?.last_error && (
        <p className={common.error}>{health.last_error}</p>
      )}
    </Panel>
  );
}

// Endpoints by name, each with its state and a link to its page.
function EndpointList({ ids }: { ids: string[] }) {
  const endpoints = useEndpoints();
  if (ids.length === 0) return null;
  const byId = new Map((endpoints.data ?? []).map((e) => [e.endpoint_id, e]));
  return (
    <ul className={common.itemList}>
      {[...ids].sort().map((id) => {
        const endpoint = byId.get(id);
        return (
          <li key={id}>
            <Link
              to={`/endpoints/${encodeURIComponent(id)}`}
              className={common.itemName}
            >
              {endpoint?.name ?? id}
            </Link>
            <code className={common.itemId}>{id}</code>
            {endpoint && (
              <HealthPill
                state={endpointState(endpoint)}
                labels={ENDPOINT_LABELS}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
