import { SiteSearch, type SearchSection } from "@opusprojects/unified-ui";
import { api, unwrap } from "../api/client";

const named = (list: { name: string; description?: string | null }[]) =>
  list.map((item) => ({ id: item.name, title: item.description }));

// What is found by name: everything configured, each opening its page. A
// list this key may not read (webhooks, credentials for a restricted key)
// is left out.
const SECTIONS: SearchSection[] = [
  {
    key: "apis",
    label: "API",
    load: async () => named(unwrap(await api.GET("/api/v1/apis"))),
  },
  {
    key: "scripts",
    label: "Script",
    load: async () => named(unwrap(await api.GET("/api/v1/scripts"))),
  },
  {
    key: "webhooks",
    label: "Webhook",
    load: async () => named(unwrap(await api.GET("/api/v1/webhooks"))),
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

export function NameSearch() {
  return <SiteSearch sections={SECTIONS} />;
}
