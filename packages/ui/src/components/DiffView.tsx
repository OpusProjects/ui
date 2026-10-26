import styles from "./DiffView.module.css";

type Line = { kind: "same" | "add" | "remove"; text: string };

// Lines in order, each kept, added or removed: the longest common
// subsequence of the two texts, walked back. Quadratic, which is fine for
// what is diffed here (one object, a few dozen lines).
function diffLines(before: string[], after: string[]): Line[] {
  const n = before.length;
  const m = after.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        before[i] === after[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ kind: "same", text: before[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "remove", text: before[i++] });
    } else {
      out.push({ kind: "add", text: after[j++] });
    }
  }
  while (i < n) out.push({ kind: "remove", text: before[i++] });
  while (j < m) out.push({ kind: "add", text: after[j++] });
  return out;
}

const SIGN = { same: " ", add: "+", remove: "-" };

// Two versions of a text, the way GitHub shows a change: every line once,
// removed lines red with a "-", added lines green with a "+", the rest as
// context. Either side may be empty (a create, a delete).
export function DiffView({
  before,
  after,
  label,
}: {
  before: string;
  after: string;
  label: string;
}) {
  const split = (text: string) =>
    text === "" ? [] : text.replace(/\n$/, "").split("\n");
  const lines = diffLines(split(before), split(after));
  return (
    <pre className={styles.diff} aria-label={label}>
      {lines.map((line, i) => (
        <span key={i} className={styles.line} data-kind={line.kind}>
          <span className={styles.sign} aria-hidden>
            {SIGN[line.kind]}
          </span>
          {/* Read out, as the colours are not: "added", "removed". */}
          {line.kind !== "same" && (
            <span className={styles.hidden}>
              {line.kind === "add" ? "added: " : "removed: "}
            </span>
          )}
          {line.text}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}
