import { Link } from "react-router";
import {
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  LiveAge,
  type ListColumn,
} from "@opusprojects/unified-ui";
import { PROJECT_LABELS, taskHealth } from "@opusprojects/unified-client";
import type { Schemas } from "../api/client";
import { useProjects } from "../api/queries";

// A set of projects by name, each with its last pull and its state, and a
// link to its page: a credential's (it pulls with it), a webhook's (it hears
// it). Names the API does not list still get a row.
export function ProjectTable({
  names,
  empty,
}: {
  names: string[];
  empty: string;
}) {
  const projects = useProjects();
  const byName = new Map((projects.data ?? []).map((p) => [p.name, p]));
  type Row = { name: string; project?: Schemas["ProjectInfo"] };
  const rows: Row[] = [...names]
    .sort()
    .map((name) => ({ name, project: byName.get(name) }));
  const none = <ListSoft>–</ListSoft>;
  const columns: ListColumn<Row>[] = [
    {
      key: "name",
      label: "Project",
      role: "name",
      title: (r) => r.name,
      render: (r) => (
        <ListName
          name={r.project?.description ?? r.name}
          id={r.name}
          link={(className, children) => (
            <Link
              className={className}
              to={`/projects/${encodeURIComponent(r.name)}`}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
    {
      key: "pulled",
      label: "Last pull",
      render: (r) =>
        r.project ? (
          <LiveAge
            seconds={r.project.sync_health?.last_success_age_seconds}
            at={projects.dataUpdatedAt}
          />
        ) : (
          none
        ),
    },
    {
      key: "status",
      label: "Status",
      role: "state",
      render: (r) =>
        r.project ? (
          <HealthPill
            state={taskHealth(r.project.sync_health)}
            labels={PROJECT_LABELS}
          />
        ) : (
          none
        ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      // `projects: all` names none until the list arrives: not "none" yet.
      empty={projects.isPending ? "Loading projects…" : empty}
      noun="projects"
    />
  );
}
