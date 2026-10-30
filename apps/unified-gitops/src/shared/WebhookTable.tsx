import { Link } from "react-router";
import {
  HealthPill,
  ListName,
  ListSoft,
  ListTable,
  LiveAge,
  type ListColumn,
} from "@opusprojects/unified-ui";
import type { Schemas } from "../api/client";
import { useWebhooks } from "../api/queries";
import {
  hostOf,
  sentEvent,
  webhookLabels,
  webhookState,
} from "../features/webhooks/model";

type Webhook = Schemas["WebhookSummary"];

// A set of webhooks, each with where it sends, its last send and its state,
// and a link to its page: those that hear a project, or send with a
// credential. `hears` picks them from the list.
export function WebhookTable({
  hears,
  empty,
}: {
  hears: (webhook: Webhook) => boolean;
  empty: string;
}) {
  const webhooks = useWebhooks();
  const rows = (webhooks.data ?? [])
    .filter(hears)
    .sort((a, b) => a.name.localeCompare(b.name));
  const columns: ListColumn<Webhook>[] = [
    {
      key: "name",
      label: "Webhook",
      role: "name",
      title: (n) => n.name,
      render: (n) => (
        <ListName
          name={n.description ?? n.name}
          id={n.name}
          link={(className, children) => (
            <Link
              className={className}
              to={`/webhooks/${encodeURIComponent(n.name)}`}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
    {
      key: "destination",
      label: "Sends to",
      title: (n) => n.destination,
      render: (n) => hostOf(n.destination),
    },
    {
      key: "last",
      label: "Last send",
      render: (n) =>
        n.last ? (
          <>
            {sentEvent(n.last.event)}, <LiveAge since={n.last.at} />
          </>
        ) : (
          <ListSoft>Never</ListSoft>
        ),
    },
    {
      key: "state",
      label: "State",
      role: "state",
      render: (n) => (
        <HealthPill state={webhookState(n)} labels={webhookLabels(n)} />
      ),
    },
  ];
  return (
    <ListTable
      columns={columns}
      rows={rows}
      rowKey={(n) => n.name}
      empty={empty}
      noun="webhooks"
    />
  );
}
