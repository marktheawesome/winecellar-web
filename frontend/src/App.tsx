import { useState, useEffect, useCallback } from "react";
import DevicePicker from "./components/DevicePicker";
import TimeRangeSelector from "./components/TimeRangeSelector";
import ControlChart from "./components/ControlChart";
import BoxWhiskerPlot from "./components/BoxWhiskerPlot";
import HistogramChart from "./components/HistogramChart";
import NelsonViolations from "./components/NelsonViolations";
import { useRealtime } from "./hooks/useRealtime";
import { getDevices, getSPCAnalysis, getExportCSVUrl, getLatestReading } from "./api/client";
import type { DeviceInfo, SPCAnalysis, Metric, Bucket, Reading } from "./api/types";
import type { GroupBy } from "./utils/stats";
import { METRIC_LABELS } from "./api/types";
import { format } from "date-fns";

function defaultRange(): { start: string; end: string } {
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

export default function App() {
  // ---- State ----
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("temp_f_cal");
  const [bucket, setBucket] = useState<Bucket>("auto");
  const [range, setRange] = useState(defaultRange);
  const [analysis, setAnalysis] = useState<SPCAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledRules, setEnabledRules] = useState<Set<number>>(
    new Set()
  );
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [distGroupBy, setDistGroupBy] = useState<GroupBy>("day");
  const [histBins, setHistBins] = useState(20);

  // ---- Real-time ----
  const { newReadings, connected, lastMessage, clear } = useRealtime({
    deviceId: selectedDevice,
    enabled: liveEnabled,
  });

  // Merge live readings into analysis
  const mergedReadings: Reading[] =
    analysis && newReadings.length > 0
      ? [...analysis.readings, ...newReadings]
      : analysis?.readings ?? [];

  // Track latest reading from live feed
  useEffect(() => {
    if (newReadings.length > 0) {
      setLatestReading(newReadings[newReadings.length - 1]);
    }
  }, [newReadings]);

  // ---- Fetch devices on mount ----
  useEffect(() => {
    getDevices()
      .then((d) => {
        setDevices(d);
        if (d.length > 0 && !selectedDevice) {
          setSelectedDevice(d[0].device_id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setDevicesLoading(false));
  }, []);

  // ---- Tick clock for relative age display ----
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ---- Fetch latest reading when device changes ----
  useEffect(() => {
    if (!selectedDevice) return;
    getLatestReading(selectedDevice).then((r) => setLatestReading(r));
  }, [selectedDevice]);

  // ---- Poll latest reading every 10s ----
  useEffect(() => {
    if (!selectedDevice) return;
    const interval = setInterval(() => {
      getLatestReading(selectedDevice).then((r) => {
        if (r) setLatestReading(r);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [selectedDevice]);

  // ---- Fetch SPC analysis ----
  const fetchAnalysis = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    setError(null);
    clear();
    try {
      const data = await getSPCAnalysis(
        selectedDevice,
        metric,
        range.start,
        range.end,
        bucket,
        Array.from(enabledRules)
      );
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, metric, range.start, range.end, bucket, enabledRules, clear]);

  // Auto-fetch when params change
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // ---- Handlers ----
  const toggleRule = (rule: number) => {
    setEnabledRules((prev) => {
      const next = new Set(prev);
      if (next.has(rule)) next.delete(rule);
      else next.add(rule);
      return next;
    });
  };

  const handleExportCSV = () => {
    if (!selectedDevice) return;
    const url = getExportCSVUrl(selectedDevice, range.start, range.end, bucket);
    window.open(url, "_blank");
  };

  const resolvedBucket = analysis?.resolved_bucket ?? null;

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Wine Cellar SPC Dashboard</h1>
          <p style={styles.subtitle}>Statistical Process Control with Nelson Rules</p>
        </div>

        {/* Current reading display */}
        {latestReading && (
          <div style={styles.currentReadings}>
            <div style={styles.currentCard}>
              <span style={styles.currentLabel}>Temperature</span>
              <span style={styles.currentTempValue}>
                {latestReading.temp_f_cal.toFixed(1)}&deg;F
              </span>
              <span style={styles.currentTempSub}>
                {latestReading.temp_c_cal.toFixed(1)}&deg;C
              </span>
            </div>
            <div style={styles.currentCard}>
              <span style={styles.currentLabel}>Humidity</span>
              <span style={styles.currentRhValue}>
                {latestReading.rh_cal.toFixed(1)}%
              </span>
            </div>
            <div style={styles.currentCard}>
              <span style={styles.currentLabel}>Updated</span>
                <span style={styles.currentAge}>
                {formatAge(latestReading.time_utc, nowMs)}
                </span>
              <span style={styles.currentTimestamp}>
                {(() => {
                  try { return format(new Date(latestReading.time_utc), "HH:mm:ss"); }
                  catch { return ""; }
                })()}
              </span>
            </div>
          </div>
        )}

        <div style={styles.headerRight}>
          {liveEnabled && (
            <div style={styles.liveStatus}>
              <span style={{
                ...styles.liveDot,
                backgroundColor: connected ? "#4ade80" : "#888",
              }} />
              <div>
                <span style={{ color: connected ? "#4ade80" : "#888", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
                  {connected ? "LIVE" : "CONNECTING"}
                </span>
                {lastMessage && (
                  <span style={styles.liveLastMsg}>Last: {lastMessage}</span>
                )}
                {newReadings.length > 0 && (
                  <span style={styles.liveFeedCount}>+{newReadings.length} pts</span>
                )}
              </div>
            </div>
          )}
          <button
            style={{
              ...styles.liveBtn,
              ...(liveEnabled ? styles.liveBtnActive : {}),
            }}
            onClick={() => setLiveEnabled(!liveEnabled)}
          >
            {liveEnabled ? "Stop Live" : "Go Live"}
          </button>
        </div>
      </header>

      {/* Controls bar */}
      <section style={styles.controls}>
        <DevicePicker
          devices={devices}
          selected={selectedDevice}
          onChange={setSelectedDevice}
          loading={devicesLoading}
        />

        <div style={styles.metricGroup}>
          <label style={styles.label}>Metric</label>
          <select
            style={styles.select}
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <TimeRangeSelector
          start={range.start}
          end={range.end}
          bucket={bucket}
          onRangeChange={(s, e) => setRange({ start: s, end: e })}
          onBucketChange={setBucket}
        />

        {/* Resolved aggregation badge */}
        {resolvedBucket && (
          <div style={styles.bucketBadgeGroup}>
            <label style={styles.label}>Aggregation</label>
            <span style={styles.bucketBadge}>{resolvedBucket}</span>
          </div>
        )}

        <div style={styles.actions}>
          <button style={styles.refreshBtn} onClick={fetchAnalysis} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button style={styles.csvBtn} onClick={handleExportCSV} disabled={!selectedDevice}>
            Export CSV
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Main content */}
      <div style={styles.main}>
        <div style={styles.chartArea}>
          <ControlChart
            readings={mergedReadings}
            controlLimits={analysis?.control_limits ?? null}
            violations={analysis?.violations ?? []}
            metric={metric}
            enabledRules={enabledRules}
          />
          <div style={styles.distControls}>
            <div style={styles.controlBlock}>
              <label style={styles.label}>Box Group</label>
              <select
                style={styles.select}
                value={distGroupBy}
                onChange={(e) => setDistGroupBy(e.target.value as GroupBy)}
              >
                <option value="range">All</option>
                <option value="day">Day</option>
                <option value="hour">Hour</option>
              </select>
            </div>
            <div style={styles.controlBlock}>
              <label style={styles.label}>Histogram Bins</label>
              <select
                style={styles.select}
                value={histBins}
                onChange={(e) => setHistBins(Number(e.target.value))}
              >
                {[10, 15, 20, 30, 40].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={styles.distGrid}>
            <BoxWhiskerPlot readings={mergedReadings} metric={metric} groupBy={distGroupBy} />
            <HistogramChart readings={mergedReadings} metric={metric} bins={histBins} />
          </div>
        </div>
        <div style={styles.sidebar}>
          <NelsonViolations
            violations={analysis?.violations ?? []}
            totalCount={analysis?.total_violation_count ?? 0}
            enabledRules={enabledRules}
            onToggleRule={toggleRule}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    maxWidth: 1440,
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #222",
    paddingBottom: 12,
    gap: 16,
    flexWrap: "wrap",
  },
  h1: { fontSize: 22, fontWeight: 700, color: "#e0e0e0" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },

  /* Current reading cards */
  currentReadings: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
  },
  currentCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
    padding: "8px 16px",
    minWidth: 90,
  },
  currentLabel: {
    fontSize: 10,
    color: "#666",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  currentTempValue: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#818cf8",
  },
  currentTempSub: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  currentRhValue: {
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#38bdf8",
  },
  currentAge: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e0e0e0",
    fontFamily: "monospace",
  },
  currentTimestamp: {
    fontSize: 11,
    color: "#555",
    fontFamily: "monospace",
  },

  /* Header right / live controls */
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  liveStatus: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    animation: "pulse 2s ease-in-out infinite",
  },
  liveLastMsg: {
    display: "block",
    fontSize: 10,
    color: "#555",
  },
  liveFeedCount: {
    display: "block",
    fontSize: 10,
    color: "#818cf8",
  },
  liveBtn: {
    padding: "6px 16px",
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  liveBtnActive: {
    background: "#16a34a",
    color: "#fff",
    borderColor: "#16a34a",
  },

  /* Controls bar */
  controls: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 16,
    padding: 16,
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
  },
  metricGroup: { display: "flex", flexDirection: "column", gap: 4 },
  label: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  select: {
    padding: "8px 12px",
    background: "#1a1a1a",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: 6,
    fontSize: 14,
    cursor: "pointer",
  },
  bucketBadgeGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  bucketBadge: {
    display: "inline-block",
    padding: "6px 14px",
    background: "#1e1b4b",
    color: "#a78bfa",
    border: "1px solid #4c1d95",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 8, marginLeft: "auto" },
  refreshBtn: {
    padding: "8px 20px",
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  csvBtn: {
    padding: "8px 16px",
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  error: {
    background: "#2d1111",
    color: "#ef4444",
    padding: 12,
    borderRadius: 6,
    border: "1px solid #442222",
    fontSize: 13,
  },
  main: {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    gap: 16,
  },
  chartArea: { minWidth: 0 },
  sidebar: {},
  distControls: {
    display: "flex",
    gap: 16,
    alignItems: "flex-end",
    marginTop: 16,
    padding: "12px 16px",
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
  },
  controlBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  distGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
    marginTop: 12,
  },
};
