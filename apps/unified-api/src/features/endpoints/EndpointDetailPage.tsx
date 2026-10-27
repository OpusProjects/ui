import { Link, useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import {
  Button,
  EmptyState,
  Fact,
  formatCount,
  formatSpan,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
} from "@opusprojects/unified-ui";
import { ValueList } from "@opusprojects/unified-ui";
import { sum, useMetrics } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useEndpointCounts, useEndpoints } from "../../api/queries";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import { SourceTable } from "../../shared/SourceTable";
import { ENDPOINT_LABELS, endpointState } from "./model";
import { ICONS } from "../../sections";

type Endpoint = Schemas["EndpointInfo"];

const outputUrl = (id: string) => `/api/v1/endpoints/${encodeURIComponent(id)}`;

// What each overview fact means, behind its label. Settings start with
// their key in the endpoint's item file, which is where they are changed.
const HINTS: Record<string, string> = {
  "Sources ready":
    "How many of the sources this endpoint combines have data. Until every one does, a call fails (503) instead of returning part of the inventory.",
  Output:
    "output or script_path. A builtin (ansible, json, csv) runs inside unified-api; a script is a program the sources' data is handed to.",
  Limit:
    "limit.by_hosts_from_inventory. Only the hosts this source lists are kept; the other sources still add their variables and groups to them.",
  Hosts:
    "Hosts a call returns with no parameters of its own, from the sources cached now. A caller's own filters (host, group…) return fewer.",
  Groups:
    "Groups a call returns with no parameters of its own, from the sources cached now.",
  "Average time":
    "How long a call takes on average, since this instance started.",
  Script: "script_path. The transformer the output comes from.",
  Project: "project. The git project that holds the script.",
  Timeout:
    "timeout_seconds. How long the script may run. One that runs longer is stopped and the call fails.",
  Settings:
    "config. The settings the transformer is given, by name; a call may override them with query parameters.",
};

export function EndpointDetailPage() {
  const { id = "" } = useParams();
  const endpoints = useEndpoints();
  const endpoint = endpoints.data?.find((e) => e.endpoint_id === id);

  return (
    <>
      <PageHeader
        icon={ICONS.endpoints}
        title={
          <DetailTitle section="Endpoints" to="/endpoints">
            {id}
          </DetailTitle>
        }
        description={endpoint?.name}
        actions={
          endpoint && (
            <Button
              icon={<ExternalLink />}
              onClick={() => window.open(outputUrl(id), "_blank", "noopener")}
            >
              Open JSON
            </Button>
          )
        }
      />
      {endpoints.isPending && <SkeletonSummary />}
      {endpoints.isError && (
        <Notice title="Could not load this endpoint">
          {endpoints.error.message}
        </Notice>
      )}
      {endpoints.isSuccess && !endpoint && (
        <EmptyState title="No such endpoint">
          Nothing called {id} is configured, or this key may not use it.{" "}
          <Link to="/endpoints">See every endpoint</Link>.
        </EmptyState>
      )}
      {endpoint && (
        <>
          <Overview endpoint={endpoint} />
          <Panel
            title="Sources"
            hint="The sources this endpoint combines, in the order of their ids."
          >
            <SourceTable
              ids={endpoint.source_ids}
              limitedBy={endpoint.transform?.limit_hosts_from}
              empty="This endpoint combines no sources."
            />
          </Panel>
        </>
      )}
    </>
  );
}

function Overview({ endpoint }: { endpoint: Endpoint }) {
  const { scrapes } = useMetrics();
  const samples = scrapes.at(-1)?.samples ?? [];
  const mine = (labels: Record<string, string>) =>
    labels.endpoint === endpoint.endpoint_id;
  const seconds = sum(
    samples,
    "unified_api_endpoint_duration_seconds_sum",
    mine,
  );
  const counted = sum(
    samples,
    "unified_api_endpoint_duration_seconds_count",
    mine,
  );
  const transform = endpoint.transform;
  const total = endpoint.source_ids.length;
  const counts = useEndpointCounts(endpoint.endpoint_id);

  return (
    <Panel
      title="Overview"
      hint="What this endpoint serves, which sources it combines, and how the output is shaped for its consumers."
      aside={
        <HealthPill state={endpointState(endpoint)} labels={ENDPOINT_LABELS} />
      }
    >
      {/* Rows of three: how big its answer is (and whether it can be
          given), how it is made, and (for a script) how the script runs. */}
      <dl className={common.facts}>
        <Fact label="Hosts" hint={HINTS["Hosts"]}>
          {countText(counts.data, counts.data?.hosts)}
        </Fact>
        <Fact label="Groups" hint={HINTS["Groups"]}>
          {countText(counts.data, counts.data?.groups)}
        </Fact>
        <Fact label="Sources ready" hint={HINTS["Sources ready"]}>
          {formatCount(endpoint.sources_ready)} of {formatCount(total)}
        </Fact>
        {transform && (
          <>
            <Fact label="Output" hint={HINTS["Output"]}>
              {transform.output ?? "script"}
            </Fact>
            <Fact label="Limit" hint={HINTS["Limit"]}>
              {transform.limit_hosts_from ? (
                <span className={common.clipText}>
                  hosts of{" "}
                  <Link
                    className={common.link}
                    to={`/sources/${encodeURIComponent(transform.limit_hosts_from)}`}
                  >
                    {transform.limit_hosts_from}
                  </Link>
                </span>
              ) : (
                "None"
              )}
            </Fact>
          </>
        )}
        <Fact label="Average time" hint={HINTS["Average time"]}>
          {counted > 0 ? formatSeconds(seconds / counted) : "No runs yet"}
        </Fact>

        {transform?.script_path && (
          <>
            <Fact label="Script" hint={HINTS["Script"]}>
              <span className={common.clipText} title={transform.script_path}>
                {transform.script_path}
              </span>
            </Fact>
            <Fact label="Project" hint={HINTS["Project"]}>
              {transform.project_id ? (
                <Link
                  className={common.link}
                  to={`/projects/${encodeURIComponent(transform.project_id)}`}
                >
                  {transform.project_id}
                </Link>
              ) : (
                "None"
              )}
            </Fact>
            <Fact label="Timeout" hint={HINTS["Timeout"]}>
              {transform.timeout_seconds != null
                ? formatSpan(transform.timeout_seconds)
                : "None"}
            </Fact>
          </>
        )}
        {transform && transform.config_keys.length > 0 && (
          <Fact label="Settings" hint={HINTS["Settings"]}>
            <ValueList values={transform.config_keys} mono />
          </Fact>
        )}
      </dl>
      {endpoint.sources_missing.length > 0 && (
        <p className={common.error}>
          No data yet from {endpoint.sources_missing.join(", ")}, so every call
          fails until{" "}
          {endpoint.sources_missing.length === 1 ? "it syncs" : "they sync"}.
        </p>
      )}
    </Panel>
  );
}

// A script's output is its own business: the API counts only what a builtin
// returns, and says so with a null rather than a wrong number. Nor is there
// anything to count while a source is missing: a call would fail.
function countText(
  counts: { hosts?: number | null; missing_sources: string[] } | undefined,
  value: number | null | undefined,
) {
  if (!counts) return "…";
  if (counts.missing_sources.length > 0) return "Unavailable";
  return value == null ? "Depends on the script" : formatCount(value);
}

// Milliseconds below a second, where most builtin runs land.
function formatSeconds(value: number) {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(1)} s`;
}
