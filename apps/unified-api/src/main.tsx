import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route } from "react-router";
import { startApp } from "@opusprojects/unified-ui";
import { HostSearch } from "./shared/HostSearch";
import { ICONS } from "./sections";
import { topologyQuery, useApiIndex, useAuth } from "./api/queries";
import { ConfigPage } from "./features/config/ConfigPage";
import { ConnectorDetailPage } from "./features/connectors/ConnectorDetailPage";
import { ConnectorsPage } from "./features/connectors/ConnectorsPage";
import { CredentialDetailPage } from "./features/credentials/CredentialDetailPage";
import { CredentialsPage } from "./features/credentials/CredentialsPage";
import { EndpointDetailPage } from "./features/endpoints/EndpointDetailPage";
import { EndpointsPage } from "./features/endpoints/EndpointsPage";
import { MetricsPage } from "./features/metrics/MetricsPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { ProjectDetailPage } from "./features/projects/ProjectDetailPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { SourceDetailPage } from "./features/sources/SourceDetailPage";
import { SourcesPage } from "./features/sources/SourcesPage";
import { TopologyPage } from "./features/topology/TopologyPage";
import "@opusprojects/unified-ui/style.css";

startApp({
  product: "unified-api",
  sections: [
    {
      path: "/",
      label: "Overview",
      icon: ICONS.overview,
      page: <OverviewPage />,
    },
    {
      path: "/sources",
      label: "Sources",
      icon: ICONS.sources,
      page: <SourcesPage />,
    },
    {
      path: "/connectors",
      label: "Connectors",
      icon: ICONS.connectors,
      page: <ConnectorsPage />,
      admin: true,
    },
    {
      path: "/endpoints",
      label: "Endpoints",
      icon: ICONS.endpoints,
      page: <EndpointsPage />,
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
      path: "/topology",
      label: "Topology",
      icon: ICONS.topology,
      page: <TopologyPage />,
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
      <Route path="/sources/:id" element={<SourceDetailPage />} />
      <Route path="/connectors/:id" element={<ConnectorDetailPage />} />
      <Route path="/endpoints/:id" element={<EndpointDetailPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/credentials/:id" element={<CredentialDetailPage />} />
      {/* Where the Users page was: its content is on Configuration. */}
      <Route path="/users" element={<Navigate to="/config" replace />} />
    </>
  ),
  search: <HostSearch />,
  useVersion: () => useApiIndex().data?.version,
  useMe: () => useAuth().data?.me,
  // The topology is slow to gather (every peer is asked); start it now, in
  // the background, so the page is ready when someone opens it.
  useStart: () => {
    const client = useQueryClient();
    useEffect(() => {
      void client.prefetchQuery(topologyQuery);
    }, [client]);
  },
});
