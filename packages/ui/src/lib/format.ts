// Human wording for the second counts the APIs return.

const UNITS: [number, string][] = [
  [86400, "d"],
  [3600, "h"],
  [60, "m"],
  [1, "s"],
];

// Exact, largest unit first, the parts that are zero left out:
// "43d 23h 4m 3s", "2h", "10m", "0s".
export function formatSpan(seconds: number): string {
  let rest = Math.max(0, Math.round(seconds));
  const parts: string[] = [];
  for (const [size, unit] of UNITS) {
    if (rest >= size) {
      parts.push(`${Math.floor(rest / size)}${unit}`);
      rest %= size;
    }
  }
  return parts.length > 0 ? parts.join(" ") : "0s";
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "never";
  if (seconds < 1) return "just now";
  return `${formatSpan(seconds)} ago`;
}

export function formatEvery(seconds: number | null | undefined): string | null {
  return seconds == null ? null : `every ${formatSpan(seconds)}`;
}

// A count as people read it: thousands grouped with commas, 1,023. Fixed to
// English rather than the browser's locale: toLocaleString() follows the
// language setting, and in Spanish it writes 1023 (no grouping under ten
// thousand) and 10.000, so the same page read differently per reader.
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return COUNT.format(n);
}

// A count with its noun, singular for one: "1 host", "1,023 hosts".
export function countOf(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

// 1024-based, one decimal while under 10 of a unit (2.4 MB, 37 MB).
export function formatBytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 && index > 0 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}
