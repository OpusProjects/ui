import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  HEALTH_LABEL,
  HEALTH_ORDER,
  type HealthState,
} from "@opusprojects/unified-client";
import { linkify } from "./AutoLink";
import { InfoHint } from "./InfoHint";
import { lift } from "./Lift";
import { useLiveSeconds } from "./LiveAge";
import styles from "./Health.module.css";

type Labels = Partial<Record<HealthState, string>>;

function labelFor(state: HealthState, labels?: Labels) {
  return labels?.[state] ?? HEALTH_LABEL[state];
}

interface HealthPillProps {
  state: HealthState;
  labels?: Labels;
  detail?: string;
}

export function HealthPill({ state, labels, detail }: HealthPillProps) {
  return (
    <span className={styles.pill} data-state={state}>
      <span className={styles.dot} aria-hidden />
      {labelFor(state, labels)}
      {detail && <span className={styles.pillDetail}>{detail}</span>}
    </span>
  );
}

interface HealthSummaryProps {
  counts: Record<HealthState, number>;
  // What is counted, as [one, many]: ["source", "sources"].
  noun: [string, string];
  labels?: Labels;
  // Picking a state filters the page to it. Left out (a page with nothing
  // to filter, as the Topology tree), the counts are plain labels rather
  // than buttons that would do nothing.
  selected?: HealthState | null;
  onSelect?: (state: HealthState | null) => void;
  // Its own "Show all" chip, which clears only the state picked here. Off
  // where the page has a "Show all" of its own that also clears the search:
  // two buttons by one name that do different things.
  showAll?: boolean;
  // What "all good" means here, as an adjective: "in use" for connectors, whose
  // good state is not health. Default "healthy".
  good?: string;
}

// One bar for the whole page: how much of it needs a person, and a way to show
// only that part. Segments are sized by count so a single failure among fifty
// still reads as a sliver rather than a quarter of the bar.
export function HealthSummary({
  counts,
  noun,
  labels,
  selected = null,
  onSelect,
  showAll = true,
  good = "healthy",
}: HealthSummaryProps) {
  const total = HEALTH_ORDER.reduce((sum, state) => sum + counts[state], 0);
  const attention = counts.failing + counts.stale;
  const present = HEALTH_ORDER.filter((state) => counts[state] > 0);

  // Nothing to summarize: the page's own empty state says what to do.
  if (total === 0) return null;

  const [one, many] = noun;
  const of = (count: number) =>
    `${count} of ${total} ${total === 1 ? one : many}`;
  let headline: string;
  if (attention === 0 && counts.pending === 0)
    headline =
      total === 1
        ? `The ${one} is ${good}`
        : `All ${total} ${many} are ${good}`;
  else if (attention === 0)
    // In the page's own word when it has one ("1 of 4 credentials is
    // unused"): "has not run yet" fits a task, not a credential.
    headline = labels?.pending
      ? `${of(counts.pending)} ${counts.pending === 1 ? "is" : "are"} ${labels.pending.toLowerCase()}`
      : `${of(counts.pending)} ${counts.pending === 1 ? "has" : "have"} not run yet`;
  else {
    // Say what is wrong when it is one thing: "22 of 32 sources are stale".
    // Only in the default vocabulary, where the state's name reads as an
    // adjective; a page with its own labels ("Pulls failing") and a mix of
    // stale and failing keep the general "need attention".
    const only =
      counts.failing === 0 ? "stale" : counts.stale === 0 ? "failing" : null;
    headline =
      only && !labels?.[only]
        ? `${of(attention)} ${attention === 1 ? "is" : "are"} ${only}`
        : `${of(attention)} ${attention === 1 ? "needs" : "need"} attention`;
  }

  return (
    <section className={styles.summary} aria-label={`${many} health`}>
      <p className={styles.headline}>{headline}</p>
      <div className={styles.bar} aria-hidden>
        {present.map((state) => (
          <span
            key={state}
            className={styles.segment}
            data-state={state}
            data-dimmed={
              selected !== null && selected !== state ? true : undefined
            }
            style={{ flexGrow: counts[state] }}
          />
        ))}
      </div>
      <div
        className={styles.filters}
        role="group"
        aria-label={onSelect ? "Show only" : "Counts"}
      >
        {present.map((state) => {
          const active = selected === state;
          if (!onSelect)
            return (
              <span
                key={state}
                className={styles.filter}
                data-state={state}
                data-static
              >
                <span className={styles.dot} aria-hidden />
                <span className={styles.count}>{counts[state]}</span>
                {labelFor(state, labels)}
              </span>
            );
          return (
            <button
              key={state}
              type="button"
              className={styles.filter}
              data-state={state}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : state)}
            >
              <span className={styles.dot} aria-hidden />
              <span className={styles.count}>{counts[state]}</span>
              {labelFor(state, labels)}
            </button>
          );
        })}
        {selected && showAll && onSelect && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => onSelect(null)}
          >
            Show all
          </button>
        )}
      </div>
    </section>
  );
}

