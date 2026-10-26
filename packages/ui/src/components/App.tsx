import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { BookOpen, LogOut } from "lucide-react";
import {
  applyStoredTheme,
  useMetricsSampler,
} from "@opusprojects/unified-client";
import { AppShell, RailItem } from "./AppShell";
import { ThemeSwitch } from "./ThemeSwitch";

// One entry of the menu, and the page at its path.
export interface AppSection {
  path: string;
  label: string;
  icon: ReactNode;
  page: ReactNode;
  // Answers only an admin key: left out of a restricted caller's menu rather
  // than shown and refused.
  admin?: boolean;
}

export interface AppDefinition {
  product: string;
  // The mark over the product's name; the app's favicon by default.
  logo?: string;
  // The menu, in order; "/" is home, what the app opens on.
  sections: AppSection[];
  // The pages behind the menu: an item's own page (/sources/:id), old
  // addresses that moved. Anything else goes home.
  routes: ReactNode;
  // The rail's search box: the app's own quick search.
  search: ReactNode;
  // The app's own queries, called as hooks: the running version, and who
  // is signed in (absent until known).
  useVersion: () => string | undefined;
  useMe: () => { role: string; method: string } | null | undefined;
  // Anything the app starts once it is up (a slow page's data, fetched in
  // the background), called as a hook.
  useStart?: () => void;
}

function App({
  product,
  logo = "/favicon.svg",
  sections,
  routes,
  search,
  useVersion,
  useMe,
  useStart,
}: AppDefinition) {
  const location = useLocation();
  const version = useVersion();
  const me = useMe();
  useMetricsSampler();
  useStart?.();
  // Until we know who this is, show the full menu: an admin is the common
  // case, and a menu that grows after a second is worse than one that
  // shrinks for the rare restricted key.
  const admin = !me || me.role === "admin";

  return (
    <AppShell
      product={product}
      logo={logo}
      version={version}
      search={search}
      // The product name is the way home: the Overview.
      homeLink={(content, className) => (
        <Link to="/" className={className}>
          {content}
        </Link>
      )}
      // The sections, then the two ways out (the API's docs, signing out)
      // right after them; only the theme switch stays at the menu's foot.
      nav={
        <>
          {sections
            .filter((section) => admin || !section.admin)
            .map((section) => (
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
          <RailItem
            href="/swagger-ui/"
            target="_blank"
            rel="noreferrer"
            icon={<BookOpen />}
            label="API docs"
          />
          {me && me.method !== "open" && (
            // A plain form post: the service ends the session server side
            // and sends the browser to its sign-in page, which returns here
            // (next) rather than to the API's own pages.
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
        </>
      }
      footer={<ThemeSwitch />}
    >
      <Routes>
        {sections.map((section) => (
          <Route
            key={section.path}
            path={section.path}
            element={section.page}
          />
        ))}
        {routes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

// Starts an app: the theme chosen in this browser before the first paint (a
// page forced to dark must not flash light while the switch mounts), then
// the queries, the router and the shell around the app's pages.
export function startApp(definition: AppDefinition) {
  applyStoredTheme();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
  });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App {...definition} />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
