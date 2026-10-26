import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { InfoHint } from "./InfoHint";
import styles from "./Charts.module.css";

// Small charts drawn as SVG by hand. Three forms are all an operations page
// needs, and a charting library would cost more than the page it draws.
//
// Shared rules (from the team's data-visualisation guide): one series is one
// colour (the accent) and needs no legend; 2px lines, bars at most 24px thick
// with a rounded data end and a square baseline; hairline solid gridlines;
// text in text colours, never the series colour; every value reachable
// without hovering (labels or a table), and the tooltip on focus as on hover.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Compact axis numbers: 950, 1.2K, 3.4M.
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `${trim(value / 1e3)}K`;
  return trim(value);
}

// Up to two decimals below 10, trailing zeros dropped: an axis tick at
// 0.25 must read 0.25, not a rounded 0.3 that puts the gridline at the
// wrong value.
function trim(value: number) {
  return Math.abs(value) < 10
    ? String(Number(value.toFixed(2)))
    : value.toFixed(0);
}

// Three to five round ticks from zero to just above the maximum.
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const ticks = [];
  for (let tick = 0; tick <= max + step * 0.001; tick += step) ticks.push(tick);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

// Which of the theme's ten series colours a chart draws in, for telling
// charts apart on one page. Unset = the single chart colour.
export type Series = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const seriesStyle = (series?: Series) =>
  series
    ? ({ "--series": `var(--uu-series-${series})` } as CSSProperties)
    : undefined;

// ------------------------------------------------------------------ stat tile

interface StatTileProps {
  label: string;
  value: string;
  // A sentence under the value: the period, the unit, what it is out of.
  detail?: ReactNode;
  trend?: number[];
  tone?: "default" | "failing";
  // What the number does and does not count, behind an info icon: shown on
  // hover and on keyboard focus, and read out as the icon's description.
  hint?: string;
}

export function StatTile({
  label,
  value,
  detail,
  trend,
  tone = "default",
  hint,
}: StatTileProps) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <span className={styles.tileLabel}>
        {label}
        {hint && <InfoHint text={hint} />}
      </span>
      <span className={styles.tileValue}>{value}</span>
      {detail && <span className={styles.tileDetail}>{detail}</span>}
      {trend && trend.length > 1 && <Sparkline values={trend} />}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className={styles.kpis}>{children}</div>;
}