interface ResourceCardProps {
  title: string;
  id?: string;
  // A line of plain words under the title, for a card whose title is
  // already the identity (a name as in the configuration). Nothing is drawn
  // when it is empty or null.
  description?: string | null;
  // Makes the id a link, opened in a new tab: for a card whose id is an
  // address (another instance), so the card needs no separate Open button.
  idHref?: string;
  state: HealthState;
  labels?: Labels;
  stateDetail?: string;
  tag?: string;
  // "warning" when the tag says something is off (a version that differs
  // from its neighbours'); the title explains it on hover.
  tagTone?: "neutral" | "warning";
  tagTitle?: string;
  // Makes the whole card open something: the title becomes the link (so it
  // is focusable and opens in a new tab like any link) and its hit area is
  // stretched over the card. Buttons and links inside keep working. Takes the
  // title and a class, so the app can wrap them in its router's Link.
  titleLink?: (title: ReactNode, className: string) => ReactNode;
  // The same, for an address outside the app (an endpoint's output, a git
  // repository): the card opens it in a new tab. Either one makes the card
  // lift when pointed at.
  href?: string;
  error?: string | null;
  // An amber box in the same place as the error box: no failure, but a
  // state someone chose and has to come back to (a rollback).
  note?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

// One configured thing (a source, a project, a target) and whether it is
// keeping up. The title is the human name; the id below it is what an API call
// or a config file uses, so it is set in mono and selectable.
export function ResourceCard({
  title,
  id,
  description,
  idHref,
  state,
  labels,
  stateDetail,
  tag,
  tagTone = "neutral",
  tagTitle,
  titleLink,
  href,
  error,
  note,
  footer,
  children,
}: ResourceCardProps) {
  const link =
    titleLink ??
    (href
      ? (text: ReactNode, className: string) => (
          <a className={className} href={href} target="_blank" rel="noreferrer">
            {text}
          </a>
        )
      : undefined);
  return (
    <article
      className={link ? lift(styles.card) : styles.card}
      data-state={state}
      data-linked={link ? true : undefined}
    >
      <header className={styles.cardHeader}>
        <div className={styles.cardTitles}>
          <h2 className={styles.cardTitle} title={title}>
            {/* Cut inside the link, not on it: the link's ::after covers the
                whole card, and clipping the link would clip that too. */}
            {link ? (
              link(
                <span className={styles.cardTitleText}>{title}</span>,
                styles.cardLink,
              )
            ) : (
              <span className={styles.cardTitleText}>{title}</span>
            )}
            {tag && (
              <span className={styles.tag} data-tone={tagTone} title={tagTitle}>
                {tag}
              </span>
            )}
          </h2>
          {id && id !== title && !idHref && (
            <code className={styles.cardId}>{id}</code>
          )}
          {description && (
            <p className={styles.cardDescription} title={description}>
              {description}
            </p>
          )}
          {id && idHref && (
            <a
              className={styles.cardIdLink}
              href={idHref}
              target="_blank"
              rel="noreferrer"
              title={`Open ${id}`}
            >
              <code>{id}</code>
              <ExternalLink aria-hidden />
            </a>
          )}
        </div>
        <HealthPill state={state} labels={labels} detail={stateDetail} />
      </header>
      {children && <dl className={styles.facts}>{children}</dl>}
      {error && <p className={styles.error}>{error}</p>}
      {note && <div className={styles.note}>{note}</div>}
      {footer && <footer className={styles.cardFooter}>{footer}</footer>}
    </article>
  );
}

// Label/value rows outside a card, e.g. inside a Panel.
export function FactList({ children }: { children: ReactNode }) {
  return <dl className={styles.facts}>{children}</dl>;
}

// With a hint, the label opens a short explanation of what the fact means.
// A value that is a web address is a link out (linkify).
export function Fact({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.fact}>
      <dt>{hint ? <InfoHint text={hint}>{label}</InfoHint> : label}</dt>
      <dd>{linkify(children)}</dd>
    </div>
  );
}

interface FreshnessMeterProps {
  ageSeconds: number;
  ttlSeconds: number;
  state: HealthState;
  // When the age was measured (a query's dataUpdatedAt): the meter fills on
  // from there, every second, as the LiveAge beside it counts.
  at?: number;
}

// How far through its freshness window the data is: full means it is about to
// go stale (or has).
export function FreshnessMeter({
  ageSeconds,
  ttlSeconds,
  state,
  at,
}: FreshnessMeterProps) {
  const age = useLiveSeconds(ageSeconds, at) ?? ageSeconds;
  const ratio = ttlSeconds > 0 ? Math.min(age / ttlSeconds, 1) : 1;
  return (
    <span
      className={styles.meter}
      data-state={state}
      role="meter"
      aria-label="Share of the freshness window used"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <span
        className={styles.meterFill}
        style={{ width: `${Math.max(ratio * 100, 2)}%` }}
      />
    </span>
  );
}
