// Human wording for the second counts the APIs return.

const UNITS: [number, string][] = [
  [86400, "d"],
  [3600, "h"],
  [60, "min"],
];

export function formatSpan(seconds: number): string {
  for (const [size, unit] of UNITS) {
    if (seconds >= size) {
      const value = seconds / size;
      // One decimal only where it changes the reading (1.5 h, not 1 h).
      const rounded =
        value < 10 && value % 1 >= 0.25
          ? value.toFixed(1)
          : Math.round(value).toString();
      return `${rounded} ${unit}`;
    }
  }
  return `${Math.round(seconds)} s`;
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "never";
  if (seconds < 10) return "just now";
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
