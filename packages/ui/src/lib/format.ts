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

// Counts are worded in the client package, whose describeUsers says them
// too (it cannot import from here: this package depends on it). Re-exported
// so every component keeps importing its wording from this one file.
export { countOf, formatCount } from "@opusprojects/unified-client";

// A cron expression (UTC, with an optional seconds field first) in words,
// as an interval reads: "every 2h", "daily at 04:15 UTC", "Mon–Fri at 06:00
// UTC". Null when it is too irregular to say plainly; the caller then shows
// the expression itself.
export function formatSchedule(expression: string): string | null {
  const MACROS: Record<string, string> = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
  };
  const trimmed = expression.trim();
  const parts = (MACROS[trimmed.toLowerCase()] ?? trimmed).split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return null;
  const [sec, min, hour, dom, month, dow] =
    parts.length === 6 ? parts : ["0", ...parts];
  const any = (f: string) => f === "*" || f === "?";
  const step = (f: string) => /^\*\/(\d+)$/.exec(f)?.[1];
  const nums = (f: string, names: string[] = []) => {
    const out: number[] = [];
    for (const item of f.split(",")) {
      // A name is matched whole: on its first three letters alone, FRI#2,
      // FRIL and MON-FRI/2 all read as plain Fri or Mon. Anything not
      // understood is NaN, so the expression is shown as written.
      const value = (v: string) => {
        const named = v ? names.indexOf(v.toLowerCase()) : -1;
        return named >= 0 ? named : /^\d+$/.test(v) ? Number(v) : NaN;
      };
      const range = /^(\w+)-(\w+)$/.exec(item);
      if (range) {
        const [a, b] = [value(range[1]), value(range[2])];
        if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
        for (let n = a; n <= b; n++) out.push(n);
      } else {
        const n = value(item);
        if (Number.isNaN(n)) return null;
        out.push(n);
      }
    }
    return out;
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const and = (items: string[]) =>
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

  const seconds = sec === "0" ? 0 : null;
  // A step is an even interval only when it divides its field's range: */7
  // hours runs at 00, 07, 14 and 21, then 3h later at 00 again; that is no
  // "every 7h", and it is shown as written instead.
  const even = (n: string | undefined, range: number) =>
    n !== undefined && Number(n) > 0 && range % Number(n) === 0;
  // Every N seconds, minutes or hours: an interval, said as one.
  if (any(dom) && any(month) && any(dow)) {
    const s = step(sec);
    if (s && any(min) && any(hour))
      return even(s, 60) ? formatEvery(Number(s)) : null;
    if (seconds === 0 && any(hour)) {
      const m = step(min);
      if (m) return even(m, 60) ? formatEvery(Number(m) * 60) : null;
      if (any(min)) return formatEvery(60);
    }
    const h = step(hour);
    if (h && !even(h, 24)) return null;
    const at = nums(min);
    if (seconds === 0 && (h || any(hour)) && at?.length === 1) {
      const every = formatEvery((h ? Number(h) : 1) * 3600);
      return at[0] === 0 ? every : `${every}, at :${pad(at[0])}`;
    }
  }

  // At fixed times of day.
  const minutes = nums(min);
  const hours = nums(hour);
  if (seconds !== 0 || !minutes || !hours || minutes.length !== 1) return null;
  const times = `${and(hours.map((h) => `${pad(h)}:${pad(minutes[0])}`))} UTC`;
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = [
    "",
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const MONTH_NAMES = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const ordinal = (n: number) =>
    `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

  if (any(dom) && any(month)) {
    if (any(dow)) return `daily at ${times}`;
    // Monday to Sunday, Sunday as 7 whether written 0 or 7, so a range
    // ending on Sunday stays one ("Fri–Sun"); all seven are every day.
    // Deduplicated after the mapping, or 0,7 reads "Sun and Sun".
    const named = nums(dow, DAYS);
    if (!named) return null;
    const days = [...new Set(named.map((d) => d % 7 || 7))];
    days.sort((a, b) => a - b);
    if (days.length === 7) return `daily at ${times}`;
    const runs =
      days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)
        ? `${DAY_NAMES[days[0]]}–${DAY_NAMES[days[days.length - 1]]}`
        : days.length === 1
          ? `every ${DAY_NAMES[days[0]]}`
          : and(days.map((d) => DAY_NAMES[d]));
    return `${runs} at ${times}`;
  }
  if (!any(dow)) return null;
  const dates = nums(dom);
  if (!dates || dates.length !== 1) return null;
  if (any(month)) return `monthly on the ${ordinal(dates[0])} at ${times}`;
  const months = nums(month, MONTHS);
  if (!months || months.length !== 1 || !MONTH_NAMES[months[0]]) return null;
  return `yearly on ${dates[0]} ${MONTH_NAMES[months[0]]} at ${times}`;
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
