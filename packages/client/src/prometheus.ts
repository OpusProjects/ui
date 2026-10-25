// The Prometheus text exposition, parsed into samples, and the arithmetic a
// page needs on top of it: rates between two scrapes and quantiles from
// histogram buckets. Every unified-* service exports the same format, so this
// lives in the library rather than in one app.

export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface Scrape {
  // Milliseconds since the epoch, taken when the scrape returned.
  at: number;
  samples: Sample[];
}

const LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)/;
const LABEL = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

export function parseExposition(text: string): Sample[] {
  const samples: Sample[] = [];
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const match = LINE.exec(line);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const [, key, raw] of (match[2] ?? "").matchAll(LABEL)) {
      labels[key] = raw.replace(/\\(.)/g, (_, ch: string) =>
        ch === "n" ? "\n" : ch,
      );
    }
    const value = match[3] === "+Inf" ? Infinity : Number(match[3]);
    if (!Number.isNaN(value)) samples.push({ name: match[1], labels, value });
  }
  return samples;
}

type Filter = (labels: Record<string, string>) => boolean;

export function select(
  samples: Sample[],
  name: string,
  filter: Filter = () => true,
) {
  return samples.filter(
    (sample) => sample.name === name && filter(sample.labels),
  );
}

export function sum(samples: Sample[], name: string, filter?: Filter) {
  return select(samples, name, filter).reduce(
    (total, sample) => total + sample.value,
    0,
  );
}

// Per second, between two scrapes of a counter, over the matching series.
// Each series is compared with itself: a series that drops started again
// (the process restarted) and counts from zero; one that is new counts all
// it has (counters appear on their first increment); one that vanished
// adds nothing. Comparing the sums instead read a vanished series as a
// restart, and turned the whole total into a spike.
export function rate(
  earlier: Scrape,
  later: Scrape,
  name: string,
  filter?: Filter,
) {
  const seconds = (later.at - earlier.at) / 1000;
  if (seconds <= 0) return 0;
  const key = (labels: Record<string, string>) =>
    Object.keys(labels)
      .sort()
      .map((k) => `${k}=${labels[k]}`)
      .join(",");
  const before = new Map(
    select(earlier.samples, name, filter).map((s) => [key(s.labels), s.value]),
  );
  let increase = 0;
  for (const sample of select(later.samples, name, filter)) {
    const previous = before.get(key(sample.labels));
    increase +=
      previous === undefined || sample.value < previous
        ? sample.value
        : sample.value - previous;
  }
  return increase / seconds;
}

export interface Quantile {
  value: number;
  // The rank fell in the lowest bucket: all that is known is "under `value`".
  // Interpolating from zero there invents a number (every fast route reads
  // as 4.8 ms with a 5 ms first bucket), so callers should say "< value".
  below: boolean;
}

// The q-quantile of a histogram, as Prometheus's histogram_quantile computes
// it: buckets summed across the matching series, optionally as the increase
// since an earlier scrape, then linear interpolation inside the bucket the
// rank falls in. Null when nothing was observed.
export function histogramQuantile(
  q: number,
  later: Sample[],
  name: string,
  filter: Filter = () => true,
  earlier?: Sample[],
): Quantile | null {
  const buckets = (samples: Sample[]) => {
    const byLe = new Map<number, number>();
    for (const sample of select(samples, `${name}_bucket`, filter)) {
      const le =
        sample.labels.le === "+Inf" ? Infinity : Number(sample.labels.le);
      byLe.set(le, (byLe.get(le) ?? 0) + sample.value);
    }
    return byLe;
  };
  const now = buckets(later);
  const then = earlier ? buckets(earlier) : new Map<number, number>();
  const counts = [...now.entries()]
    .map(
      ([le, count]) => [le, Math.max(0, count - (then.get(le) ?? 0))] as const,
    )
    .sort((a, b) => a[0] - b[0]);
  const total = counts.at(-1)?.[1] ?? 0;
  if (total === 0) return null;

  const rank = q * total;
  let previousLe = 0;
  let previousCount = 0;
  for (const [index, [le, count]] of counts.entries()) {
    if (count >= rank) {
      if (index === 0) return { value: le, below: true };
      // The open-ended bucket has no upper bound to interpolate to; answer
      // with the highest finite one, as Prometheus does.
      if (le === Infinity) return { value: previousLe, below: false };
      const inBucket = count - previousCount;
      const value =
        inBucket === 0
          ? le
          : previousLe +
            ((le - previousLe) * (rank - previousCount)) / inBucket;
      return { value, below: false };
    }
    previousLe = le;
    previousCount = count;
  }
  return { value: previousLe, below: false };
}
