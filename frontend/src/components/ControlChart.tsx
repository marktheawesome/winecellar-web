import { useMemo, useCallback, useRef } from "react";
import {
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";
import type { ControlLimits, Reading, NelsonViolation, Metric } from "../api/types";
import { METRIC_LABELS, NELSON_RULE_COLORS } from "../api/types";
import { format } from "date-fns";

interface Props {
  readings: Reading[];
  controlLimits: ControlLimits | null;
  violations: NelsonViolation[];
  metric: Metric;
  enabledRules: Set<number>;
}

interface ChartPoint {
  time: number;
  timeLabel: string;
  value: number;
  [key: string]: number | string | null;
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "HH:mm:ss");
  } catch {
    return iso;
  }
}

function formatTimeFull(iso: string): string {
  try {
    return format(new Date(iso), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return iso;
  }
}

export default function ControlChart({
  readings,
  controlLimits,
  violations,
  metric,
  enabledRules,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Build violation index lookup: index -> list of rules
  const violationMap = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const v of violations) {
      if (!enabledRules.has(v.rule)) continue;
      for (const idx of v.indices) {
        const existing = map.get(idx) ?? [];
        existing.push(v.rule);
        map.set(idx, existing);
      }
    }
    return map;
  }, [violations, enabledRules]);

  // Prepare chart data
  const data: ChartPoint[] = useMemo(() => {
    return readings.map((r, i) => {
      const point: ChartPoint = {
        time: new Date(r.time_utc).getTime(),
        timeLabel: r.time_utc,
        value: r[metric] as number,
      };
      // Add violation scatter points for each rule
      const rules = violationMap.get(i);
      if (rules) {
        for (const rule of rules) {
          point[`violation_r${rule}`] = r[metric] as number;
        }
      }
      return point;
    });
  }, [readings, metric, violationMap]);

  // Unique violated rules in data
  const activeViolationRules = useMemo(() => {
    const rules = new Set<number>();
    for (const v of violations) {
      if (enabledRules.has(v.rule) && v.indices.length > 0) {
        rules.add(v.rule);
      }
    }
    return Array.from(rules).sort();
  }, [violations, enabledRules]);

  const metricLabel = METRIC_LABELS[metric] ?? metric;

  const handleExportChart = useCallback(() => {
    const svgEl = chartRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spc_chart_${metric}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metric]);

  if (readings.length === 0) {
    return (
      <div style={styles.empty}>
        No data to display. Select a device and time range.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>{metricLabel} Control Chart</h3>
        <button style={styles.exportBtn} onClick={handleExportChart}>
          Export SVG
        </button>
      </div>
      <div ref={chartRef} style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(ts: number) => format(new Date(ts), "HH:mm")}
              stroke="#555"
              fontSize={11}
            />
            <YAxis
              stroke="#555"
              fontSize={11}
              domain={["auto", "auto"]}
              label={{
                value: metricLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#888",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6 }}
              labelFormatter={(ts: number) => formatTimeFull(new Date(ts).toISOString())}
              formatter={(val: number, name: string) => {
                if (name === "value") return [val.toFixed(3), metricLabel];
                return [val.toFixed(3), name];
              }}
            />

            {/* Control limit reference lines */}
            {controlLimits && (
              <>
                <ReferenceLine
                  y={controlLimits.mean}
                  stroke="#4ade80"
                  strokeDasharray="8 4"
                  label={{ value: "X\u0304", position: "right", fill: "#4ade80", fontSize: 11 }}
                />
                <ReferenceLine y={controlLimits.ucl_1sigma} stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={controlLimits.lcl_1sigma} stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine
                  y={controlLimits.ucl_2sigma}
                  stroke="#fb923c"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: "+2\u03c3", position: "right", fill: "#fb923c", fontSize: 10 }}
                />
                <ReferenceLine
                  y={controlLimits.lcl_2sigma}
                  stroke="#fb923c"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: "-2\u03c3", position: "right", fill: "#fb923c", fontSize: 10 }}
                />
                <ReferenceLine
                  y={controlLimits.ucl_3sigma}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: "UCL", position: "right", fill: "#ef4444", fontSize: 11 }}
                />
                <ReferenceLine
                  y={controlLimits.lcl_3sigma}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  label={{ value: "LCL", position: "right", fill: "#ef4444", fontSize: 11 }}
                />
              </>
            )}

            {/* Main data line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#818cf8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />

            {/* Violation scatter markers */}
            {activeViolationRules.map((rule) => (
              <Scatter
                key={`viol-${rule}`}
                dataKey={`violation_r${rule}`}
                fill={NELSON_RULE_COLORS[rule]}
                shape="diamond"
                isAnimationActive={false}
              />
            ))}

            {/* Brush for zoom/pan */}
            <Brush
              dataKey="time"
              height={24}
              stroke="#7c3aed"
              fill="#0f0f0f"
              tickFormatter={(ts: number) => format(new Date(ts), "HH:mm")}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      {controlLimits && (
        <div style={styles.stats}>
          <Stat label="Mean" value={controlLimits.mean.toFixed(3)} />
          <Stat label="\u03c3" value={controlLimits.sigma.toFixed(4)} />
          <Stat label="UCL (3\u03c3)" value={controlLimits.ucl_3sigma.toFixed(3)} color="#ef4444" />
          <Stat label="LCL (3\u03c3)" value={controlLimits.lcl_3sigma.toFixed(3)} color="#ef4444" />
          <Stat label="Points" value={readings.length.toString()} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color: color ?? "#e0e0e0" }}>{value}</span>
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
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: 600, color: "#e0e0e0" },
  exportBtn: {
    padding: "5px 12px",
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
  },
  empty: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
    padding: 40,
    textAlign: "center",
    color: "#666",
  },
  stats: {
    display: "flex",
    gap: 24,
    marginTop: 12,
    flexWrap: "wrap",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statLabel: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
  statValue: { fontSize: 16, fontWeight: 600, fontFamily: "monospace" },
};
