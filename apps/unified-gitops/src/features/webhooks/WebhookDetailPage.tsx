import { Link, useParams } from "react-router";
import { ExternalLink } from "lucide-react";
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
import { useApplications, useWebhook } from "../../api/queries";
import { ApiError } from "@opusprojects/unified-client";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import {
  webhookLabels,
  selectsApplications,
  selectsProjects,
  TYPE_WORDS,
  eventWords,
  webhookState,
  sentEvent,
  templatePage,
  templateText,
  payloadVariable,
} from "./model";
import { sendTest } from "./test";

type Webhook = Schemas["WebhookSummary"];
type Delivery = Schemas["Delivery"];

// What each fact means, behind its label, starting with its key in the
// webhook's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Type: "type. webhook sends to any HTTP receiver; ascender and awx start a job template.",
  Events:
    "events. What makes it send. From an application: drift found, a new commit waiting, a sync that applied or failed, back in sync; one message per run at most. From a project: commits pulled, a pull that fails, pulls working again.",
  Projects:
    "projects. The repositories it listens to: their own events, and those of every application reading from them, including applications added later. projects: all for every one.",
  Applications:
    "applications. Applications it listens to by name, wherever they read from; applications: all for every one. Left out, with no projects either, it listens to nothing.",
  "Sends to":
    "The receiver's address, without its path or query, which can carry a secret. The full URL is in the configuration.",
  Starts: "job_template or workflow_job_template. The template it starts.",
  Link: "The template's own page in the controller, in a new tab: what it runs, its webhook key and its jobs.",
  Payload:
    "The variable the template's playbook finds the message in: the controller passes the webhook's body as ascender_webhook_payload (awx_webhook_payload in AWX; tower_webhook_payload in both).",
  Credentials:
    "credentials. Where the token, key or password it sends comes from; never their values.",
  Authentication:
    "webhook.auth. How the credential is sent: a bearer token, basic authentication, or a header of its own.",
  Headers:
    "webhook.headers. Fixed headers sent with every message; their values are in the configuration.",
  Signature:
    "webhook.sign. A header with an HMAC-SHA256 of the body, made with the credential's secret, for receivers that check where a message came from.",
  Timeout:
    "timeout_seconds. How long one attempt may take before it counts as unanswered.",
  Retries:
    "retries. How many more times a message is sent when the receiver does not answer, is overloaded (429) or fails (5xx). Never on a 4xx.",
};

const AUTH_WORDS: Record<string, string> = {
  bearer: "Bearer token",
  basic: "Basic",
  none: "None",
};

const authText = (w: Schemas["RequestInfo"]) =>
  w.auth === "header"
    ? `Header ${w.auth_header ?? ""}`
    : (AUTH_WORDS[w.auth] ?? w.auth);

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
          "Which events this webhook reports, and where it sends them."
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
          <Panel
            title="Applications"
            hint="The applications whose events it reports: those it names, and every application reading from the projects it names. Left out or empty, none."
          >
            <Listens webhook={webhook} />
          </Panel>
          <History history={webhook.history} />
        </>
      )}
    </>
  );
}

