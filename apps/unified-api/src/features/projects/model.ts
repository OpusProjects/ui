import { PROJECT_LABELS } from "@opusprojects/unified-client";
import { api, unwrap } from "../../api/client";

// How projects are judged and shown: the shared helpers, so a card, the
// project's page and the overview never disagree.
export { PROJECT_LABELS };
export { projectState } from "@opusprojects/unified-ui";
export {
  repositoryName,
  repositoryPage,
  withoutCredentials,
} from "@opusprojects/unified-client";

// Pulls one project now: the list's cards and the project's page share it.
export const pull = async (id: string) =>
  unwrap(
    await api.POST("/api/v1/projects/{id}/sync", {
      params: { path: { id } },
    }),
  );
