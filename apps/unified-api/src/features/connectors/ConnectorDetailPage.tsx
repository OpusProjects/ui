import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  LinesView,
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
  LOCATION_WORDS,
  commandLines,
  commandSummary,
  describe,
  noProject,
  pathKind,
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
  Path: "path. The script a sync runs, relative to the project's checkout when it has one.",
  Script:
    "script. The script written in the connector, streamed to each host and run there as a file from here would be (shown in full below).",
  Sources:
    "The sources that name this connector, and how many of them failed their last sync. Each is listed below.",
  Location:
    "location. Where what it runs is. A script connector: on this instance. An ssh connector: on this instance (a script, read at each sync and streamed to each host), on each host (files run if executable, read as facts otherwise), or written in the connector (its own script).",
  "On each host":
    "path. On each host: a pattern reads every matching file as a fact (an executable is run, anything else read as JSON or INI, named after its file); a single path is a program run there.",
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
          {pathKind(connector) === "inline" &&
            connector.script &&
            commandLines(connector.script).length > 1 && (
              <Panel
                title="Script"
                hint="script. The script this connector streams to each host and runs there, as written in it."
              >
                <LinesView
                  lines={connector.script.split("\n")}
                  label="Script run on each host"
                />
              </Panel>
            )}
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
        ) : (
          <em className={common.soft} title={noProject(connector).why}>
            {noProject(connector).text}
          </em>
        )}
      </Fact>
      {/* Every item connector says where it runs, so the Overview ends on
          full rows: nine facts for a script connector, six for ssh, which
          has no host args or output format (refused on it). */}
      <Fact label="Location" hint={HINTS["Location"]}>
        {pathKind(connector) === "inline" ? (
          // As Project says it: the script has no place but the connector.
          <em className={common.soft}>Inline script</em>
        ) : (
          LOCATION_WORDS[pathKind(connector)]
        )}
      </Fact>
      {pathKind(connector) === "inline" ? (
        <Fact label="Script" hint={HINTS["Script"]}>
          <code
            className={`${common.mono} ${common.clipText}`}
            title={connector.script ?? undefined}
          >
            {commandSummary(connector.script)}
          </code>
        </Fact>
      ) : pathKind(connector) === "host" ? (
        <Fact label="Runs" hint={HINTS["On each host"]}>
          <code
            className={`${common.mono} ${common.clipText}`}
            title={connector.path ?? undefined}
          >
            {connector.path}
          </code>
        </Fact>
      ) : (
        <Fact label="Path" hint={HINTS["Path"]}>
          <code
            className={`${common.mono} ${common.clipText}`}
            title={connector.path ?? undefined}
          >
            {connector.path ?? "None"}
          </code>
        </Fact>
      )}

      <Fact label="Script args" hint={HINTS["Script args"]}>
        {args(connector.script_args)}
      </Fact>
      {connector.connector_type !== "ssh" && (
        <>
          <Fact label="Host args" hint={HINTS["Host args"]}>
            {args(connector.host_args)}
          </Fact>
          <Fact label="Output format" hint={HINTS["Output format"]}>
            {connector.output_format ?? "None"}
          </Fact>
        </>
      )}

      <Fact label="Timeout" hint={HINTS["Timeout"]}>
        {formatSpan(connector.timeout_seconds ?? 300)}
      </Fact>
      {connector.connector_type !== "ssh" && (
        <Fact label="Sources" hint={HINTS["Sources"]}>
          {sourcesText(connector)}
        </Fact>
      )}
    </>
  );
}

// "2, 1 failing": how many sources use it, and how many of those fail.
function sourcesText(connector: Connector): string {
  const { sources, failing } = connector.health;
  if (sources === 0) return "None";
  return failing > 0 ? `${sources}, ${failing} failing` : String(sources);
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