// The last points of a series, the newest dot in the accent.
function Sparkline({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 32;
  const max = Math.max(...values, 0) || 1;
  const x = (index: number) => 4 + (index / (values.length - 1)) * (width - 8);
  const y = (value: number) => height - 4 - (value / max) * (height - 8);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
    .join("");
  return (
    <div ref={ref} className={styles.sparkline} aria-hidden>
      {width > 0 && (
        <svg width={width} height={height}>
          <path d={path} className={styles.sparkPath} />
          <circle
            cx={x(values.length - 1)}
            cy={y(values.at(-1)!)}
            r={3}
            className={styles.sparkDot}
          />
        </svg>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- line chart

export interface Point {
  at: number;
  // null = nothing to plot for this moment (no requests to average, say):
  // the line breaks there rather than inventing a zero or bridging the gap.
  value: number | null;
  // Extra lines for the tooltip: what the value is made of ("3 reads").
  details?: string[];
}

interface LineChartProps {
  points: Point[];
  label: string;
  format: (value: number) => string;
  // What the tooltip says at a gap.
  gapLabel?: string;
  // Draw straight across gaps instead of breaking the line: for a level that
  // carries on between measurements (a mean response time), not a count.
  connectGaps?: boolean;
  series?: Series;
  // Y-axis tick labels; compact numbers (1.2K) unless the unit needs saying.
  tickFormat?: (value: number) => string;
  height?: number;
  empty?: string;
}

// One series over time, with a crosshair that snaps to the nearest sample.
export function LineChart({
  points,
  label,
  format,
  gapLabel = "No data",
  connectGaps = false,
  series,
  tickFormat = compact,
  height = 220,
  empty,
}: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));

  if (points.length < 2 || values.length === 0) {
    return (
      <div ref={ref} className={styles.chartEmpty} style={{ height }}>
        {/* Samples, but every one a gap: say so, not "collecting". */}
        {points.length >= 2
          ? `${gapLabel} in this window yet.`
          : (empty ?? "Collecting data…")}
      </div>
    );
  }

  // Room for the longest tick label ("800 MB"), measured in characters.
  const longestTick = Math.max(
    ...niceTicks(Math.max(...values)).map((t) => tickFormat(t).length),
  );
  const margin = {
    top: 12,
    right: 16,
    bottom: 28,
    left: Math.max(36, 12 + longestTick * 7),
  };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const ticks = niceTicks(Math.max(...values));
  const top = ticks.at(-1)!;
  const first = points[0].at;
  const span = points.at(-1)!.at - first || 1;
  const x = (at: number) => margin.left + ((at - first) / span) * plotWidth;
  const y = (value: number) =>
    margin.top + plotHeight - (value / top) * plotHeight;
  // Runs of consecutive plotted points; a null ends one. Each run is its own
  // line and its own area wash, so a gap reads as a gap.
  const runs: { at: number; value: number }[][] = [];
  let run: { at: number; value: number }[] = [];
  for (const p of points) {
    if (p.value === null) {
      if (connectGaps) continue;
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ at: p.at, value: p.value });
    }
  }
  if (run.length) runs.push(run);
  const pathOf = (r: { at: number; value: number }[]) =>
    r.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.at)},${y(p.value)}`).join("");
  const areaOf = (r: { at: number; value: number }[]) =>
    `${pathOf(r)}L${x(r.at(-1)!.at)},${y(0)}L${x(r[0].at)},${y(0)}Z`;
  const last = runs.at(-1)!.at(-1)!;
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeTicks = [0, 0.5, 1].map((f) => first + f * span);

  const nearest = (clientX: number, rect: DOMRect) => {
    const at = first + ((clientX - rect.left - margin.left) / plotWidth) * span;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.at - at) < Math.abs(points[best].at - at)) best = i;
    });
    return best;
  };
  const active = hover === null ? null : points[hover];

  return (
    <div
      ref={ref}
      className={styles.chart}
      style={{ height, ...seriesStyle(series) }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}, latest ${format(last.value)}`}
          tabIndex={0}
          onPointerMove={(e) =>
            setHover(
              nearest(e.clientX, e.currentTarget.getBoundingClientRect()),
            )
          }
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(points.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft")
              setHover((h) => Math.max(0, (h ?? points.length - 1) - 1));
            if (e.key === "ArrowRight")
              setHover((h) => Math.min(points.length - 1, (h ?? 0) + 1));
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y(tick)}
                y2={y(tick)}
                className={styles.grid}
              />
              <text x={margin.left - 8} y={y(tick)} className={styles.axisY}>
                {tickFormat(tick)}
              </text>
            </g>
          ))}
          {timeTicks.map((at, i) => (
            <text
              key={at}
              x={x(at)}
              y={height - 8}
              className={styles.axisX}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            >
              {timeFormat.format(at)}
            </text>
          ))}
          {runs.map((r) => (
            <g key={r[0].at}>
              <path d={areaOf(r)} className={styles.area} />
              {/* A lone point between two gaps has no length to stroke. */}
              {r.length > 1 ? (
                <path d={pathOf(r)} className={styles.line} />
              ) : (
                <circle
                  cx={x(r[0].at)}
                  cy={y(r[0].value)}
                  r={2.5}
                  className={styles.endDot}
                />
              )}
            </g>
          ))}
          <circle
            cx={x(last.at)}
            cy={y(last.value)}
            r={4}
            className={styles.endDot}
          />
          {active && (
            <g>
              <line
                x1={x(active.at)}
                x2={x(active.at)}
                y1={margin.top}
                y2={margin.top + plotHeight}
                className={styles.crosshair}
              />
              {active.value !== null && (
                <circle
                  cx={x(active.at)}
                  cy={y(active.value)}
                  r={4}
                  className={styles.endDot}
                />
              )}
            </g>
          )}
        </svg>
      )}
      {active && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(x(active.at) + 12, width - 150),
            top: margin.top,
          }}
          role="status"
        >
          <strong>
            {active.value === null ? gapLabel : format(active.value)}
          </strong>
          {active.value !== null &&
            active.details?.map((line) => <span key={line}>{line}</span>)}
          <span>{timeFormat.format(active.at)}</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- bar list

