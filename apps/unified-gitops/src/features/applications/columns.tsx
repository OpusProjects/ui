import { Link } from "react-router";
import {
  HealthPill,
  ListName,
  ListSoft,
  LiveAge,
  detailStyles as common,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { appLabels, appState, pending } from "./model";

// A row of a table of applications on another item's page: the name it is
// referenced by, and the application when it is known (a name the list
// does not have yet shows dashes rather than nothing).
export type ApplicationRow = {
  name: string;
  app?: Schemas["ApplicationSummary"];
};

// The one column the page adds, between the name and the rest: what the
// application means to THAT page's item (the folder in a project, the
// connector a credential is handed to).
export type ApplicationContext = "folder" | "connector";

// Every table of applications, alike: Application · context · To apply ·
// Last check · Status. What is waiting and how recently it was looked at
// are the questions on any page; only the context column changes.
export function applicationColumns(
  context?: ApplicationContext,
): ListColumn<ApplicationRow>[] {
  const none = <ListSoft>–</ListSoft>;
  const columns: ListColumn<ApplicationRow>[] = [
    {
      key: "name",
      label: "Application",
      role: "name",
      title: (r) => r.name,
      render: (r) => (
        <ListName
          name={r.app?.description ?? r.name}
          id={r.name}
          link={(className, children) => (
            <Link
              className={className}
              to={`/applications/${encodeURIComponent(r.name)}`}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
  ];
  if (context === "folder")
    columns.push({
      key: "path",
      label: "Folder",
      render: (r) =>
        r.app ? <code className={common.mono}>{r.app.path}</code> : none,
    });
  if (context === "connector")
    columns.push({
      key: "connector",
      label: "Connector",
      render: (r) =>
        r.app ? (
          <Link
            className={common.link}
            to={`/connectors/${encodeURIComponent(r.app.connector)}`}
          >
            {r.app.connector}
          </Link>
        ) : (
          none
        ),
    });
  columns.push(
    {
      key: "pending",
      label: "To apply",
      render: (r) => (r.app ? pending(r.app) : none),
    },
    {
      key: "checked",
      label: "Last check",
      render: (r) =>
        r.app ? <LiveAge seconds={r.app.last_checked_age_seconds} /> : none,
    },
    {
      key: "status",
      label: "Status",
      role: "state",
      render: (r) =>
        r.app ? (
          <HealthPill state={appState(r.app)} labels={appLabels(r.app)} />
        ) : (
          none
        ),
    },
  );
  return columns;
}
