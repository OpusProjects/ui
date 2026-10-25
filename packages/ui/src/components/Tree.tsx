import type { ReactNode } from "react";
import styles from "./Tree.module.css";

// A hierarchy drawn as nodes joined by lines: the root on the left, each
// level of children in a column to its right. On a narrow screen the levels
// stack and indent instead. The lines are borders, not SVG, so they follow
// whatever height the node cards end up being.
//
// Generic on purpose: a federation of instances, a project's dependency
// chain, anything with one parent per node.

export interface TreeItem {
  key: string;
  node: ReactNode;
  children?: TreeItem[];
}

export function Tree({ root, label }: { root: TreeItem; label: string }) {
  return (
    <ul className={styles.tree} aria-label={label}>
      <Branch item={root} />
    </ul>
  );
}

function Branch({ item }: { item: TreeItem }) {
  const children = item.children ?? [];
  return (
    <li className={styles.item}>
      <div className={styles.node}>{item.node}</div>
      {children.length > 0 && (
        <ul className={styles.children}>
          {children.map((child) => (
            <Branch key={child.key} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
