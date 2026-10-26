import { useNavigate } from "react-router";
import {
  Badge,
  LiveAge,
  SiteSearch,
  quickSearchStyles as styles,
  type SearchSection,
} from "@opusprojects/unified-ui";
import { api, unwrap, type Schemas } from "../api/client";

type Found = Schemas["FoundObject"];

const named = (list: { name: string; description?: string | null }[]) =>
  list.map((item) => ({ id: item.name, title: item.description }));

// What is found by name: everything configured, each opening its page.
const SECTIONS: SearchSection[] = [
  {
    key: "applications",
    label: "Application",
    load: async () => named(unwrap(await api.GET("/api/v1/applications"))),
  },
  {
    key: "connectors",
    label: "Connector",
    load: async () => named(unwrap(await api.GET("/api/v1/connectors"))),
  },
  {
    key: "projects",
    label: "Project",
    load: async () => named(unwrap(await api.GET("/api/v1/projects"))),
  },
  {
    key: "credentials",
    label: "Credential",
    load: async () => named(unwrap(await api.GET("/api/v1/credentials"))),
  },
];

// Whether git declares it, as of the last check; nothing before the first
// check, when neither word would be true.
function GitBadge({ managed }: { managed?: boolean | null }) {
  if (managed == null) return null;
  return managed ? (
    <Badge tone="good">In git</Badge>
  ) : (
    <Badge tone="warning">Not in git</Badge>
  );
}

// The shared search, and, after the names, the objects on every system
// this key may see, by key or value, from the local copies. An object opens
// its application.
export function ObjectSearch() {
  const navigate = useNavigate();
  return (
    <SiteSearch<Found>
      sections={SECTIONS}
      what="objects by key or value"
      deep={{
        search: async (q) =>
          unwrap(
            await api.GET("/api/v1/search", {
              params: { query: { q, limit: 12 } },
            }),
          ),
        // The same key can match in several fields, kinds or applications.
        key: (found) =>
          `${found.application}/${found.kind}/${found.key}/${found.field ?? ""}`,
        open: (found) =>
          navigate(`/applications/${encodeURIComponent(found.application)}`),
        render: (found) => (
          <>
            <span className={styles.nameRow}>
              <span className={styles.name}>{found.key}</span>
              <GitBadge managed={found.managed} />
            </span>
            <span className={styles.detail}>
              {found.kind} in {found.application}, read{" "}
              <LiveAge since={found.written_at} />
              {found.field && `, matched in ${found.field}`}
            </span>
          </>
        ),
      }}
    />
  );
}
