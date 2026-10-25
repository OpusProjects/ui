import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Pagination.module.css";

export const PAGE_SIZES = [10, 20, 50, 100] as const;

interface PaginationProps {
  // Zero-based page index.
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  // What is being paged, for the count and the buttons' labels: "hosts".
  noun: string;
}

// "51–100 of 1,190 hosts", rows per page, and previous/next. Hidden when the
// list fits the smallest page: a pager with nothing to page is noise.
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  noun,
}: PaginationProps) {
  if (total <= PAGE_SIZES[0]) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <nav className={styles.pager} aria-label={`${noun} pages`}>
      <span className={styles.count}>
        {first.toLocaleString()}–{last.toLocaleString()} of{" "}
        {total.toLocaleString()} {noun}
      </span>
      <span className={styles.buttons}>
        <label className={styles.size}>
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label={`Previous ${noun}`}
        >
          <ChevronLeft aria-hidden />
        </button>
        <span className={styles.position}>
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          aria-label={`Next ${noun}`}
        >
          <ChevronRight aria-hidden />
        </button>
      </span>
    </nav>
  );
}

const STORAGE_PREFIX = "unified-ui:page-size:";

// Rows per page for one list. The viewer's own choice when they made one
// (kept per list, in this browser); otherwise the largest standard size
// whose rows fit in the window below roughly where the list starts, so a
// laptop gets 10 and a tall monitor 20 without anyone choosing.
export function usePageSize(list: string, rowHeight: number, reserved = 420) {
  const key = STORAGE_PREFIX + list;
  const [size, setSize] = useState<number>(() => {
    try {
      const stored = Number(window.localStorage.getItem(key));
      if ((PAGE_SIZES as readonly number[]).includes(stored)) return stored;
    } catch {
      // Storage unavailable: fall through to the fitted size.
    }
    const fitting = Math.floor((window.innerHeight - reserved) / rowHeight);
    return [...PAGE_SIZES].reverse().find((s) => s <= fitting) ?? PAGE_SIZES[0];
  });

  const choose = (next: number) => {
    setSize(next);
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // Only a preference; nothing to report.
    }
  };
  return [size, choose] as const;
}
