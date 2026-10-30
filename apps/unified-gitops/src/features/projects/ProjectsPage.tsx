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
        id: p.name,
        title: p.name,
        description: p.description,
        credential: p.credential,
      })}
      pull={pull}
      icon={ICONS.projects}
      description="Git repositories: when one pulls a commit, the APIs, scripts and webhooks watching it act on what changed."
      placeholder="Search by name, description or repository"
      empty="Declare a git repository to watch under projects: in the configuration."
    />
  );
}
