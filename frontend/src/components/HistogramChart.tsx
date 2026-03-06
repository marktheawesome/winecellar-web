import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Reading, Metric } from "../api/types";
import { METRIC_LABELS } from "../api/types";
import { computeHistogram, valuesFromReadings } from "../utils/stats";

const GRID = "#f1f5f9"; const TICK = "#94a3b8";

interface Props { readings: Reading[]; metric: Metric; bins?: number; }

export default function HistogramChart({ readings, metric, bins = 20 }: Props) {
  const data = useMemo(() => computeHistogram(valuesFromReadings(readings, metric), bins), [readings, metric, bins]);
  if (!data.length) return <div className="empty"><p>No data for histogram.</p></div>;
  const label = METRIC_LABELS[metric] ?? metric;

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Histogram</span><span style={{ fontSize: 11, color: TICK }}>{label}</span></div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: -5, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" stroke="transparent" fontSize={10} interval={Math.max(0, Math.floor(data.length/8))} tick={{ fill: TICK }} />
            <YAxis stroke="transparent" fontSize={11} tick={{ fill: TICK }} width={32} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(val: number) => [val, "Count"]} />
            <Bar dataKey="count" fill="#0891b2" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
