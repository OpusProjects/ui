import { Route } from "react-router";
import { startApp } from "@opusprojects/unified-ui";
import { NameSearch } from "./shared/NameSearch";
import { ICONS } from "./sections";
import { useApiIndex, useAuth } from "./api/queries";
import { ApiDetailPage } from "./features/apis/ApiDetailPage";
import { ApisPage } from "./features/apis/ApisPage";
import { ConfigPage } from "./features/config/ConfigPage";
import { CredentialsPage } from "./features/credentials/CredentialsPage";
import { CredentialDetailPage } from "./features/credentials/CredentialDetailPage";
import { MetricsPage } from "./features/metrics/MetricsPage";
import { WebhookDetailPage } from "./features/webhooks/WebhookDetailPage";
import { WebhooksPage } from "./features/webhooks/WebhooksPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { ProjectDetailPage } from "./features/projects/ProjectDetailPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ScriptDetailPage } from "./features/scripts/ScriptDetailPage";
import { ScriptsPage } from "./features/scripts/ScriptsPage";
import "@opusprojects/unified-ui/style.css";

startApp({
  product: "unified-gitops",
  sections: [
    {
      path: "/",
      label: "Overview",
      icon: ICONS.overview,
      page: <OverviewPage />,
    },
    {
      path: "/apis",
      label: "APIs",
      icon: ICONS.apis,
      page: <ApisPage />,
    },
    {
      path: "/scripts",
      label: "Scripts",
      icon: ICONS.scripts,
      page: <ScriptsPage />,
    },
    {
      path: "/webhooks",
      label: "Webhooks",
      icon: ICONS.webhooks,
      page: <WebhooksPage />,
      admin: true,
    },
    {
      path: "/projects",
      label: "Projects",
      icon: ICONS.projects,
      page: <ProjectsPage />,
    },
    {
      path: "/credentials",
      label: "Credentials",
      icon: ICONS.credentials,
      page: <CredentialsPage />,
      admin: true,
    },
    {
      path: "/metrics",
      label: "Metrics",
      icon: ICONS.metrics,
      page: <MetricsPage />,
    },
    {
      path: "/config",
      label: "Configuration",
      icon: ICONS.config,
      page: <ConfigPage />,
    },
  ],
  routes: (
    <>
      <Route path="/apis/:name" element={<ApiDetailPage />} />
      <Route path="/scripts/:name" element={<ScriptDetailPage />} />
      <Route path="/projects/:name" element={<ProjectDetailPage />} />
      <Route path="/credentials/:name" element={<CredentialDetailPage />} />
      <Route path="/webhooks/:name" element={<WebhookDetailPage />} />
    </>
  ),
  search: <NameSearch />,
  useVersion: () => useApiIndex().data?.version,
  useMe: () => useAuth().data?.me,
});
