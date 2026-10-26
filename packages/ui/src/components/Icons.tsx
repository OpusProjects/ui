import {
  ChartLine,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  Plug,
  SlidersHorizontal,
} from "lucide-react";

// The icon of each section every unified-* app has, once: the menu and the
// page titles show the same one, so a page is recognisable as the menu item
// it came from, in either app. An app adds its own sections' icons to these.
export const SECTION_ICONS = {
  overview: <LayoutDashboard />,
  connectors: <Plug />,
  projects: <FolderGit2 />,
  credentials: <KeyRound />,
  metrics: <ChartLine />,
  config: <SlidersHorizontal />,
};
