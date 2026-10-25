import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { BookOpen, LogOut } from "lucide-react";
import { AppShell, RailItem, ThemeSwitch } from "@opusprojects/unified-ui";
import {
  applyStoredTheme,
  useMetricsSampler,
} from "@opusprojects/unified-client";
import { HostSearch } from "./shared/HostSearch";
import { ICONS } from "./sections";
import { topologyQuery, useApiIndex, useAuth } from "./api/queries";
import { ConfigPage } from "./features/config/ConfigPage";
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

const SECTIONS = [
  // Home: what the app opens on, after sign-in too when no other page was
  // asked for. Its path is the root, so it is active only there.
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
  },
  {
    path: "/credentials",
    label: "Credentials",
    icon: ICONS.credentials,
    page: <CredentialsPage />,
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
];

function App() {
  const location = useLocation();
  const index = useApiIndex();
  const auth = useAuth();
  useMetricsSampler();
  // The topology is slow to gather (every peer is asked); start it now, in
  // the background, so the page is ready when someone opens it.
  const client = useQueryClient();
  useEffect(() => {
    void client.prefetchQuery(topologyQuery);
  }, [client]);
  const me = auth.data?.me;

  return (
    <AppShell
      product="unified-api"
      version={index.data?.version}
      search={<HostSearch />}
      // The product name is the way home: the Overview.
      homeLink={(content, className) => (
        <Link to="/" className={className}>
          {content}
        </Link>
      )}
      nav={SECTIONS.map((section) => (
        <RailItem
          key={section.path}
          as={Link}
          to={section.path}
          icon={section.icon}
          label={section.label}
          active={
            section.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(section.path)
          }
        />
      ))}
      footer={
        <>
          <RailItem
            href="/swagger-ui/"
            target="_blank"
            rel="noreferrer"
            icon={<BookOpen />}
            label="API docs"
          />
          {me && me.method !== "open" && (
            // A plain form post: unified-api ends the session server side and
            // sends the browser to its sign-in page, which returns here (next)
            // rather than to the API's own pages.
            <form method="post" action="/api/v1/logout">
              <input type="hidden" name="next" value="/" />
              <RailItem
                as="button"
                type="submit"
                icon={<LogOut />}
                label="Sign out"
              />
            </form>
          )}
          <ThemeSwitch />
        </>
      }
    >
      <Routes>
        {SECTIONS.map((section) => (
          <Route
            key={section.path}
            path={section.path}
            element={section.page}
          />
        ))}
        <Route path="/sources/:id" element={<SourceDetailPage />} />
        <Route path="/endpoints/:id" element={<EndpointDetailPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/credentials/:id" element={<CredentialDetailPage />} />
        {/* Where the Users page was: its content is on Configuration. */}
        <Route path="/users" element={<Navigate to="/config" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

// The theme chosen in this browser, before the first paint: a page forced
// to dark must not flash light while the switch mounts.
applyStoredTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
