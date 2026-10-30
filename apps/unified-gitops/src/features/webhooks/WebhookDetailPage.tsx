import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  ListSoft,
  ListTable,
  LiveAge,
  Notice,
  PageHeader,
  Panel,
  RunButton,
  SkeletonSummary,
  formatSpan,
  type ListColumn,
} from "@opusprojects/unified-ui";
import {
  DetailTitle,
  ValueList,
  detailStyles as common,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useWebhook } from "../../api/queries";
import { ApiError } from "@opusprojects/unified-client";
import { ICONS } from "../../sections";
import { credentialLinks } from "../../shared/ActionFacts";
import { authText, labelsText } from "../../shared/runs";
import {
  CONTENT_WORDS,
  eventWords,
  sentEvent,
  webhookLabels,
  webhookState,
} from "./model";
import { sendTest } from "./test";

type Webhook = Schemas["WebhookSummary"];
type Delivery = Schemas["Delivery"];

// What each fact means, behind its label, starting with its key in the
// webhook's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Project:
    "project. The repository whose events it reports: its pulls, and the runs of its API and script items.",
  Events:
    "events. What makes it send: a commit pulled, a pull that fails or works again, and an API or script run of the project that works, fails or recovers.",
  Paths:
    "trigger.paths and trigger.ignore_paths. For commit_pulled only: the files a commit must touch to be told. None means every commit.",
  "Sends to":
    "webhook.url. The receiver's address, without its path or query, which can carry a secret. The full URL is in the configuration.",
  Method: "webhook.method. The HTTP method it sends with; POST by default.",
  Body: "webhook.content_type and webhook.body. How the body is written, and whether a template shapes it or the event message goes as it is.",
  Waits:
    "webhook.wait. Whether, after the receiver answers, it follows what it started (a job, a deployment) until a condition holds.",
  "Rate limit":
    "webhook.rate_limit. At most this many requests to the receiver in this window.",
  Credentials:
    "credential, and those its auth, signature or client certificate read. Where the secrets it sends come from; never their values.",
  Authentication:
    "webhook.auth. How the credential is sent: a bearer token, basic authentication, a header or query parameter of its own, OAuth 2, or a login request first.",
  Headers:
    "webhook.headers. Fixed headers sent with every message, by name; their values are in the configuration.",
  Query:
    "webhook.query. Fixed query parameters, by name; their values are in the configuration.",
  Signature:
    "webhook.signature. A header with an HMAC of the body, made with the credential's secret, for receivers that check where a message came from.",
  Timeout:
    "timeout_seconds. How long one attempt may take before it counts as unanswered.",
  Attempts:
    "retry.attempts. Attempts in all for one message, the first included, when the receiver does not answer, is overloaded (429) or fails (5xx). Never on a 4xx.",
  Labels: "labels. Free-form, for finding items in this UI and the API.",
};

export function WebhookDetailPage() {
  const { name = "" } = useParams();
  // 404 for a name that is not configured: shown as "No such webhook".
  const webhooks = useWebhook(name);
  // Gone (a reload removed it, or it never was): say so, and show none of
  // what an earlier answer had, nor a button that can only fail.
  const missing =
    webhooks.error instanceof ApiError && webhooks.error.status === 404;
  const webhook = missing ? undefined : webhooks.data;

  return (
    <>
      <PageHeader
        icon={ICONS.webhooks}
        title={
          <DetailTitle section="Webhooks" to="/webhooks">
            {name}
          </DetailTitle>
        }
        description={
          webhook?.description ??
          "Which events of its project this webhook reports, and where it sends them."
        }
        actions={
          webhook && (
            // Keyed by the webhook: a send still running must not show
            // on the next webhook's page.
            <RunButton
              key={name}
              label="Send test"
              busyLabel="Sending…"
              invalidate={[["webhooks"]]}
              run={() => sendTest(name)}
            />
          )
        }
      />
      {webhooks.isPending && <SkeletonSummary />}
      {webhooks.isError && !missing && (
        <Notice title="Could not load this webhook">
          {webhooks.error.message}
        </Notice>
      )}
      {missing && (
        <EmptyState title="No such webhook">
          Nothing called {name} is configured.{" "}
          <Link to="/webhooks">See every webhook</Link>.
        </EmptyState>
      )}
      {webhook && (
        <>
          <Overview webhook={webhook} />
          <History history={webhook.history} />
        </>
      )}
    </>
  );
}

