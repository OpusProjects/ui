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