export interface Bar {
  key: string;
  label: string;
  value: number;
  // Extra lines for the tooltip.
  details?: string[];
}

interface BarListProps {
  bars: Bar[];
  format: (value: number) => string;
  label: string;
  series?: Series;
  // Every bar its own colour, from the series palette in order. Ten hues,
  // so up to ten bars never share one.
  multicolor?: boolean; // Column headings over the names and the bars, styled as a table's, for a
  // list that sits beside one.
  headings?: [string, string];
}

// Horizontal bars for comparing a handful of named things. The value sits at
// the tip of every bar, so the tooltip only adds detail.
export function BarList({
  bars,
  format,
  label,
  series,
  multicolor = false,
  headings,
}: BarListProps) {
  const [active, setActive] = useState<string | null>(null);
  // Below the bar unless that would reach past the bottom of the window:
  // there, the tooltip grew the page, the page scrolled under the pointer,
  // the bar lost its hover and the tooltip flickered in a loop. Measured as
  // it opens, like InfoHint, so it is right wherever the list sits.
  const [above, setAbove] = useState(false);
  const tip = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!active || !tip.current) return;
    const box = tip.current.getBoundingClientRect();
    if (!above && box.bottom > window.innerHeight - 8) setAbove(true);
  }, [active, above]);
  const max = Math.max(...bars.map((bar) => bar.value), 0) || 1;
  return (
    <div style={seriesStyle(series)}>
      {headings && (
        <div className={styles.barHeadings} aria-hidden>
          <span>{headings[0]}</span>
          <span>{headings[1]}</span>
        </div>
      )}
      <ul className={styles.bars} aria-label={label}>
        {bars.map((bar, index) => (
          <li
            key={bar.key}
            className={styles.barRow}
            tabIndex={0}
            onPointerEnter={() => {
              setAbove(false);
              setActive(bar.key);
            }}
            onPointerLeave={() => setActive(null)}
            onFocus={() => {
              setAbove(false);
              setActive(bar.key);
            }}
            onBlur={() => setActive(null)}
            data-active={active === bar.key || undefined}
          >
            <span className={styles.barLabel} title={bar.label}>
              {bar.label}
            </span>
            {/* The bar is a share of its own area, the value sits after it:
                capping the bar's width to leave room for the label clipped every
                long bar to the same length. */}
            <span className={styles.barTrack}>
              <span className={styles.barArea}>
                <span
                  className={styles.bar}
                  style={{
                    width: `${Math.max((bar.value / max) * 100, 0.6)}%`,
                    ...(multicolor
                      ? seriesStyle(((index % 10) + 1) as Series)
                      : undefined),
                  }}
                />
              </span>
              <span className={styles.barValue}>{format(bar.value)}</span>
            </span>
            {active === bar.key && bar.details && (
              <span
                ref={tip}
                className={styles.barTip}
                data-above={above || undefined}
                role="status"
              >
                <strong>{format(bar.value)}</strong>
                {bar.details.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------- table

export interface Column<T> {
  key: string;
  label: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                data-numeric={column.numeric || undefined}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} data-numeric={column.numeric || undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
