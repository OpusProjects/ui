import { ProjectsPage as Page } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useProjects } from "../../api/queries";
import { ICONS } from "../../sections";
import { pull } from "./model";

type Project = Schemas["ProjectInfo"];

export function ProjectsPage() {
  return (
    <Page
      query={useProjects()}
      view={(p: Project) => ({
        id: p.project_id,
        title: p.name,
        idTag: p.project_id,
        credential: p.credential_id,
      })}
      pull={pull}
      icon={ICONS.projects}
      description="Git repositories holding the scripts the sources run."
      placeholder="Search by name, id or repository"
      empty="Declare one under projects: in the configuration when your scripts live in their own repository."
    />
  );
}
