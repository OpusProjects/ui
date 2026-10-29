// Counts in words, here rather than in the ui package so the non-visual
// helpers (describeUsers) can say them too: ui depends on this package, never
// the reverse, and re-exports both.

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