function Overview({ webhook: n }: { webhook: Webhook }) {
  const r = n.request;
  return (
    <Panel
      title="Overview"
      hint="What it reports and where: the project and its events, the receiver, and how it sends."
      aside={<HealthPill state={webhookState(n)} labels={webhookLabels(n)} />}
    >
      <dl className={common.facts}>
        <Fact label="Project" hint={HINTS["Project"]}>
          <Link
            className={common.link}
            to={`/projects/${encodeURIComponent(n.project)}`}
          >
            {n.project}
          </Link>
        </Fact>
        <Fact label="Events" hint={HINTS["Events"]}>
          <ValueList values={eventWords(n.events)} />
        </Fact>
        <Fact label="Paths" hint={HINTS["Paths"]}>
          {n.paths.length === 0 && n.ignore_paths.length === 0 ? (
            "Every commit"
          ) : (
            <ValueList
              values={[...n.paths, ...n.ignore_paths.map((p) => `not ${p}`)]}
              mono
            />
          )}
        </Fact>
        <Fact label="Sends to" hint={HINTS["Sends to"]}>
          {n.destination}
        </Fact>
        <Fact label="Method" hint={HINTS["Method"]}>
          <code className={common.mono}>{r.method}</code>
        </Fact>
        <Fact label="Body" hint={HINTS["Body"]}>
          {CONTENT_WORDS[r.content_type]},{" "}
          {r.templated ? "from a template" : "the event as it is"}
        </Fact>
        <Fact label="Authentication" hint={HINTS["Authentication"]}>
          {authText(r.auth)}
        </Fact>
        <Fact label="Credentials" hint={HINTS["Credentials"]}>
          <ValueList values={credentialLinks(n.credentials)} />
        </Fact>
        <Fact label="Headers" hint={HINTS["Headers"]}>
          <ValueList values={r.headers} mono />
        </Fact>
        {r.query.length > 0 && (
          <Fact label="Query" hint={HINTS["Query"]}>
            <ValueList values={r.query} mono />
          </Fact>
        )}
        <Fact label="Signature" hint={HINTS["Signature"]}>
          {r.signature_header ? (
            <code className={common.mono}>{r.signature_header}</code>
          ) : (
            "None"
          )}
        </Fact>
        <Fact label="Waits" hint={HINTS["Waits"]}>
          {r.waits ? "Until its condition holds" : "No"}
        </Fact>
        {r.rate_limit && (
          <Fact label="Rate limit" hint={HINTS["Rate limit"]}>
            {r.rate_limit}
          </Fact>
        )}
        <Fact label="Timeout" hint={HINTS["Timeout"]}>
          {formatSpan(n.timeout_seconds)} per attempt
        </Fact>
        <Fact label="Attempts" hint={HINTS["Attempts"]}>
          {n.attempts}
        </Fact>
        {Object.keys(n.labels).length > 0 && (
          <Fact label="Labels" hint={HINTS["Labels"]}>
            <ValueList values={labelsText(n.labels)} mono />
          </Fact>
        )}
      </dl>
    </Panel>
  );
}

const SEND_LABELS = { fresh: "Sent", failing: "Failed" };

const answer = (d: Delivery) =>
  `${d.status != null ? `HTTP ${d.status}` : "No answer"}${
    d.attempts > 1 ? `, ${d.attempts} attempts` : ""
  }`;

// What happened and when first, then the details; how it went ends the row,
// as a pill.
const historyColumns: ListColumn<Delivery>[] = [
  {
    key: "event",
    label: "Event",
    render: (d) => sentEvent(d.event),
  },
  {
    key: "when",
    label: "When",
    render: (d) => <LiveAge since={d.at} />,
  },
  {
    // A project's event names the project; a test, none.
    key: "about",
    label: "About",
    render: (d) =>
      d.project ? (
        <Link
          className={common.link}
          to={`/projects/${encodeURIComponent(d.project)}`}
        >
          {d.project}
        </Link>
      ) : (
        <ListSoft>None (a test)</ListSoft>
      ),
  },
  {
    key: "answer",
    label: "Answer",
    render: answer,
  },
  {
    // "OK" when the receiver took it; why not, when it did not.
    key: "message",
    label: "Message",
    title: (d) => d.error ?? undefined,
    render: (d) => (d.ok ? "OK" : (d.error ?? "Failed")),
  },
  {
    key: "result",
    label: "Result",
    role: "state",
    render: (d) => (
      <HealthPill state={d.ok ? "fresh" : "failing"} labels={SEND_LABELS} />
    ),
  },
];

// Its sends since the service started, newest first: what it sent, whether
// the receiver took it, and what it answered.
function History({ history }: { history: Delivery[] }) {
  return (
    <Panel
      title="History"
      hint="Its sends since the service started, newest first, at most 50. Retries of one message count as one send; a test is one too."
    >
      {history.length === 0 ? (
        <ListSoft>
          Nothing sent yet: its project has had none of its events since the
          service started. Send a test to check the receiver.
        </ListSoft>
      ) : (
        <ListTable
          columns={historyColumns}
          rows={history}
          rowKey={(d) => `${history.indexOf(d)}-${d.at}-${d.event}`}
          empty="Nothing sent yet."
          noun="sends"
        />
      )}
    </Panel>
  );
}
