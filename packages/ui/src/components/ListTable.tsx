import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Pagination, usePagination } from "./Pagination";
import styles from "./ListTable.module.css";

// The one look for a list of things in a panel, in both apps: full width,
// hairlines, the name first on a fixed share, every fact column an equal
// step after it, and the state last, as wide as its widest pill, so the
// pills line up on the right edge whatever they say.
export interface ListColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  // "name": the row's header (36%; at most one, and first). "state": a
  // pill, last, sized to its content. Anything else is a fact.
  role?: "name" | "state";
  // Tabular numerals, so digits line up down the column.
  numeric?: boolean;
  // A cell's text when it is cut short: the whole of it, on hover.
  title?: (row: T) => string | undefined;
}

// The name's least share: unified-api's sources table (36%, then three
// facts of 21%) is the reference every list follows.
const NAME_SHARE = 36;

// The least space between one column's content and the next. Below it the
// table cannot give every column room to breathe, and falls back to even
// shares (`widths`).
const MIN_GAP = 24;

// Width of each column, in percent, from what the cells hold: each column
// as wide as its widest cell (header included) plus one gap, the same gap
// after every column, so the space between columns reads even whatever
// their contents. The name counts for at most its 36% (a longer one is cut
// short, whole on hover); the last column ends at the right edge. Null when
// the gaps would be under MIN_GAP: then the even shares below.
function fitted(content: number[], nameAt: number, total: number) {
  const capped = content.map((width, i) =>
    i === nameAt ? Math.min(width, (total * NAME_SHARE) / 100) : width,
  );
  const gaps = capped.length - 1;
  if (gaps === 0 || total === 0) return null;
  const gap = (total - capped.reduce((a, b) => a + b, 0)) / gaps;
  if (gap < MIN_GAP) return null;
  return capped.map(
    (width, i) =>
      `${Number((((i === gaps ? width : width + gap) / total) * 100).toFixed(4))}%`,
  );
}

// Width of each column, in percent, before the cells are measured, and when
// the content is too wide for even gaps. The name and the facts share the width
// evenly, so every column starts the same distance after the one before;
// the name never gets less than its 36% (its text is the longest), and the
// facts then share what is left. The state takes 1%, which the table grows
// to fit its pills, so they end at the right edge.
function widths<T>(columns: ListColumn<T>[]): string[] {
  const hasName = columns.some((c) => c.role === "name");
  const state = columns.some((c) => c.role === "state") ? 1 : 0;
  const facts = columns.filter((c) => !c.role).length;
  const shared = 100 - state;
  const name = hasName ? Math.max(NAME_SHARE, shared / (facts + 1)) : 0;
  const each = facts === 0 ? 0 : (shared - name) / facts;
  const pct = (n: number) => `${Number(n.toFixed(4))}%`;
  return columns.map((c) =>
    c.role === "name" ? pct(name) : c.role === "state" ? "1%" : pct(each),
  );
}

// The width a cell's content can take: its column, less its padding.
const room = (cell: Element) => {
  const column = cell.parentElement;
  if (!column) return Infinity;
  const style = getComputedStyle(column);
  return (
    column.getBoundingClientRect().width -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight)
  );
};

// A cell's children that keep their own width (a pill, a link), not the
// blocks that take the column's.
const inline = (cell: Element) =>
  [...cell.children].filter((c) =>
    getComputedStyle(c).display.startsWith("inline"),
  );

