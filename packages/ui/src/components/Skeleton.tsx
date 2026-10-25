import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import styles from "./Skeleton.module.css";

// Loading placeholders shaped like what will replace them, so the page does
// not jump when the data lands.

const CARD_MIN_WIDTH = 330; // matches CardGrid's minmax
const CARD_HEIGHT = 300; // a typical ResourceCard
const GAP = 16;

// How many cards fill what the viewer can see: the columns the grid will
// actually lay out at this width, times the rows that fit below its top edge.
// Recomputed on resize, so a phone gets two placeholders and a wide monitor a
// dozen, never a scrollbar of grey boxes.
function useFittingCount(ref: RefObject<HTMLElement | null>) {
  const [count, setCount] = useState(6);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const columns =
        width <= 420
          ? 1
          : Math.max(1, Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP)));
      const top = element.getBoundingClientRect().top;
      const rows = Math.max(
        1,
        Math.ceil((window.innerHeight - top) / (CARD_HEIGHT + GAP)),
      );
      setCount(columns * rows);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return count;
}

const STORAGE_PREFIX = "unified-ui:count:";

// How many items a section had last time, per browser. A section with three
// projects should not flash twelve placeholders. Storage can be missing or
// refuse (private mode); the placeholders then just fill the screen.
export function useRememberedCount(
  section: string,
  current: number | undefined,
) {
  const key = STORAGE_PREFIX + section;
  const [remembered] = useState<number | null>(() => {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? null : Number(value);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (current === undefined) return;
    try {
      window.localStorage.setItem(key, String(current));
    } catch {
      // Not worth surfacing: it only sizes a loading state.
    }
  }, [key, current]);

  return remembered;
}

interface SkeletonGridProps {
  // Last known number of items, when there is one: the placeholders never
  // outnumber it.
  expected?: number | null;
}

export function SkeletonGrid({ expected }: SkeletonGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fitting = useFittingCount(ref);
  const count =
    expected == null ? fitting : Math.max(1, Math.min(fitting, expected));

  return (
    <div
      ref={ref}
      className={styles.grid}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card} aria-hidden>
          <div className={styles.header}>
            <div>
              <span
                className={styles.bone}
                style={{ width: "62%", height: 17 }}
              />
              <span
                className={styles.bone}
                style={{ width: "38%", height: 12, marginTop: 8 }}
              />
            </div>
            <span
              className={styles.bone}
              style={{ width: 64, height: 22, borderRadius: 999 }}
            />
          </div>
          {[70, 55, 48, 60].map((width, row) => (
            <div key={row} className={styles.row}>
              <span className={styles.bone} style={{ width: 72, height: 12 }} />
              <span
                className={styles.bone}
                style={{ width: `${width}%`, height: 12 }}
              />
            </div>
          ))}
          <div className={styles.footer}>
            <span className={styles.bone} style={{ width: 92, height: 28 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSummary() {
  return (
    <div className={styles.summary} aria-hidden>
      <span
        className={styles.bone}
        style={{ width: 260, maxWidth: "70%", height: 18 }}
      />
      <span
        className={styles.bone}
        style={{ width: "100%", height: 12, marginTop: 14 }}
      />
      <div className={styles.chips}>
        {[90, 140, 80].map((width, index) => (
          <span
            key={index}
            className={styles.bone}
            style={{ width, height: 26, borderRadius: 999 }}
          />
        ))}
      </div>
    </div>
  );
}
