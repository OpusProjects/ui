import styles from "./Lift.module.css";

// The class that makes something lift when pointed at (see Lift.module.css).
// Joined onto whatever classes the element already has:
//   <article className={lift(styles.card)}>
export function lift(...classNames: (string | false | undefined)[]): string {
  return [...classNames, styles.lift].filter(Boolean).join(" ");
}
