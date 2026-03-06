import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Reading, Metric } from "../api/types";
import { METRIC_LABELS } from "../api/types";
import { computeHistogram, valuesFromReadings } from "../utils/stats";

interface Props {
  readings: Reading[];
  metric: Metric;
  bins?: number;
}

export default function HistogramChart({ readings, metric, bins = 20 }: Props) {
  const data = useMemo(() => {
    const values = valuesFromReadings(readings, metric);
    return computeHistogram(values, bins);
  }, [readings, metric, bins]);

  if (data.length === 0) {
    return <div style={styles.empty}>No data for histogram.</div>;
  }

  const metricLabel = METRIC_LABELS[metric] ?? metric;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Histogram</h3>
        <span style={styles.subtitle}>{metricLabel}</span>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="label" stroke="#555" fontSize={10} interval={Math.max(0, Math.floor(data.length / 8))} />
            <YAxis stroke="#555" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6 }}
              formatter={(val: number) => [val, "Count"]}
            />
            <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
    padding: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: 600, color: "#e0e0e0" },
  subtitle: { fontSize: 11, color: "#666" },
  empty: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
    padding: 30,
    textAlign: "center",
    color: "#666",
  },
};
