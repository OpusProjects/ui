import { Database, Network, Waypoints } from "lucide-react";
import { SECTION_ICONS } from "@opusprojects/unified-ui";

// Each section's icon: the shared ones, and this app's own.
export const ICONS = {
  ...SECTION_ICONS,
  sources: <Database />,
  endpoints: <Waypoints />,
  topology: <Network />,
};
