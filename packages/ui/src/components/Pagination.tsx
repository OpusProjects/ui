import { useState } from "react";
import { useSearchParams } from "react-router";
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
  // What is being paged, for the buttons' labels: "hosts".
  noun: string;
}

// "51–100 of 1,190", rows per page, and previous/next. Hidden when the
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
        {total.toLocaleString()}
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
  const initial = (): number => {
    try {
      const stored = Number(window.localStorage.getItem(key));
      if ((PAGE_SIZES as readonly number[]).includes(stored)) return stored;
    } catch {
      // Storage unavailable: fall through to the fitted size.
    }
    const fitting = Math.floor((window.innerHeight - reserved) / rowHeight);
    return [...PAGE_SIZES].reverse().find((s) => s <= fitting) ?? PAGE_SIZES[0];
  };
  // Held with the list it belongs to: one component can page different
  // lists in turn (Hosts | Groups), and each keeps its own size. A new
  // list is read afresh during the render, as React allows for state that
  // follows a prop, so no render shows the old list's size.
  const [held, setHeld] = useState(() => ({ key, size: initial() }));
  let size = held.size;
  if (held.key !== key) {
    size = initial();
    setHeld({ key, size });
  }

  const choose = (next: number) => {
    setHeld({ key, size: next });
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // Only a preference; nothing to report.
    }
  };
  return [size, choose] as const;
}

// One list's paging, whole: the page size (the viewer's choice, or what
// fits), the page, and the rows on it. The page is held within the list as
// it shrinks (a filter, a refetch), so a short list never shows an empty
// page; a new page size starts over at the first page. Spread `pager` into
// <Pagination>.
//
// With `url`, the page lives in the address (`?runs-page=3`), so a link
// opens the same rows: past the first page it carries the page size too
// (`&runs-rows=20`), since a page number alone means other rows at another
// size. Back on the first page, the size stays in the address while it is
// not the viewer's own (it came with a shared link), so going back does
// not change it. Each table has its own key, so a page with several keeps
// them all.
// Moving between pages replaces the history entry: Back leaves the page.
export function usePagination<T>(
  rows: T[],
  list: string,
  {
    url,
    rowHeight = 48,
    reserved,
  }: { url?: string; rowHeight?: number; reserved?: number } = {},
) {
  const [storedSize, setStoredSize] = usePageSize(list, rowHeight, reserved);
  const [params, setParams] = useSearchParams();
  const [localPage, setLocalPage] = useState(0);
  const pageKey = `${url}-page`;
  const rowsKey = `${url}-rows`;

  const urlSize = url ? Number(params.get(rowsKey)) : NaN;
  const pageSize = (PAGE_SIZES as readonly number[]).includes(urlSize)
    ? urlSize
    : storedSize;
  const urlPage = url ? Number(params.get(pageKey)) : NaN;
  const page = url
    ? Number.isInteger(urlPage) && urlPage > 1
      ? urlPage - 1
      : 0
    : localPage;

  // `own`: the size is the viewer's stored one, which needs no address on
  // the first page.
  const go = (next: number, size: number, own: boolean) => {
    if (!url) {
      setLocalPage(next);
      return;
    }
    setParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next > 0) {
          params.set(pageKey, String(next + 1));
          params.set(rowsKey, String(size));
        } else {
          params.delete(pageKey);
          if (own) params.delete(rowsKey);
          else params.set(rowsKey, String(size));
        }
        return params;
      },
      { replace: true },
    );
  };

  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  return {
    shown: rows.slice(current * pageSize, (current + 1) * pageSize),
    pager: {
      page: current,
      pageSize,
      total: rows.length,
      onPage: (next: number) => go(next, pageSize, pageSize === storedSize),
      onPageSize: (size: number) => {
        setStoredSize(size);
        go(0, size, true);
      },
    },
  };
}
