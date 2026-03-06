import type { Reading, Metric } from "../api/types";

export type GroupBy = "range" | "day" | "hour";

export interface BoxStats {
  label: string;
  count: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  outliers: number[];
}

export interface HistogramBin {
  label: string;
  count: number;
  start: number;
  end: number;
}

export function valuesFromReadings(readings: Reading[], metric: Metric): number[] {
  return readings
    .map((r) => r[metric] as number)
    .filter((v) => Number.isFinite(v));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeBoxStats(values: number[], label: string): BoxStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const nonOutliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const min = nonOutliers.length > 0 ? nonOutliers[0] : sorted[0];
  const max = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : sorted[sorted.length - 1];
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  return {
    label,
    count: sorted.length,
    min,
    max,
    q1,
    median,
    q3,
    outliers,
  };
}

export function groupValues(
  readings: Reading[],
  metric: Metric,
  groupBy: GroupBy
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  if (groupBy === "range") {
    const values = valuesFromReadings(readings, metric);
    map.set("All", values);
    return map;
  }

  for (const r of readings) {
    const val = r[metric] as number;
    if (!Number.isFinite(val)) continue;
    const dt = new Date(r.time_utc);
    const label =
      groupBy === "day"
        ? dt.toISOString().slice(0, 10)
        : `${dt.toISOString().slice(0, 13)}:00`;
    const bucket = map.get(label) ?? [];
    bucket.push(val);
    map.set(label, bucket);
  }
  return map;
}

export function computeHistogram(values: number[], binCount = 20): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{
      label: `${min.toFixed(2)}`,
      count: values.length,
      start: min,
      end: max,
    }];
  }

  const bins = Math.max(5, Math.min(60, binCount));
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx] += 1;
  }

  return counts.map((count, i) => {
    const start = min + step * i;
    const end = i === bins - 1 ? max : start + step;
    return {
      label: `${start.toFixed(2)}-${end.toFixed(2)}`,
      count,
      start,
      end,
    };
  });
}