function Overview({ webhook: n }: { webhook: Webhook }) {
  return (
    <Panel
      title="Overview"
      hint="What it reports and where: the events, the receiver, and the credentials it sends with."
      aside={<HealthPill state={webhookState(n)} labels={webhookLabels(n)} />}
    >
      <dl className={common.facts}>
        <Fact label="Type" hint={HINTS["Type"]}>
          {TYPE_WORDS[n.type]}
        </Fact>
        <Fact label="Events" hint={HINTS["Events"]}>
          <ValueList values={eventWords(n.events)} />
        </Fact>
        {selectsProjects(n) && (
          <Fact label="Projects" hint={HINTS["Projects"]}>
            {n.all_projects ? (
              "Every project"
            ) : (
              <ValueList
                values={n.projects.map((p) => (
                  <Link
                    key={p}
                    className={common.link}
                    to={`/projects/${encodeURIComponent(p)}`}
                  >
                    {p}
                  </Link>
                ))}
              />
            )}
          </Fact>
        )}
        {(selectsApplications(n) || !selectsProjects(n)) && (
          <Fact label="Applications" hint={HINTS["Applications"]}>
            {n.all_applications ? (
              "Every application"
            ) : (
              <ValueList
                values={n.applications.map((a) => (
                  <Link
                    key={a}
                    className={common.link}
                    to={`/applications/${encodeURIComponent(a)}`}
                  >
                    {a}
                  </Link>
                ))}
              />
            )}
          </Fact>
        )}
        <Fact label="Sends to" hint={HINTS["Sends to"]}>
          {n.destination}
        </Fact>
        {templateText(n) && (
          <Fact label="Starts" hint={HINTS["Starts"]}>
            {templateText(n)}
          </Fact>
        )}
        {payloadVariable(n) && (
          <Fact label="Payload" hint={HINTS["Payload"]}>
            <code className={common.mono}>{payloadVariable(n)}</code>
          </Fact>
        )}
        {templatePage(n) && (
          <Fact
            label={n.type === "awx" ? "AWX link" : "Ascender link"}
            hint={HINTS["Link"]}
          >
            <a
              className={`${common.link} ${common.out}`}
              href={templatePage(n)!}
              target="_blank"
              rel="noreferrer"
            >
              Open the template
              <ExternalLink aria-hidden />
            </a>
          </Fact>
        )}
        <Fact label="Credentials" hint={HINTS["Credentials"]}>
          <ValueList
            values={n.credentials.map((c) => (
              <Link
                key={c}
                className={common.link}
                to={`/credentials/${encodeURIComponent(c)}`}
              >
                {c}
              </Link>
            ))}
          />
        </Fact>
        {n.request && (
          <>
            <Fact label="Authentication" hint={HINTS["Authentication"]}>
              {authText(n.request)}
            </Fact>
            <Fact label="Headers" hint={HINTS["Headers"]}>
              <ValueList values={n.request.headers} mono />
            </Fact>
            <Fact label="Signature" hint={HINTS["Signature"]}>
              {n.request.signature_header ? (
                <code className={common.mono}>
                  {n.request.signature_header}
                </code>
              ) : (
                "None"
              )}
            </Fact>
          </>
        )}
        <Fact label="Timeout" hint={HINTS["Timeout"]}>
          {formatSpan(n.timeout_seconds)} per attempt
        </Fact>
        <Fact label="Retries" hint={HINTS["Retries"]}>
          {n.retries === 0 ? "None" : n.retries}
        </Fact>
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
    // An application's event names the application; a project's, the
    // project; a test, neither.
    key: "about",
    label: "About",
    render: (d) =>
      d.application ? (
        <Link
          className={common.link}
          to={`/applications/${encodeURIComponent(d.application)}`}
        >
          {d.application}
        </Link>
      ) : d.project ? (
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
          Nothing sent yet: nothing it listens to has had one of its events
          since the service started. Send a test to check the receiver.
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

function Listens({ webhook: n }: { webhook: Webhook }) {
  const applications = useApplications();
  if (applications.isPending) return <SkeletonSummary />;
  if (applications.isError)
    return (
      <Notice title="Could not load applications">
        {applications.error.message}
      </Notice>
    );
  const rows = n.all_applications
    ? applications.data
    : applications.data.filter(
        (a) =>
          n.applications.includes(a.name) ||
          n.project_applications.includes(a.name),
      );

  return (
    <ListTable
      columns={applicationColumns("connector")}
      rows={rows.map((app) => ({ name: app.name, app }))}
      rowKey={(r) => r.name}
      empty="It listens to no application: name some under applications: or projects: in the configuration, or write all."
      noun="applications"
    />
  );
}
