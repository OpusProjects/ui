import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import styles from "./AppShell.module.css";

interface AppShellProps {
  product: string;
  version?: string;
  nav: ReactNode;
  footer?: ReactNode;
  // Makes the product name a link to the app's home: given the name and
  // its class, returns the app's own link (its router's Link), as
  // ResourceCard's titleLink does, so the library stays out of routing.
  homeLink?: (content: ReactNode, className: string) => ReactNode;
  // Under the product name, above the sections: a search reachable from
  // every page.
  search?: ReactNode;
  children: ReactNode;
}

// The frame every unified-* product shares: a rail naming the product and its
// version, the product's own navigation, and the page.
export function AppShell({
  product,
  version,
  nav,
  footer,
  homeLink,
  search,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.brand}>
          {homeLink ? (
            homeLink(product, `${styles.product} ${styles.productLink}`)
          ) : (
            <span className={styles.product}>{product}</span>
          )}
          {version && <span className={styles.version}>v{version}</span>}
        </div>
        {search && <div className={styles.search}>{search}</div>}
        <nav className={styles.nav} aria-label="Main">
          {nav}
        </nav>
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

// Polymorphic so the library stays router-agnostic: pass `as={Link}` and the
// router's own props (`to`, ...) and the rail styles a router link, or leave it
// as a plain anchor for links that leave the app.
type RailItemProps<T extends ElementType> = {
  as?: T;
  icon: ReactNode;
  label: string;
  active?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function RailItem<T extends ElementType = "a">({
  as,
  icon,
  label,
  active,
  ...rest
}: RailItemProps<T>) {
  const Component: ElementType = as ?? "a";
  return (
    <Component
      className={styles.item}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      {...rest}
    >
      <span className={styles.icon} aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </Component>
  );
}
