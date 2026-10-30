import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  DetailTitle,
  EmptyState,
  Fact,
  HealthPill,
  Notice,
  PageHeader,
  Panel,
  SkeletonSummary,
  ValueList,
  detailStyles as common,
} from "@opusprojects/unified-ui";
import { ApiError } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";
import { useApi } from "../../api/queries";
import { ICONS } from "../../sections";
import { RunActions, RunHistory, RunResult } from "../../shared/Runs";
import {
  LimitFacts,
  TriggerFacts,
  credentialLinks,
} from "../../shared/ActionFacts";
import {
  actionLabels,
  actionState,
  authText,
  runsByHand,
  type Run,
} from "../../shared/runs";
import { PER_WORDS, flowWords } from "./model";

type Api = Schemas["ApiSummary"];

// What each of its own facts means, behind its label, starting with its key
// in the item's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Calls:
    "api.url and api.method. The method, and the receiver's scheme and host: its path and query, which can carry a secret, are in the configuration only.",
  Requests:
    "api.per. file: one request per changed file, its contents as the body. commit: one request for the whole commit.",
  Flow: "api.compare, api.upsert and api.on_delete. Whether it reads the live object first and sends only a difference, creates or updates as the object exists, and deletes it when its file goes.",
  Authentication:
    "api.auth. How the credential is sent: a bearer token, basic authentication, a header or query parameter of its own, OAuth 2, or a login request first.",
  Credentials:
    "credential, and those its auth reads. Where the secrets it sends come from; never their values.",
};

export function ApiDetailPage() {
  const { name = "" } = useParams();
  const query = useApi(name);
  const missing = query.error instanceof ApiError && query.error.status === 404;
  const item = missing ? undefined : query.data;
  // The run a button here just started, shown whole until closed.
  const [result, setResult] = useState<{ name: string; run: Run } | null>(null);
  const shown = result?.name === name ? result.run : null;

  return (
    <>
      <PageHeader
        icon={ICONS.apis}
        title={
          <DetailTitle section="APIs" to="/apis">
            {name}
          </DetailTitle>
        }
        description={
          item?.description ??
          "What this API item watches, what it sends, and how its runs went."
        }
        actions={
          item && (
            // Keyed by the item: a run still going must not show on the
            // next item's page.
            <RunActions
              key={name}
              kind="api"
              name={name}
              byHand={runsByHand(item)}
              onRun={(run) => setResult({ name, run })}
            />
          )
        }
      />
      {query.isPending && <SkeletonSummary />}
      {query.isError && !missing && (
        <Notice title="Could not load this API">{query.error.message}</Notice>
      )}
      {missing && (
        <EmptyState title="No such API">
          Nothing called {name} is configured, or this key may not see it.{" "}
          <Link to="/apis">See every API</Link>.
        </EmptyState>
      )}
      {item && (
        <>
          <Overview api={item} />
          {shown && (
            <RunResult run={shown} kind="api" onClose={() => setResult(null)} />
          )}
          <RunHistory runs={item.history} kind="api" item={name} />
        </>
      )}
    </>
  );
}

function Overview({ api: a }: { api: Api }) {
  return (
    <Panel
      title="Overview"
      hint="What it watches, what it sends and how, and the credentials it sends with."
      aside={<HealthPill state={actionState(a)} labels={actionLabels(a)} />}
    >
      <dl className={common.facts}>
        <TriggerFacts item={a} />
        <Fact label="Calls" hint={HINTS["Calls"]}>
          <code className={common.mono}>
            {a.method} {a.destination}
          </code>
        </Fact>
        <Fact label="Requests" hint={HINTS["Requests"]}>
          {PER_WORDS[a.per]}
        </Fact>
        <Fact label="Flow" hint={HINTS["Flow"]}>
          {flowWords(a).length === 0 ? (
            "Sends every time"
          ) : (
            <ValueList values={flowWords(a)} limit={3} />
          )}
        </Fact>
        <Fact label="Authentication" hint={HINTS["Authentication"]}>
          {authText(a.auth)}
        </Fact>
        <Fact label="Credentials" hint={HINTS["Credentials"]}>
          <ValueList values={credentialLinks(a.credentials)} />
        </Fact>
        <LimitFacts item={a} />
      </dl>
    </Panel>
  );
}
