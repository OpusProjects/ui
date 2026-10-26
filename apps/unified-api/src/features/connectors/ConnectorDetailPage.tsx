import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  ListName,
  ListTable,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  formatSpan,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useConnector } from "../../api/queries";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import { ICONS } from "../../sections";
import {
  BUILT_IN,
  connectorLabels,
  connectorState,
  describe,
  stateDetail,
} from "./model";

type Connector = Schemas["ConnectorInfo"];
type User = Connector["used_by"][number];

// What each fact means, behind its label, starting with its key in the
// connector's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Type: "connector_type. script runs a program that prints the inventory; ssh runs a script on each host over SSH.",
  "Built-in type":
    "A connector every instance has. No item defines it, and a source names it with connector: and its own settings.",
  Reads: "What a source using this connector gathers its data from.",
  Project:
    "project. The git project whose checkout holds the script. None: path is a file on this instance's own disk (in the image, or mounted).",
  Path: "path. The script a sync runs, relative to the project's checkout when it has one. For ssh, the command run on each host.",
  "Script args": "script_args. Arguments passed to the script on every run.",
  "Host args":
    "host_args. Arguments added when a sync asks for named hosts only (an on-demand refresh).",
  "Output format":
    "output_format. native: the script prints this instance's own dataset. ansible: it prints an Ansible inventory, which is converted.",
  Timeout:
    "timeout_seconds. How long one sync may run. A source may set its own; the table below shows the one each source syncs under.",
};

export function ConnectorDetailPage() {
  const { id = "" } = useParams();
  // Admin-only: a restricted key gets the refusal as the page's notice.
  const query = useConnector(id);
  const connector = query.data;

  return (
    <>
      <PageHeader
        icon={ICONS.connectors}
        title={
          <DetailTitle section="Connectors" to="/connectors">
            {id}
          </DetailTitle>
        }
        // The connector's own description; the generic line only without one.
        description={
          (connector && describe(connector)) ??
          "How a kind of system is read, and the sources reading it."
        }
      />
      {query.isPending && <SkeletonSummary />}
      {query.isError && (
        <Notice title="Could not load this connector">
          {query.error.message}
        </Notice>
      )}
      {query.isSuccess && !connector && (
        <EmptyState title="No such connector">
          Nothing called {id} is configured.{" "}
          <Link to="/connectors">See every connector</Link>.
        </EmptyState>
      )}
      {connector && (
        <>
          <Overview connector={connector} />
          <Panel
            title="Sources"
            hint="The sources using this connector: their connector names it. Each syncs under its own timeout when it sets one, the connector's otherwise."
          >
            <UsedBy connector={connector} />
          </Panel>
        </>
      )}
    </>
  );
}

function Overview({ connector }: { connector: Connector }) {
  return (
    <Panel
      title="Overview"
      hint="How this connector gathers a source's data: what it runs, where the script comes from, and how long a sync may take."
      aside={
        <HealthPill
          state={connectorState(connector)}
          labels={connectorLabels(connector)}
          detail={stateDetail(connector)}
        />
      }
    >
      <dl className={common.facts}>
        {connector.built_in ? (
          <>
            <Fact label="Type" hint={HINTS["Built-in type"]}>
              <code className={common.mono}>{connector.connector_type}</code>{" "}
              (built in)
            </Fact>
            <Fact label="Reads" hint={HINTS["Reads"]}>
              {BUILT_IN[connector.connector_id]?.reads ?? "Built in"}
            </Fact>
            <Fact label="Timeout" hint={HINTS["Timeout"]}>
              Each source's own (default {formatSpan(300)})
            </Fact>
          </>
        ) : (
          <ItemFacts connector={connector} />
        )}
      </dl>
    </Panel>
  );
}

function ItemFacts({ connector }: { connector: Connector }) {
  const args = (list: string[]) =>
    list.length > 0 ? (
      <code
        className={`${common.mono} ${common.clipText}`}
        title={list.join(" ")}
      >
        {list.join(" ")}
      </code>
    ) : (
      "None"
    );

  return (
    <>
      <Fact label="Type" hint={HINTS["Type"]}>
        <code className={common.mono}>{connector.connector_type}</code>
      </Fact>
      <Fact label="Project" hint={HINTS["Project"]}>
        {connector.project_id ? (
          <Link
            className={common.link}
            to={`/projects/${encodeURIComponent(connector.project_id)}`}
          >
            {connector.project_id}
          </Link>
        ) : connector.connector_type === "ssh" ? (
          "None (runs on each host)"
        ) : (
          "None (local file)"
        )}
      </Fact>
      <Fact label="Path" hint={HINTS["Path"]}>
        <code
          className={`${common.mono} ${common.clipText}`}
          title={connector.path ?? undefined}
        >
          {connector.path ?? "None"}
        </code>
      </Fact>

      <Fact label="Script args" hint={HINTS["Script args"]}>
        {args(connector.script_args)}
      </Fact>
      <Fact label="Host args" hint={HINTS["Host args"]}>
        {args(connector.host_args)}
      </Fact>
      <Fact label="Output format" hint={HINTS["Output format"]}>
        {connector.output_format ?? "None"}
      </Fact>

      <Fact label="Timeout" hint={HINTS["Timeout"]}>
        {formatSpan(connector.timeout_seconds ?? 300)}
      </Fact>
    </>
  );
}

// A source's state as the connector reports it: enough for this table,
// whose rows link to the source's page for the full story.
const userState = (user: User): HealthState =>
  user.failing ? "failing" : user.synced ? "fresh" : "pending";

const USER_LABELS = { pending: "Not synced yet" };

function UsedBy({ connector }: { connector: Connector }) {
  const columns: ListColumn<User>[] = [
    {
      key: "source",
      label: "Source",
      role: "name",
      title: (u) => u.source_id,
      render: (u) => (
        <ListName
          name={u.name}
          link={(className, children) => (
            <Link
              className={className}
              to={`/sources/${encodeURIComponent(u.source_id)}`}
            >
              {children}
            </Link>
          )}
          id={u.source_id}
        />
      ),
    },
    {
      key: "timeout",
      label: "Timeout",
      render: (u) => formatSpan(u.timeout_seconds),
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: (u) => <HealthPill state={userState(u)} labels={USER_LABELS} />,
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={[...connector.used_by].sort((a, b) =>
        a.source_id.localeCompare(b.source_id),
      )}
      rowKey={(u) => u.source_id}
      empty="No source uses this connector."
      noun="sources"
    />
  );
}
