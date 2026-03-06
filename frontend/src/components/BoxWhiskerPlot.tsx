import { useMemo } from "react";
import { ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Customized } from "recharts";
import type { Reading, Metric } from "../api/types";
import { METRIC_LABELS } from "../api/types";
import type { GroupBy, BoxStats } from "../utils/stats";
import { computeBoxStats, groupValues } from "../utils/stats";

const GRID = "#f1f5f9"; const TICK = "#94a3b8";

interface Props { readings: Reading[]; metric: Metric; groupBy: GroupBy; }

export default function BoxWhiskerPlot({ readings, metric, groupBy }: Props) {
  const data = useMemo(() => {
    const g = groupValues(readings, metric, groupBy);
    return Array.from(g.entries()).sort(([a],[b]) => a < b ? -1 : 1)
      .map(([l, v]) => computeBoxStats(v, l)).filter((v): v is BoxStats => v !== null)
      .map(v => ({ ...v, median: v.median }));
  }, [readings, metric, groupBy]);

  const yDomain = useMemo<[number, number]>(() => {
    if (!data.length) return [0,1];
    let lo = Infinity, hi = -Infinity;
    for (const d of data) { lo = Math.min(lo, d.min, ...d.outliers); hi = Math.max(hi, d.max, ...d.outliers); }
    const pad = (hi - lo) * 0.05 || 0.5;
    return [lo - pad, hi + pad];
  }, [data]);

  if (!data.length) return <div className="empty"><p>No data for box plot.</p></div>;
  const label = METRIC_LABELS[metric] ?? metric;

  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Box & Whisker</span><span style={{ fontSize: 11, color: TICK }}>{label}</span></div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: -5, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" stroke="transparent" fontSize={10} tick={{ fill: TICK }} />
            <YAxis stroke="transparent" fontSize={11} domain={yDomain} tick={{ fill: TICK }} width={42} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as BoxStats;
              return (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{p.label}</div>
                  <div>Count: {p.count}</div><div>Min: {p.min.toFixed(3)}</div><div>Q1: {p.q1.toFixed(3)}</div>
                  <div>Median: {p.median.toFixed(3)}</div><div>Q3: {p.q3.toFixed(3)}</div><div>Max: {p.max.toFixed(3)}</div>
                </div>
              );
            }} />
            <Scatter dataKey="median" fill="#000" fillOpacity={0.01} isAnimationActive={false} />
            <Customized component={Boxes} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Boxes(props: any) {
  const { xAxisMap, yAxisMap, data } = props;
  const xa = xAxisMap?.[Object.keys(xAxisMap)[0]], ya = yAxisMap?.[Object.keys(yAxisMap)[0]];
  if (!xa || !ya) return null;
  const xs = xa.scale, ys = ya.scale;
  const bw = typeof xs.bandwidth === "function" ? xs.bandwidth() : 20;
  const w = Math.max(8, bw * 0.55);
  return (
    <g>{data.map((d: BoxStats) => {
      const cx = xs(d.label) + bw/2, q1 = ys(d.q1), q3 = ys(d.q3), med = ys(d.median), mn = ys(d.min), mx = ys(d.max);
      return (
        <g key={d.label}>
          <line x1={cx} x2={cx} y1={mn} y2={q1} stroke="#94a3b8" />
          <line x1={cx} x2={cx} y1={q3} y2={mx} stroke="#94a3b8" />
          <line x1={cx-w/4} x2={cx+w/4} y1={mn} y2={mn} stroke="#94a3b8" />
          <line x1={cx-w/4} x2={cx+w/4} y1={mx} y2={mx} stroke="#94a3b8" />
          <rect x={cx-w/2} y={q3} width={w} height={Math.max(1,q1-q3)} fill="#eef2ff" stroke="#4f46e5" rx={2} />
          <line x1={cx-w/2} x2={cx+w/2} y1={med} y2={med} stroke="#0f172a" strokeWidth={1.5} />
          {d.outliers.map((v,i) => <circle key={i} cx={cx} cy={ys(v)} r={2.5} fill="#dc2626" />)}
        </g>
      );
    })}</g>
  );
}
