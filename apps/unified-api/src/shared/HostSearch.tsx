import { useNavigate } from "react-router";
import {
  SiteSearch,
  formatAge,
  quickSearchStyles as styles,
  type SearchSection,
} from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../api/client";

type Found = Schemas["FoundHost"];

// What is found by name: everything configured, each opening its page, by
// its id (what URLs and references use) or its label.
const SECTIONS: SearchSection[] = [
  {
    key: "sources",
    label: "Source",
    load: async () =>
      unwrap(await api.GET("/api/v1/sources")).map((s) => ({
        id: s.source_id,
      })),
  },
  {
    key: "connectors",
    label: "Connector",
    load: async () =>
      unwrap(await api.GET("/api/v1/connectors")).map((c) => ({
        id: c.connector_id,
        title: c.name,
      })),
  },
  {
    key: "endpoints",
    label: "Endpoint",
    load: async () =>
      unwrap(await api.GET("/api/v1/endpoints")).map((e) => ({
        id: e.endpoint_id,
        title: e.name,
      })),
  },
  {
    key: "projects",
    label: "Project",
    load: async () =>
      unwrap(await api.GET("/api/v1/projects")).map((p) => ({
        id: p.project_id,
        title: p.name,
      })),
  },
  {
    key: "credentials",
    label: "Credential",
    load: async () =>
      unwrap(await api.GET("/api/v1/credentials")).map((c) => ({
        id: c.credential_id,
        title: c.name,
      })),
  },
];

// The shared search, and, after the names, hosts in every source's cache.
// A host opens on the first source that holds it, selected in its list.
export function HostSearch() {
  const navigate = useNavigate();
  return (
    <SiteSearch<Found>
      sections={SECTIONS}
      what="hosts by name"
      deep={{
        search: async (q) =>
          unwrap(
            await api.GET("/api/v1/hosts/search", {
              params: { query: { q, limit: 12 } },
            }),
          ).hosts,
        key: (found) => found.host,
        open: (found) => {
          const source = found.sources[0]?.source_id;
          if (source)
            navigate(
              `/sources/${encodeURIComponent(source)}?host=${encodeURIComponent(found.host)}`,
            );
        },
        render: (found) => (
          <>
            <span className={styles.name}>{found.host}</span>
            <span className={styles.detail}>
              In{" "}
              {found.sources
                .map((s) => `${s.source_id} (${formatAge(s.age_seconds)})`)
                .join(", ")}
              {found.endpoints.length > 0 &&
                `; reaches ${found.endpoints.join(", ")}`}
            </span>
          </>
        ),
      }}
    />
  );
}
