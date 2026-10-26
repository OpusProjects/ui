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
import { useApplications, useNotification } from "../../api/queries";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import {
  LABELS,
  TYPE_WORDS,
  eventWords,
  notificationState,
  sentEvent,
  templateText,
  triggerText,
} from "./model";
import { sendTest } from "./test";

type Notification = Schemas["NotificationInfo"];
type Delivery = Schemas["Delivery"];

// What each fact means, behind its label, starting with its key in the
// notification's YAML, which is where it is changed.
const HINTS: Record<string, string> = {
  Type: "type. webhook sends to any HTTP receiver; ascender and awx start a job template.",
  Events:
    "events. What makes it send: drift found, a new commit waiting, a sync that applied or failed, back in sync. One message per run at most.",
  "Sends to":
    "The receiver's address, without its path or query, which can carry a secret. The full URL is in the configuration.",
  Starts: "job_template or workflow_job_template. The template it starts.",
  Trigger:
    "trigger. webhook posts the message to the template's own receiver, with its key; launch starts it as a user, with the message in extra_vars.",
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
  "Extra vars":
    "extra_vars. Variables sent beside the event, which arrives as unified_gitops; their values are in the configuration.",
};

const AUTH_WORDS: Record<string, string> = {
  bearer: "Bearer token",
  basic: "Basic",
  none: "None",
};

const authText = (w: Schemas["WebhookInfo"]) =>
  w.auth === "header"
    ? `Header ${w.auth_header ?? ""}`
    : (AUTH_WORDS[w.auth] ?? w.auth);

export function NotificationDetailPage() {
  const { name = "" } = useParams();
  // 404 for a name that is not configured: shown as "No such notification".
  const notifications = useNotification(name);
  const notification = notifications.data;
  const missing =
    notifications.isError && /not configured/.test(notifications.error.message);

  return (
    <>
      <PageHeader
        icon={ICONS.notifications}
        title={
          <DetailTitle section="Notifications" to="/notifications">
            {name}
          </DetailTitle>
        }
        description={
          notification?.description ??
          "Which events this notification reports, and where it sends them."
        }
        actions={
          notification && (
            // Keyed by the notification: a send still running must not show
            // on the next notification's page.
            <RunButton
              key={name}
              label="Send test"
              busyLabel="Sending…"
              invalidate={[["notifications"]]}
              run={() => sendTest(name)}
            />
          )
        }
      />
      {notifications.isPending && <SkeletonSummary />}
      {notifications.isError && !missing && (
        <Notice title="Could not load this notification">
          {notifications.error.message}
        </Notice>
      )}
      {missing && (
        <EmptyState title="No such notification">
          Nothing called {name} is configured.{" "}
          <Link to="/notifications">See every notification</Link>.
        </EmptyState>
      )}
      {notification && (
        <>
          <Overview notification={notification} />
          <Panel
            title="Applications"
            hint="The applications whose events it reports: applications: all for every one, or their names. Left out or empty, none."
          >
            <Listens notification={notification} />
          </Panel>
          <History history={notification.history} />
        </>
      )}
    </>
  );
}

function Overview({ notification: n }: { notification: Notification }) {
  return (
    <Panel
      title="Overview"
      hint="What it reports and where: the events, the receiver, and the credentials it sends with."
      aside={<HealthPill state={notificationState(n)} labels={LABELS} />}
    >
      <dl className={common.facts}>
        <Fact label="Type" hint={HINTS["Type"]}>
          {TYPE_WORDS[n.type]}
        </Fact>
        <Fact label="Events" hint={HINTS["Events"]}>
          <ValueList values={eventWords(n.events)} />
        </Fact>
        <Fact label="Sends to" hint={HINTS["Sends to"]}>
          <code className={common.mono}>{n.destination}</code>
        </Fact>
        {templateText(n) && (
          <Fact label="Starts" hint={HINTS["Starts"]}>
            {templateText(n)}
          </Fact>
        )}
        {triggerText(n) && (
          <Fact label="Trigger" hint={HINTS["Trigger"]}>
            {triggerText(n)}
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
        {n.webhook && (
          <>
            <Fact label="Authentication" hint={HINTS["Authentication"]}>
              {authText(n.webhook)}
            </Fact>
            <Fact label="Headers" hint={HINTS["Headers"]}>
              <ValueList values={n.webhook.headers} mono />
            </Fact>
            <Fact label="Signature" hint={HINTS["Signature"]}>
              {n.webhook.signature_header ? (
                <code className={common.mono}>
                  {n.webhook.signature_header}
                </code>
              ) : (
                "None"
              )}
            </Fact>
          </>
        )}
        {n.trigger === "launch" && (
          <Fact label="Extra vars" hint={HINTS["Extra vars"]}>
            <ValueList values={n.extra_vars} mono />
          </Fact>
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
    key: "application",
    label: "Application",
    render: (d) =>
      d.application ? (
        <Link
          className={common.link}
          to={`/applications/${encodeURIComponent(d.application)}`}
        >
          {d.application}
        </Link>
      ) : (
        <ListSoft>None (a test)</ListSoft>
      ),
  },
  {
    key: "answer",
    label: "Answer",
    render: (d) => (d.job ? `${answer(d)}, job ${d.job}` : answer(d)),
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
          Nothing sent yet: no application has had one of its events since the
          service started. Send a test to check the receiver.
        </ListSoft>
      ) : (
        <ListTable
          columns={historyColumns}
          rows={history}
          rowKey={(d) => `${d.at}-${d.event}-${d.application ?? ""}`}
          empty="Nothing sent yet."
          noun="sends"
        />
      )}
    </Panel>
  );
}

function Listens({ notification: n }: { notification: Notification }) {
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
    : applications.data.filter((a) => n.applications.includes(a.name));

  return (
    <ListTable
      columns={applicationColumns("connector")}
      rows={rows.map((app) => ({ name: app.name, app }))}
      rowKey={(r) => r.name}
      empty="It listens to no application: name some under applications: in the configuration, or write all."
      noun="applications"
    />
  );
}
