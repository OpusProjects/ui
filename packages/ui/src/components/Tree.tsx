import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./Tree.module.css";

// A hierarchy drawn as nodes joined by lines: the root on the left, each
// level of children in a column to its right, each child joined to its parent
// by its own straight line (as AWX draws a workflow), so a link's state is
// that link's alone. Where that does not fit the page, the levels stack and
// indent instead, with border lines down the left.
//
// Generic on purpose: a federation of instances, a project's dependency
// chain, anything with one parent per node.

export interface TreeItem {
  key: string;
  node: ReactNode;
  children?: TreeItem[];
  // The state of the line from the parent to this node: "ok" draws it green,
  // "failing" red. Left out, it is a plain neutral line.
  link?: "ok" | "failing";
  // When data last moved along that line (ms since the epoch): a dot runs
  // from the parent to this node each time it moves on. Left out, none.
  pulse?: number;
}

// The gap between levels (Tree.module.css --tree-gap), what a line keeps
// beyond it on a wide screen, and the widest a card grows to fill one.
const LINE_GAP = 96;
const LINE_SLACK = 64;
const MAX_CARD = 760;

export function Tree({ root, label }: { root: TreeItem; label: string }) {
  const list = useRef<HTMLUListElement>(null);
  // Every card as wide as the widest one's own content (each on one line,
  // capped by the CSS), so the root and its children line up and none
  // stretches across the page. Then, if the levels side by side are wider
  // than the page, the tree stacks instead (indented, lines down the left)
  // rather than scrolling sideways: decided by measuring, so it holds for
  // any number of levels and any width of card, not one window size.
  // Done again after every render (what the cards hold changes), when the
  // fonts are in, and when the space changes.
  useLayoutEffect(() => {
    const tree = list.current;
    if (!tree) return;
    const layout = () => {
      tree.removeAttribute("data-stacked");
      tree.removeAttribute("data-matched");
      let widest = 0;
      let deepest = 0;
      tree.querySelectorAll("[data-tree-node]").forEach((node) => {
        widest = Math.max(widest, node.getBoundingClientRect().width);
        let depth = 0;
        for (
          let el = node.parentElement;
          el && el !== tree;
          el = el.parentElement
        )
          if (el.tagName === "UL") depth += 1;
        deepest = Math.max(deepest, depth);
      });
      // On a wide screen the cards take the room rather than the lines:
      // each level a share of the width, its line kept near its usual
      // length, up to a ceiling past which a card is only blank space.
      const levels = deepest + 1;
      const share =
        (tree.clientWidth - (levels - 1) * (LINE_GAP + LINE_SLACK)) / levels;
      const width = Math.max(widest, Math.min(share, MAX_CARD));
      tree.style.setProperty("--tree-card-width", `${Math.floor(width)}px`);
      tree.setAttribute("data-matched", "");
      if (tree.scrollWidth > tree.clientWidth + 1)
        tree.setAttribute("data-stacked", "");
    };
    layout();
    void document.fonts?.ready.then(layout);
    let width = tree.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      // Only a change of width: stacking changes the height, and must not
      // start it all again. On the next frame, so what it changes is not
      // reported to observers in the same pass.
      if (tree.clientWidth === width) return;
      width = tree.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    });
    observer.observe(tree);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
  return (
    <ul className={styles.tree} aria-label={label} ref={list}>
      <Branch item={root} />
    </ul>
  );
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Where each line runs, in the branch's own coordinates: from the middle of
// the parent's right edge to the middle of each child's left edge. Measured
// after layout and again whenever the branch resizes (a card's text wrapping,
// the window), since the cards decide their own heights. `keys` names the
// children: a child swapped for another (one peer for another, as many as
// before) is a new element to find and watch, not only a new count.
function useLines(ref: React.RefObject<HTMLLIElement | null>, keys: string) {
  const [lines, setLines] = useState<Line[]>([]);
  useLayoutEffect(() => {
    const branch = ref.current;
    if (!branch || keys === "") return;
    // The card itself, not its wrapper: the line meets the card's edge.
    const card = (node: Element) => node.firstElementChild ?? node;
    const parent = branch.querySelector(":scope > [data-tree-node]");
    const children = Array.from(
      branch.querySelectorAll(":scope > ul > li > [data-tree-node]"),
    );
    if (!parent) return;
    const measure = () => {
      const origin = branch.getBoundingClientRect();
      const from = card(parent).getBoundingClientRect();
      const next = children.map((child) => {
        const to = card(child).getBoundingClientRect();
        return {
          x1: from.right - origin.left,
          y1: from.top + from.height / 2 - origin.top,
          x2: to.left - origin.left,
          y2: to.top + to.height / 2 - origin.top,
        };
      });
      setLines((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    measure();
    // Every card, not only the branch: the root card widening once its data
    // is in moves the children right without the branch changing size, and
    // the lines were left ending short of them.
    const observer = new ResizeObserver(measure);
    observer.observe(branch);
    for (const node of [parent, ...children]) observer.observe(card(node));
    return () => observer.disconnect();
  }, [ref, keys]);
  return lines;
}

function Branch({ item }: { item: TreeItem }) {
  const children = item.children ?? [];
  const ref = useRef<HTMLLIElement>(null);
  const lines = useLines(ref, children.map((child) => child.key).join("\n"));
  return (
    <li className={styles.item} data-link={item.link} ref={ref}>
      <div className={styles.node} data-tree-node>
        {item.node}
      </div>
      {children.length > 0 && (
        <>
          <svg className={styles.links} aria-hidden>
            {lines.map((line, i) => (
              <line
                key={children[i]?.key ?? i}
                {...line}
                className={styles.link}
                data-link={children[i]?.link}
              />
            ))}
            <Pulses
              lines={lines}
              keys={children.map((child) => child.key)}
              pulses={children.map((child) =>
                child.link === "ok" ? child.pulse : undefined,
              )}
            />
          </svg>
          <ul className={styles.children}>
            {children.map((child) => (
              <Branch key={child.key} item={child} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

// Seconds a dot takes along a line.
const TRIP_SECONDS = 2.4;

// On first showing the page, a pull this recent still gets its dot: it is
// news; an older one is not.
const RECENT_MS = 60_000;

// How far apart two readings of the same pull can land. A `pulse` is
// worked out from an age in whole seconds, measured by the server before
// its answer (a walk that asks every peer) arrived: one pull reads up to a
// second or two off, more on a slow answer. Pulls on one link come a sync
// interval apart, far more than this.
const SAME_PULL_MS = 10_000;

// A dot along each line whose data has just moved: one trip each time its
// `pulse` moves on, so a busy link shows often and a quiet one stays still.
function Pulses({
  lines,
  keys,
  pulses,
}: {
  lines: Line[];
  // The children's keys: each dot stays with its own link, so one swapped
  // for another starts afresh instead of reading the old one's pulls.
  keys: string[];
  pulses: (number | undefined)[];
}) {
  // One gradient per tree drawing: ids are document-wide.
  const glow = useId();
  return (
    <g className={styles.pulses}>
      {/* A soft light rather than a disc: white at the heart, fading through
          the line's green to nothing, no edge anywhere. */}
      <defs>
        <radialGradient id={glow}>
          <stop offset="0%" className={styles.pulseCore} />
          <stop offset="35%" className={styles.pulseMid} />
          <stop offset="100%" className={styles.pulseEdge} />
        </radialGradient>
      </defs>
      {lines.map((line, i) => (
        <Pulse
          key={keys[i] ?? i}
          line={line}
          at={pulses[i]}
          fill={`url(#${CSS.escape(glow)})`}
        />
      ))}
    </g>
  );
}

function Pulse({ line, at, fill }: { line: Line; at?: number; fill: string }) {
  const group = useRef<SVGGElement>(null);
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (at == null || !group.current) return;
    const first = seen.current === undefined;
    const newer = !first && at > seen.current! + SAME_PULL_MS;
    seen.current = Math.max(at, seen.current ?? 0);
    if (!newer && !(first && Date.now() - at < RECENT_MS)) return;
    // One trip, started now (the Web Animations API, which starts when told
    // to; an SVG animation added after the page loaded counted as long
    // over): along the line, fading in as it leaves and out as it arrives.
    group.current.animate(
      [
        { transform: `translate(${line.x1}px, ${line.y1}px)`, opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { opacity: 1, offset: 0.9 },
        { transform: `translate(${line.x2}px, ${line.y2}px)`, opacity: 0 },
      ],
      { duration: TRIP_SECONDS * 1000, easing: "linear" },
    );
    // Only a new pull starts a trip; the line moving under it does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  return (
    <g ref={group} opacity={0}>
      <circle r={6} fill={fill} />
      <circle r={2} className={styles.pulseCoreDot} />
    </g>
  );
}
