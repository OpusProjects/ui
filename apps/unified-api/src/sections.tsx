import {
  ChartLine,
  Database,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  Network,
  SlidersHorizontal,
  Waypoints,
} from "lucide-react";

// Each section's icon, once: the menu and the page titles show the same one,
// so a page is recognisable as the menu item it came from.
export const ICONS = {
  overview: <LayoutDashboard />,
  sources: <Database />,
  endpoints: <Waypoints />,
  projects: <FolderGit2 />,
  credentials: <KeyRound />,
  topology: <Network />,
  metrics: <ChartLine />,
  config: <SlidersHorizontal />,
};
