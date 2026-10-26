import { Link, useParams } from "react-router";
import {
  EmptyState,
  Fact,
  HealthPill,
  ListSoft,
  ListTable,
  Notice,
  PageHeader,
  Panel,
  RunButton,
  SkeletonSummary,
  formatAge,
  type ListColumn,
} from "@opusprojects/unified-ui";
import { DetailTitle, detailStyles as common } from "@opusprojects/unified-ui";
import type { Schemas } from "../../api/client";
import { useApplications, useNotification } from "../../api/queries";
import { ICONS } from "../../sections";
import { applicationColumns } from "../applications/columns";
import {
  LABELS,
  TYPE_WORDS,
  eventsText,
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
};

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
            hint="The applications whose events it reports. Empty applications: in the configuration means every application."
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
          {eventsText(n.events)}
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
          {n.credentials.length === 0
            ? "None"
            : n.credentials.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <Link
                    className={common.link}
                    to={`/credentials/${encodeURIComponent(c)}`}
                  >
                    {c}
                  </Link>
                </span>
              ))}
        </Fact>
      </dl>
    </Panel>
  );
}

const SEND_LABELS = { fresh: "Sent", failing: "Failed" };

const ago = (at: number) => formatAge(Math.max(0, Date.now() / 1000 - at));

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
    render: (d) => ago(d.at),
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
    key: "error",
    label: "Error",
    title: (d) => d.error ?? undefined,
    render: (d) => (d.error ? d.error : <ListSoft>–</ListSoft>),
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
  const rows =
    n.applications.length === 0
      ? applications.data
      : applications.data.filter((a) => n.applications.includes(a.name));

  return (
    <ListTable
      columns={applicationColumns("connector")}
      rows={rows.map((app) => ({ name: app.name, app }))}
      rowKey={(r) => r.name}
      empty="No application to listen to."
      noun="applications"
    />
  );
}
