import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import styles from "./Detail.module.css";

// A whole value that is a web address: nothing before or after it, http or
// https only (never javascript: or a data: URL).
const URL = /^https?:\/\/[^\s<>"]+$/;

// A value as a fact shows it: a web address becomes a link out, opened in a
// new tab with the external-link icon, like the other ways out of the app;
// anything else is shown as it is.
export function linkify(value: ReactNode): ReactNode {
  if (typeof value !== "string" || !URL.test(value)) return value;
  return (
    <a
      className={`${styles.link} ${styles.out}`}
      href={value}
      target="_blank"
      rel="noreferrer"
    >
      {value}
      <ExternalLink aria-hidden />
    </a>
  );
}
