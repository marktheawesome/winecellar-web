import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import {
  ComposedChart, Line, ReferenceLine, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Brush,
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

interface ChartPoint { time: number; value: number; [k: string]: number | string | null; }

const GRID = "#f1f5f9";
const TICK = "#94a3b8";
const TIP_BG = "#ffffff";
const TIP_BD = "#e2e8f0";

function useIsMobile(bp = 768) {
  const [m, setM] = useState(window.innerWidth <= bp);
  useEffect(() => { const h = () => setM(window.innerWidth <= bp); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, [bp]);
  return m;
}

export default function ControlChart({ readings, controlLimits, violations, metric, enabledRules }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();

  const vMap = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const v of violations) { if (!enabledRules.has(v.rule)) continue; for (const i of v.indices) { const e = m.get(i) ?? []; e.push(v.rule); m.set(i, e); } }
    return m;
  }, [violations, enabledRules]);

  const data: ChartPoint[] = useMemo(
    () => readings.map((r, i) => {
      const pt: ChartPoint = { time: new Date(r.time_utc).getTime(), value: r[metric] as number };
      const rules = vMap.get(i);
      if (rules) for (const rule of rules) pt[`v${rule}`] = r[metric] as number;
      return pt;
    }),
    [readings, metric, vMap],
  );

  const activeRules = useMemo(() => {
    const s = new Set<number>();
    for (const v of violations) if (enabledRules.has(v.rule) && v.indices.length) s.add(v.rule);
    return Array.from(s).sort();
  }, [violations, enabledRules]);

  const label = METRIC_LABELS[metric] ?? metric;

  const exportSVG = useCallback(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    a.download = `chart_${metric}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [metric]);

  if (!readings.length)
    return <div className="empty"><h3>No chart data</h3><p>Select a device and time range to see the control chart.</p></div>;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{label}</span>
        <button className="btn btn-sm" onClick={exportSVG}>Export SVG</button>
      </div>
      <div ref={ref} className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={mobile ? { top: 5, right: 8, left: -15, bottom: 5 } : { top: 10, right: 30, left: 5, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" type="number" domain={["dataMin","dataMax"]} scale="time"
              tickFormatter={(ts: number) => format(new Date(ts), "HH:mm")}
              stroke="transparent" tick={{ fill: TICK, fontSize: mobile ? 10 : 11 }} />
            <YAxis stroke="transparent" tick={{ fill: TICK, fontSize: mobile ? 10 : 11 }} width={mobile ? 38 : 55}
              domain={["auto","auto"]}
              label={mobile ? undefined : { value: label, angle: -90, position: "insideLeft", fill: TICK, fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: TIP_BG, border: `1px solid ${TIP_BD}`, borderRadius: 8, fontSize: 12, color: "#0f172a", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              labelFormatter={(ts: number) => { try { return format(new Date(ts), "yyyy-MM-dd HH:mm:ss"); } catch { return ""; } }}
              formatter={(val: number, name: string) => name === "value" ? [val.toFixed(3), label] : [val.toFixed(3), name]} />

            {controlLimits && <>
              <ReferenceLine y={controlLimits.mean} stroke="#16a34a" strokeDasharray="8 4"
                label={mobile ? undefined : { value: "X\u0304", position: "right", fill: "#16a34a", fontSize: 11 }} />
              <ReferenceLine y={controlLimits.ucl_1sigma} stroke="#ca8a04" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine y={controlLimits.lcl_1sigma} stroke="#ca8a04" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine y={controlLimits.ucl_2sigma} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.5}
                label={mobile ? undefined : { value: "+2\u03c3", position: "right", fill: "#ea580c", fontSize: 10 }} />
              <ReferenceLine y={controlLimits.lcl_2sigma} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.5}
                label={mobile ? undefined : { value: "-2\u03c3", position: "right", fill: "#ea580c", fontSize: 10 }} />
              <ReferenceLine y={controlLimits.ucl_3sigma} stroke="#dc2626" strokeDasharray="6 3"
                label={mobile ? undefined : { value: "UCL", position: "right", fill: "#dc2626", fontSize: 11 }} />
              <ReferenceLine y={controlLimits.lcl_3sigma} stroke="#dc2626" strokeDasharray="6 3"
                label={mobile ? undefined : { value: "LCL", position: "right", fill: "#dc2626", fontSize: 11 }} />
            </>}

            <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            {activeRules.map((r) => <Scatter key={r} dataKey={`v${r}`} fill={NELSON_RULE_COLORS[r]} shape="diamond" isAnimationActive={false} />)}
            {!mobile && <Brush dataKey="time" height={22} stroke="#881337" fill="#f8fafc" tickFormatter={(ts: number) => format(new Date(ts), "HH:mm")} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {controlLimits && (
        <div className="stats-strip">
          <S l="Mean" v={controlLimits.mean.toFixed(3)} />
          <S l={"\u03c3"} v={controlLimits.sigma.toFixed(4)} />
          <S l="UCL" v={controlLimits.ucl_3sigma.toFixed(3)} c="#dc2626" />
          <S l="LCL" v={controlLimits.lcl_3sigma.toFixed(3)} c="#dc2626" />
          <S l="Points" v={readings.length.toLocaleString()} />
        </div>
      )}
    </div>
  );
}

function S({ l, v, c }: { l: string; v: string; c?: string }) {
  return <div className="stat"><span className="stat-label">{l}</span><span className="stat-val" style={c ? { color: c } : undefined}>{v}</span></div>;
}
