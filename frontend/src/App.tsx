import { useState, useEffect, useCallback } from "react";
import "./App.css";
import ControlChart from "./components/ControlChart";
import BoxWhiskerPlot from "./components/BoxWhiskerPlot";
import HistogramChart from "./components/HistogramChart";
import NelsonViolations from "./components/NelsonViolations";
import { useRealtime } from "./hooks/useRealtime";
import {
  getDevices,
  getSPCAnalysis,
  getExportCSVUrl,
  getLatestReading,
} from "./api/client";
import type {
  DeviceInfo,
  SPCAnalysis,
  Metric,
  Bucket,
  Reading,
  ControlLimits,
} from "./api/types";
import type { GroupBy } from "./utils/stats";
import { METRIC_LABELS, BUCKET_LABELS } from "./api/types";
import { format } from "date-fns";

const PRESETS: { label: string; hours: number }[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

function defaultRange() {
  const now = new Date();
  const s = new Date(now.getTime() - 6 * 3600_000);
  return { start: s.toISOString(), end: now.toISOString() };
}

function formatAge(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3600_000)}h ago`;
}

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function App() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("temp_f_cal");
  const [bucket, setBucket] = useState<Bucket>("auto");
  const [range, setRange] = useState(defaultRange);
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [analysis, setAnalysis] = useState<SPCAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledRules, setEnabledRules] = useState<Set<number>>(new Set());
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [distGroupBy, setDistGroupBy] = useState<GroupBy>("day");
  const [histBins, setHistBins] = useState(20);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { newReadings, connected, clear } = useRealtime({
    deviceId: selectedDevice,
    enabled: liveEnabled,
  });

  const mergedReadings: Reading[] =
    analysis && newReadings.length > 0
      ? [...analysis.readings, ...newReadings]
      : analysis?.readings ?? [];

  useEffect(() => {
    if (newReadings.length > 0)
      setLatestReading(newReadings[newReadings.length - 1]);
  }, [newReadings]);

  useEffect(() => {
    getDevices()
      .then((d) => {
        setDevices(d);
        if (d.length > 0 && !selectedDevice) setSelectedDevice(d[0].device_id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setDevicesLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedDevice) getLatestReading(selectedDevice).then(setLatestReading);
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedDevice) return;
    const id = setInterval(() => {
      getLatestReading(selectedDevice).then((r) => { if (r) setLatestReading(r); });
    }, 10_000);
    return () => clearInterval(id);
  }, [selectedDevice]);

  const fetchAnalysis = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    setError(null);
    clear();
    try {
      setAnalysis(
        await getSPCAnalysis(
          selectedDevice, metric, range.start, range.end,
          bucket, Array.from(enabledRules),
        )
      );
    } catch (e: any) {
      setError(e.message);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, metric, range.start, range.end, bucket, enabledRules, clear]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const toggleRule = (rule: number) => {
    setEnabledRules((prev) => {
      const next = new Set(prev);
      next.has(rule) ? next.delete(rule) : next.add(rule);
      return next;
    });
  };

  const applyPreset = (hours: number, idx: number) => {
    const now = new Date();
    setRange({ start: new Date(now.getTime() - hours * 3600_000).toISOString(), end: now.toISOString() });
    setActivePreset(idx);
  };

  const handleExportCSV = () => {
    if (!selectedDevice) return;
    window.open(getExportCSVUrl(selectedDevice, range.start, range.end, bucket), "_blank");
  };

  const controlLimits = analysis?.control_limits ?? null;
  const totalViolations = analysis?.total_violation_count ?? 0;
  const resolvedBucket = analysis?.resolved_bucket ?? null;
  const deviceInfo = devices.find((d) => d.device_id === selectedDevice);

  let status: "ok" | "warn" | "error" = "ok";
  if (latestReading && controlLimits) {
    const v = latestReading.temp_f_cal;
    if (v > controlLimits.ucl_3sigma || v < controlLimits.lcl_3sigma) status = "error";
    else if (v > controlLimits.ucl_2sigma || v < controlLimits.lcl_2sigma) status = "warn";
  }

  return (
    <>
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="logo">Wine<span>Cellar</span></h1>
          <select
            className="select"
            value={selectedDevice ?? ""}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={devicesLoading}
          >
            <option value="" disabled>{devicesLoading ? "Loading..." : "Select device"}</option>
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>{d.device_id}</option>
            ))}
          </select>
        </div>

        <div className="topbar-right">
          {liveEnabled && (
            <span className="live-badge">
              <span className={`live-dot ${connected ? "on" : "off"}`} />
              <span style={{ color: connected ? "var(--green)" : "var(--text-4)" }}>
                {connected ? "LIVE" : "..."}
              </span>
            </span>
          )}
          <button
            className={`btn btn-live ${liveEnabled ? "active" : ""}`}
            onClick={() => setLiveEnabled(!liveEnabled)}
          >
            {liveEnabled ? "Stop" : "Live"}
          </button>
        </div>
      </header>

      {/* ── Page ── */}
      <main className="page">

        {/* Error */}
        {error && <div className="error-bar">Error: {error}</div>}

        {/* Status */}
        {latestReading && (
          <div className={`status-bar ${status}`}>
            <span className="status-dot" />
            {status === "ok" && "All readings normal"}
            {status === "warn" && "Approaching control limits"}
            {status === "error" && "Outside control limits!"}
            {totalViolations > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 13, opacity: 0.8 }}>
                {totalViolations} violation{totalViolations !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Hero cards */}
        {latestReading ? (
          <section className="hero">
            <HeroCard
              label="Temperature"
              value={`${latestReading.temp_f_cal.toFixed(1)}\u00b0F`}
              sub={`${latestReading.temp_c_cal.toFixed(1)}\u00b0C`}
              colorClass="val-temp"
            />
            <HeroCard
              label="Humidity"
              value={`${latestReading.rh_cal.toFixed(1)}%`}
              colorClass="val-humid"
            />
            <HeroCard
              label="Dew Point"
              value={`${latestReading.dew_point_f_cal.toFixed(1)}\u00b0F`}
              colorClass="val-dew"
            />
            <HeroCard
              label="Updated"
              value={formatAge(latestReading.time_utc, nowMs)}
              sub={safeFormat(latestReading.time_utc, "HH:mm:ss")}
              colorClass="val-age"
            />
          </section>
        ) : (
          <div className="empty">
            <h3>Waiting for data</h3>
            <p>Select a device above to begin monitoring.</p>
          </div>
        )}

        {/* ── Trend Chart Section ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head">
            <h2 className="section-title">Trend</h2>
            <div className="controls-row">
              <div className="pill-group">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    className={`pill ${activePreset === i ? "active" : ""}`}
                    onClick={() => applyPreset(p.hours, i)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <select
                className="select"
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
                style={{ maxWidth: 180 }}
              >
                {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced settings drawer */}
          <div className="settings-drawer">
            <button
              className={`settings-trigger ${advancedOpen ? "open" : ""}`}
              onClick={() => setAdvancedOpen(!advancedOpen)}
            >
              <span>Advanced Settings</span>
              <ChevronDown />
            </button>
            <div className={`settings-body ${advancedOpen ? "open" : ""}`}>
              <div className="field">
                <span className="field-label">From</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={toLocalInput(range.start)}
                  onChange={(e) => {
                    setActivePreset(null);
                    setRange({ start: fromLocalInput(e.target.value), end: range.end });
                  }}
                />
              </div>
              <div className="field">
                <span className="field-label">To</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={toLocalInput(range.end)}
                  onChange={(e) => {
                    setActivePreset(null);
                    setRange({ start: range.start, end: fromLocalInput(e.target.value) });
                  }}
                />
              </div>
              <div className="field">
                <span className="field-label">Aggregation</span>
                <select
                  className="select"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value as Bucket)}
                >
                  {(Object.entries(BUCKET_LABELS) as [Bucket, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {resolvedBucket && (
                <div className="field">
                  <span className="field-label">Resolved</span>
                  <span className="badge badge-resolved">{resolvedBucket}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginLeft: "auto" }}>
                <button className="btn btn-accent" onClick={fetchAnalysis} disabled={loading}>
                  {loading ? "Loading..." : "Refresh"}
                </button>
                <button className="btn btn-sm" onClick={handleExportCSV} disabled={!selectedDevice}>
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="loading"><div className="spin" /> Loading data...</div>
          ) : (
            <ControlChart
              readings={mergedReadings}
              controlLimits={controlLimits}
              violations={analysis?.violations ?? []}
              metric={metric}
              enabledRules={enabledRules}
            />
          )}
        </section>

        {/* ── Distribution Section ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head">
            <h2 className="section-title">Distribution</h2>
            <div className="controls-row">
              <div className="field">
                <span className="field-label">Group</span>
                <select
                  className="select"
                  value={distGroupBy}
                  onChange={(e) => setDistGroupBy(e.target.value as GroupBy)}
                >
                  <option value="range">All</option>
                  <option value="day">Day</option>
                  <option value="hour">Hour</option>
                </select>
              </div>
              <div className="field">
                <span className="field-label">Bins</span>
                <select
                  className="select"
                  value={histBins}
                  onChange={(e) => setHistBins(Number(e.target.value))}
                >
                  {[10, 15, 20, 30, 40].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="two-up">
            <BoxWhiskerPlot readings={mergedReadings} metric={metric} groupBy={distGroupBy} />
            <HistogramChart readings={mergedReadings} metric={metric} bins={histBins} />
          </div>
        </section>

        {/* ── Nelson Rules Section ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-head">
            <h2 className="section-title">Nelson Rules</h2>
            {totalViolations > 0 && (
              <span className="badge badge-accent">
                {totalViolations} violation{totalViolations !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <NelsonViolations
            violations={analysis?.violations ?? []}
            totalCount={totalViolations}
            enabledRules={enabledRules}
            onToggleRule={toggleRule}
          />
        </section>

        {/* ── Device Info Footer ── */}
        {deviceInfo && (
          <section className="card">
            <div className="card-head">
              <span className="card-title">Device Info</span>
            </div>
            <div className="info-grid">
              <InfoItem label="Device" value={deviceInfo.device_id} />
              <InfoItem label="Readings" value={deviceInfo.total_readings.toLocaleString()} />
              <InfoItem label="First Seen" value={safeFormat(deviceInfo.first_seen, "MMM d, yyyy")} />
              <InfoItem label="Last Seen" value={safeFormat(deviceInfo.last_seen, "MMM d, HH:mm")} />
              {controlLimits && (
                <>
                  <InfoItem label="Mean" value={controlLimits.mean.toFixed(2)} />
                  <InfoItem label="Sigma" value={controlLimits.sigma.toFixed(4)} />
                  <InfoItem label="UCL (3\u03c3)" value={controlLimits.ucl_3sigma.toFixed(2)} color="var(--red)" />
                  <InfoItem label="LCL (3\u03c3)" value={controlLimits.lcl_3sigma.toFixed(2)} color="var(--red)" />
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}


/* ===== Small helper components ===== */

function HeroCard({
  label, value, sub, colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className="hero-card">
      <span className="hero-label">{label}</span>
      <span className={`hero-value ${colorClass}`}>{value}</span>
      {sub && <span className="hero-sub">{sub}</span>}
    </div>
  );
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="info-val" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function safeFormat(iso: string, fmt: string): string {
  try { return format(new Date(iso), fmt); }
  catch { return iso; }
}
