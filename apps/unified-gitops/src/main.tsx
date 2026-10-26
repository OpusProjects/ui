import { Route } from "react-router";
import { startApp } from "@opusprojects/unified-ui";
import { ObjectSearch } from "./shared/ObjectSearch";
import { ICONS } from "./sections";
import { useApiIndex, useAuth } from "./api/queries";
import { ApplicationDetailPage } from "./features/applications/ApplicationDetailPage";
import { ApplicationsPage } from "./features/applications/ApplicationsPage";
import { ConfigPage } from "./features/config/ConfigPage";
import { CredentialsPage } from "./features/credentials/CredentialsPage";
import { CredentialDetailPage } from "./features/credentials/CredentialDetailPage";
import { MetricsPage } from "./features/metrics/MetricsPage";
import { NotificationDetailPage } from "./features/notifications/NotificationDetailPage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { ConnectorDetailPage } from "./features/connectors/ConnectorDetailPage";
import { ConnectorsPage } from "./features/connectors/ConnectorsPage";
import { ProjectDetailPage } from "./features/projects/ProjectDetailPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
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
      path: "/applications",
      label: "Applications",
      icon: ICONS.applications,
      page: <ApplicationsPage />,
    },
    {
      path: "/connectors",
      label: "Connectors",
      icon: ICONS.connectors,
      page: <ConnectorsPage />,
      admin: true,
    },
    {
      path: "/projects",
      label: "Projects",
      icon: ICONS.projects,
      page: <ProjectsPage />,
      admin: true,
    },
    {
      path: "/credentials",
      label: "Credentials",
      icon: ICONS.credentials,
      page: <CredentialsPage />,
      admin: true,
    },
    {
      path: "/notifications",
      label: "Notifications",
      icon: ICONS.notifications,
      page: <NotificationsPage />,
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
      <Route path="/applications/:id" element={<ApplicationDetailPage />} />
      <Route path="/connectors/:name" element={<ConnectorDetailPage />} />
      <Route path="/projects/:name" element={<ProjectDetailPage />} />
      <Route path="/credentials/:name" element={<CredentialDetailPage />} />
      <Route path="/notifications/:name" element={<NotificationDetailPage />} />
    </>
  ),
  search: <ObjectSearch />,
  useVersion: () => useApiIndex().data?.version,
  useMe: () => useAuth().data?.me,
});
