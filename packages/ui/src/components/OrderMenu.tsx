import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import type { ListOrder } from "@opusprojects/unified-client";
import page from "./Page.module.css";
import styles from "./ListToolbar.module.css";

export interface OrderOption {
  value: ListOrder;
  label: string;
}

// The orders a list offers: by name, and, given what healthy and what needs
// attention are called there ("Fresh", "Stale"), by health too.
export function orderOptions(health?: [string, string]): OrderOption[] {
  const byName: OrderOption[] = [
    { value: "az", label: "A to Z" },
    { value: "za", label: "Z to A" },
  ];
  if (!health) return byName;
  const [good, bad] = health;
  return [
    ...byName,
    { value: "healthy", label: `${good} to ${bad}` },
    { value: "attention", label: `${bad} to ${good}` },
  ];
}

// "Order", with an icon as every toolbar button has, and a caret: a menu of the ways the list can be ordered, the one
// in use ticked. A menu rather than a select, so it reads as one of the
// toolbar's buttons. Arrows move, Enter or a click picks, Escape or a click
// anywhere else closes it, and focus goes back to the button.
export function OrderMenu({
  value,
  options,
  onChange,
}: {
  value: ListOrder;
  options: OrderOption[];
  onChange: (value: ListOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Under the button, from its left edge; from its right edge instead when
  // that would run off the window (the button wrapped to the right on a
  // phone).
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const box = menu.current?.getBoundingClientRect();
    if (box && box.right > document.documentElement.clientWidth)
      setAlignRight(true);
  }, [open]);

  // Read when the menu opens, not as a dependency: the options are built
  // afresh on every render of the page, and a poll re-rendering it must
  // not pull the focus back from where the arrows took it.
  const current = useRef(0);
  current.current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    if (!open) return;
    // Opened: the item in use takes the focus, as a native menu does.
    items.current[current.current]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onKey = (event: React.KeyboardEvent) => {
    // Closed, the keys are the page's: Home, End and the arrows scroll it,
    // and Escape may close something around it. ArrowDown on the button
    // opens the menu, in the button's own handler.
    if (!open) return;
    const at = items.current.findIndex((i) => i === document.activeElement);
    const move = (to: number) =>
      items.current[(to + options.length) % options.length]?.focus();
    if (event.key === "Escape") close();
    else if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(options.length - 1);
    else if (event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  };

  return (
    <div className={styles.order} ref={root} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className={page.button}
        data-variant="quiet"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={page.buttonIcon} aria-hidden>
          <ArrowUpDown />
        </span>
        Order
        <ChevronDown aria-hidden className={styles.caret} />
      </button>
      {open && (
        <div
          ref={menu}
          className={styles.menu}
          data-align={alignRight ? "right" : undefined}
          role="menu"
          id={menuId}
          aria-label="Order"
        >
          {options.map((option, i) => (
            <button
              key={option.value}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={styles.menuItem}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              <Check aria-hidden className={styles.tick} />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
