import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  ListTable,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  formatSpan,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useApplications, useConnectors } from "../../api/queries";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import { connectorLabels, useConnectorState } from "./model";

type Connector = Schemas["ConnectorInfo"];

// What each fact means, behind its label, starting with its key in the
// connector's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Script:
    "path. The executable that answers describe, list and apply. Relative to the project's checkout when it has one.",
  Project:
    "project. The git project whose checkout holds the script. None: path is a file on this instance's own disk (in the image, or mounted).",
  Timeout:
    "timeout_seconds. A call that runs longer is stopped, and the run fails.",
};

export function ConnectorDetailPage() {
  const { name = "" } = useParams();
  // The connector list is admin-only: a restricted key gets the refusal as
  // the page's notice, as on the Connectors page.
  const connectors = useConnectors();
  const connector = connectors.data?.find((p) => p.name === name);

  return (
    <>
      <PageHeader
        icon={ICONS.connectors}
        title={
          <DetailTitle section="Connectors" to="/connectors">
            {name}
          </DetailTitle>
        }
        // The connector's own description; the generic line only without one.
        description={
          connector?.description ??
          "The script that lists and applies one system's objects."
        }
      />
      {connectors.isPending && <SkeletonSummary />}
      {connectors.isError && (
        <Notice title="Could not load this connector">
          {connectors.error.message}
        </Notice>
      )}
      {connectors.isSuccess && !connector && (
        <EmptyState title="No such connector">
          Nothing called {name} is configured.{" "}
          <Link to="/connectors">See every connector</Link>.
        </EmptyState>
      )}
      {connector && (
        <>
          <Overview connector={connector} />
          <Panel
            title="Applications"
            hint="The applications using this connector: their objects are listed and applied through it."
          >
            <UsedBy connector={connector} />
          </Panel>
        </>
      )}
    </>
  );
}

function Overview({ connector }: { connector: Connector }) {
  const state = useConnectorState();

  return (
    <Panel
      title="Overview"
      hint="The script that talks to this kind of system: where it is read from, and how long a call may take."
      aside={
        <HealthPill
          state={state(connector)}
          labels={connectorLabels(connector)}
        />
      }
    >
      <dl className={common.facts}>
        <Fact label="Project" hint={HINTS["Project"]}>
          {connector.project ? (
            <Link
              className={common.link}
              to={`/projects/${encodeURIComponent(connector.project)}`}
            >
              {connector.project}
            </Link>
          ) : (
            "None (local file)"
          )}
        </Fact>
        <Fact label="Script" hint={HINTS["Script"]}>
          <code
            className={`${common.mono} ${common.clipText}`}
            title={connector.path}
          >
            {connector.path}
          </code>
        </Fact>
        <Fact label="Timeout" hint={HINTS["Timeout"]}>
          {formatSpan(connector.timeout_seconds)}
        </Fact>
      </dl>
    </Panel>
  );
}

function UsedBy({ connector }: { connector: Connector }) {
  // The list a restricted key could read too; this page is admin-only, so
  // it holds every application.
  const applications = useApplications();
  if (applications.isPending) return <SkeletonSummary />;
  if (applications.isError)
    return (
      <Notice title="Could not load applications">
        {applications.error.message}
      </Notice>
    );
  const rows = applications.data.filter((a) => a.connector === connector.name);

  return (
    <ListTable
      columns={applicationColumns("folder", applications.dataUpdatedAt)}
      rows={rows.map((app) => ({ name: app.name, app }))}
      rowKey={(r) => r.name}
      empty="No application uses this connector."
      noun="applications"
    />
  );
}