export function ListTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  noun = "rows",
  name = noun,
}: {
  columns: ListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  // Said instead of the table when there are no rows.
  empty: ReactNode;
  // What the rows are: the pager's button labels ("Next runs") and the key
  // the viewer's rows-per-page choice is kept under.
  noun?: string;
  // The table's key in the address (?history-page=2): its title, lowercase,
  // which is the noun unless the title says something else ("History").
  name?: string;
}) {
  // Every table pages, inside its panel, once it has more rows than the
  // smallest page; below that the pager does not show at all.
  const { shown, pager } = usePagination(rows, `table:${noun}`, { url: name });

  // Measured after every render (the rows, a page, a refetch change what the
  // cells hold) and whenever the panel resizes; the widths only change when
  // the measurement does, so measuring again settles at once.
  const table = useRef<HTMLTableElement>(null);
  const [measured, setMeasured] = useState<string[] | null>(null);
  useLayoutEffect(() => {
    const el = table.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const measure = () => {
      const content = columns.map(() => 0);
      el.querySelectorAll<HTMLElement>("[data-col]").forEach((cell) => {
        const i = Number(cell.dataset.col);
        // Rounded up, from the fractional width: scrollWidth is a whole
        // number that can round down, so a 121.4px pill got a 121px column,
        // the table grew by the difference and a sub-pixel horizontal
        // scrollbar appeared wherever scrollbars take space (Windows). Only
        // widths that do not depend on the column count, or each pass would
        // widen it a little more: a cell's own width while it leaves room in
        // its column (one that fills it is capped, or stretches to it); else
        // its scrollWidth, as before; and an inline child that overflows the
        // cell (a pill whose text widened after the measure), which stops
        // counting once the column holds it.
        const own = cell.getBoundingClientRect().width;
        const natural = Math.max(
          cell.scrollWidth,
          own < room(cell) - 0.5 ? own : 0,
          ...inline(cell)
            .map((c) => c.getBoundingClientRect().width)
            .filter((w) => w > own),
        );
        content[i] = Math.max(content[i], Math.ceil(natural));
      });
      const nameAt = columns.findIndex((c) => c.role === "name");
      // And the table's width rounded down, for the same reason.
      const total = Math.floor(box.getBoundingClientRect().width);
      const next = fitted(content, nameAt, total);
      setMeasured((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    // What the cells hold too: text that widens after the first measure (a
    // pill whose label changed) does not resize the box, and a cell is capped
    // at its column, so its content is what grows.
    el.querySelectorAll("[data-col]").forEach((cell) => {
      observer.observe(cell);
      for (const child of inline(cell)) observer.observe(child);
    });
    // And a font arriving late, which widens every cell at once.
    const fonts = document.fonts;
    fonts?.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      fonts?.removeEventListener("loadingdone", measure);
    };
  });

  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  const width = measured ?? widths(columns);
  // Every cell's content in one measurable box: its natural width is what
  // the column is sized to (scrollWidth, so a clipped one still counts whole).
  const fit = (i: number, content: ReactNode, clip = false) => (
    <span
      className={clip ? `${styles.fit} ${styles.clip}` : styles.fit}
      data-col={i}
    >
      {content}
    </span>
  );
  return (
    <div>
      <div className={styles.wrap}>
        <table
          className={styles.table}
          ref={table}
          data-fitted={measured ? "" : undefined}
        >
          <colgroup>
            {columns.map((column, i) => (
              <col key={column.key} style={{ width: width[i] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column, i) => (
                <th key={column.key} scope="col" data-role={column.role}>
                  {fit(i, column.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column, i) => {
                  const content = column.render(row);
                  const className = column.numeric ? styles.number : undefined;
                  const title = column.title?.(row);
                  return column.role === "name" ? (
                    <th
                      key={column.key}
                      scope="row"
                      title={title}
                      data-role="name"
                    >
                      {fit(i, content, true)}
                    </th>
                  ) : (
                    <td
                      key={column.key}
                      className={className}
                      data-role={column.role}
                      title={title}
                    >
                      {fit(
                        i,
                        content,
                        Boolean(title) && column.role !== "state",
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <Pagination {...pager} noun={noun} />
      </div>
    </div>
  );
}

// A name cell, as a card's title: the id first (a link, when the thing has
// a page) with an optional tag beside it, and its description under it.
export function ListName({
  name,
  link,
  id,
  tag,
}: {
  // The label (a description); shown under the id, when it says more.
  name: ReactNode;
  // Renders the first line as a link with the class it is given; absent,
  // plain.
  link?: (className: string, children: ReactNode) => ReactNode;
  // The identity: what the row is called everywhere, first, as on a card's
  // title.
  id?: string;
  tag?: ReactNode;
}) {
  const title = id ?? name;
  return (
    <>
      <span className={styles.nameLine}>
        {link ? (
          link(styles.name, title)
        ) : (
          <span className={styles.name}>{title}</span>
        )}
        {tag}
      </span>
      {id && name !== id && <span className={styles.label}>{name}</span>}
    </>
  );
}

// A label beside a name ("limits hosts"), explained on hover and focus.
export function ListTag({ label, hint }: { label: string; hint: string }) {
  return (
    <span
      className={styles.tag}
      title={hint}
      tabIndex={0}
      aria-label={`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${hint}`}
    >
      {label}
    </span>
  );
}

// The soft text a cell shows when it has nothing ("Not visible", "None").
export function ListSoft({ children }: { children: ReactNode }) {
  return <span className={styles.soft}>{children}</span>;
}
