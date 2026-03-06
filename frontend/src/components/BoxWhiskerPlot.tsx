import { useMemo } from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  Customized,
} from "recharts";
import type { Reading, Metric } from "../api/types";
import { METRIC_LABELS } from "../api/types";
import type { GroupBy, BoxStats } from "../utils/stats";
import { computeBoxStats, groupValues } from "../utils/stats";

interface Props {
  readings: Reading[];
  metric: Metric;
  groupBy: GroupBy;
}

interface BoxDataPoint extends BoxStats {
  median: number;
}

export default function BoxWhiskerPlot({ readings, metric, groupBy }: Props) {
  const data = useMemo<BoxDataPoint[]>(() => {
    const grouped = groupValues(readings, metric, groupBy);
    const entries = Array.from(grouped.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([label, values]) => computeBoxStats(values, label))
      .filter((v): v is BoxStats => v !== null)
      .map((v) => ({ ...v, median: v.median }));
    return entries;
  }, [readings, metric, groupBy]);

  const yDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
      lo = Math.min(lo, d.min, ...d.outliers);
      hi = Math.max(hi, d.max, ...d.outliers);
    }
    const pad = (hi - lo) * 0.05 || 0.5;
    return [lo - pad, hi + pad];
  }, [data]);

  if (data.length === 0) {
    return <div style={styles.empty}>No data for box plot.</div>;
  }

  const metricLabel = METRIC_LABELS[metric] ?? metric;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Distribution (Box and Whisker)</h3>
        <span style={styles.subtitle}>{metricLabel}</span>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="label" stroke="#555" fontSize={10} />
            <YAxis
              stroke="#555"
              fontSize={11}
              domain={yDomain}
              allowDataOverflow={false}
              label={{
                value: metricLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#888",
                fontSize: 11,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0].payload as BoxStats;
                return (
                  <div style={styles.tooltip}>
                    <div style={styles.tooltipTitle}>{p.label}</div>
                    <div style={styles.tooltipLine}>Count: {p.count}</div>
                    <div style={styles.tooltipLine}>Min: {p.min.toFixed(3)}</div>
                    <div style={styles.tooltipLine}>Q1: {p.q1.toFixed(3)}</div>
                    <div style={styles.tooltipLine}>Median: {p.median.toFixed(3)}</div>
                    <div style={styles.tooltipLine}>Q3: {p.q3.toFixed(3)}</div>
                    <div style={styles.tooltipLine}>Max: {p.max.toFixed(3)}</div>
                  </div>
                );
              }}
            />
            <Scatter dataKey="median" fill="#000" fillOpacity={0.01} isAnimationActive={false} />
            <Customized component={BoxWhiskerShapes} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BoxWhiskerShapes(props: any) {
  const { xAxisMap, yAxisMap, data } = props;
  const xAxis = xAxisMap[Object.keys(xAxisMap)[0]];
  const yAxis = yAxisMap[Object.keys(yAxisMap)[0]];
  if (!xAxis || !yAxis) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;
  const bandwidth = typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 20;
  const boxWidth = Math.max(8, bandwidth * 0.55);

  return (
    <g>
      {data.map((d: BoxStats) => {
        const xCenter = xScale(d.label) + bandwidth / 2;
        const yQ1 = yScale(d.q1);
        const yQ3 = yScale(d.q3);
        const yMedian = yScale(d.median);
        const yMin = yScale(d.min);
        const yMax = yScale(d.max);
        const boxHeight = Math.max(1, yQ1 - yQ3);

        return (
          <g key={d.label}>
            <line x1={xCenter} x2={xCenter} y1={yMin} y2={yQ1} stroke="#9ca3af" strokeWidth={1} />
            <line x1={xCenter} x2={xCenter} y1={yQ3} y2={yMax} stroke="#9ca3af" strokeWidth={1} />
            <line x1={xCenter - boxWidth / 4} x2={xCenter + boxWidth / 4} y1={yMin} y2={yMin} stroke="#9ca3af" strokeWidth={1} />
            <line x1={xCenter - boxWidth / 4} x2={xCenter + boxWidth / 4} y1={yMax} y2={yMax} stroke="#9ca3af" strokeWidth={1} />

            <rect
              x={xCenter - boxWidth / 2}
              y={yQ3}
              width={boxWidth}
              height={boxHeight}
              fill="#1f2937"
              stroke="#818cf8"
              strokeWidth={1}
            />
            <line x1={xCenter - boxWidth / 2} x2={xCenter + boxWidth / 2} y1={yMedian} y2={yMedian} stroke="#e5e7eb" strokeWidth={1} />

            {d.outliers.map((v, i) => (
              <circle key={`${d.label}-o-${i}`} cx={xCenter} cy={yScale(v)} r={2.2} fill="#ef4444" />
            ))}
          </g>
        );
      })}
    </g>
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
  tooltip: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 10px",
    color: "#e0e0e0",
    fontSize: 12,
  },
  tooltipTitle: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  tooltipLine: { fontSize: 11, color: "#c7c7c7" },
};
