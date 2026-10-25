import {
  CardGrid,
  EmptyState,
  Fact,
  HealthSummary,
  Notice,
  PageHeader,
  ResourceCard,
  SkeletonGrid,
  SkeletonSummary,
  formatAge,
  formatEvery,
  useRememberedCount,
} from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../../api/client";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { useProjects } from "../../api/queries";
import {
  PROJECT_LABELS,
  projectState,
  repositoryName,
  repositoryPage,
  withoutCredentials,
} from "./model";
import { RunButton } from "../../shared/RunButton";
import { ListToolbar } from "../../shared/ListToolbar";
import { RunAllButton } from "../../shared/RunAllButton";
import { useListFilter } from "../../shared/useListFilter";
import { ICONS } from "../../sections";
import styles from "../../shared/pages.module.css";

type Project = Schemas["ProjectInfo"];

const searchText = (project: Project) =>
  `${project.project_id} ${project.name} ${withoutCredentials(project.git_url)}`;

export function ProjectsPage() {
  const projects = useProjects();
  const items = projects.data ?? [];
  const filter = useListFilter(items, projectState, searchText);
  const remembered = useRememberedCount(
    "projects",
    projects.isSuccess ? projects.data?.length : undefined,
  );

  return (
    <>
      <PageHeader
        icon={ICONS.projects}
        title="Projects"
        description="Git repositories holding the scripts the sources run."
      />
      {projects.isPending && (
        <>
          <SkeletonSummary />
          <SkeletonGrid expected={remembered} />
        </>
      )}
      {projects.isError && (
        <Notice title="Could not load projects">
          {projects.error.message}
        </Notice>
      )}
      {projects.isSuccess && (
        <>
          <HealthSummary
            counts={filter.counts}
            noun={["project", "projects"]}
            labels={PROJECT_LABELS}
            selected={filter.selected}
            onSelect={filter.setSelected}
            showAll={false}
          />
          <ListToolbar
            filter={filter}
            label="Search projects"
            placeholder="Search by name, id or repository"
          >
            <RunAllButton
              ids={filter.visible.map((p) => p.project_id)}
              filtered={filter.visible.length !== items.length}
              words={{
                verb: "Pull",
                busy: "Pulling…",
                done: "pulled",
                noun: ["project", "projects"],
              }}
              invalidate={[["projects"]]}
              run={async (id) =>
                unwrap(
                  await api.POST("/api/v1/projects/{id}/sync", {
                    params: { path: { id } },
                  }),
                ).success
              }
            />
          </ListToolbar>
          {filter.visible.length === 0 ? (
            <EmptyState
              title={
                items.length === 0
                  ? "No projects configured"
                  : "No projects match"
              }
            >
              {items.length === 0
                ? "Declare a git project in projects.yaml when your scripts live in their own repository."
                : "Clear the search or the filter to see every project."}
            </EmptyState>
          ) : (
            <CardGrid>
              {filter.visible.map((project) => (
                <ResourceCard
                  key={project.project_id}
                  title={project.name}
                  id={project.project_id}
                  state={projectState(project)}
                  labels={PROJECT_LABELS}
                  error={project.sync_health?.last_error}
                  titleLink={(title, className) => (
                    <Link
                      to={`/projects/${encodeURIComponent(project.project_id)}`}
                      className={className}
                    >
                      {title}
                    </Link>
                  )}
                  footer={
                    <>
                      {repositoryPage(project.git_url) && (
                        <a
                          className={styles.link}
                          href={repositoryPage(project.git_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open repository
                          <ExternalLink aria-hidden />
                        </a>
                      )}
                      <RunButton
                        label="Pull now"
                        busyLabel="Pulling…"
                        invalidate={[["projects"]]}
                        run={async () => {
                          const result = unwrap(
                            await api.POST("/api/v1/projects/{id}/sync", {
                              params: { path: { id: project.project_id } },
                            }),
                          );
                          return result.success
                            ? { ok: true, message: "Pulled" }
                            : { ok: false, message: "Pull failed" };
                        }}
                      />
                    </>
                  }
                >
                  <Fact label="Repository">
                    <code
                      className={styles.mono}
                      title={withoutCredentials(project.git_url)}
                    >
                      {repositoryName(project.git_url)}
                    </code>
                  </Fact>
                  <Fact label="Branch">
                    <code className={styles.mono}>{project.branch}</code>
                  </Fact>
                  <Fact label="Last pull">
                    {formatAge(project.sync_health?.last_success_age_seconds)}
                  </Fact>
                  {project.sync_interval_seconds != null && (
                    <Fact label="Pulls">
                      {formatEvery(project.sync_interval_seconds)}
                    </Fact>
                  )}
                  <Fact label="Checkout">
                    {project.checkout_present ? (
                      "On disk"
                    ) : (
                      <span className={styles.soft}>Not on disk</span>
                    )}
                  </Fact>
                </ResourceCard>
              ))}
            </CardGrid>
          )}
        </>
      )}
    </>
  );
}
