import { useState } from "react";
import type { Bucket } from "../api/types";
import { BUCKET_LABELS } from "../api/types";

interface Props {
  start: string;
  end: string;
  bucket: Bucket;
  onRangeChange: (start: string, end: string) => void;
  onBucketChange: (bucket: Bucket) => void;
}

const PRESETS: { label: string; hours: number }[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export default function TimeRangeSelector({
  start,
  end,
  bucket,
  onRangeChange,
  onBucketChange,
}: Props) {
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const applyPreset = (hours: number, idx: number) => {
    const now = new Date();
    const s = new Date(now.getTime() - hours * 3600_000);
    onRangeChange(s.toISOString(), now.toISOString());
    setActivePreset(idx);
  };

  return (
    <div style={styles.container}>
      {/* Preset buttons */}
      <div style={styles.presets}>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            style={{
              ...styles.presetBtn,
              ...(activePreset === i ? styles.presetActive : {}),
            }}
            onClick={() => applyPreset(p.hours, i)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div style={styles.customRange}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>From</label>
          <input
            type="datetime-local"
            style={styles.input}
            value={toLocalInput(start)}
            onChange={(e) => {
              setActivePreset(null);
              onRangeChange(fromLocalInput(e.target.value), end);
            }}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>To</label>
          <input
            type="datetime-local"
            style={styles.input}
            value={toLocalInput(end)}
            onChange={(e) => {
              setActivePreset(null);
              onRangeChange(start, fromLocalInput(e.target.value));
            }}
          />
        </div>
      </div>

      {/* Bucket selector */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Aggregation</label>
        <select
          style={styles.select}
          value={bucket}
          onChange={(e) => onBucketChange(e.target.value as Bucket)}
        >
          {(Object.entries(BUCKET_LABELS) as [Bucket, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 16,
  },
  presets: { display: "flex", gap: 4 },
  presetBtn: {
    padding: "6px 14px",
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    transition: "all 0.15s",
  },
  presetActive: {
    background: "#7c3aed",
    color: "#fff",
    borderColor: "#7c3aed",
  },
  customRange: { display: "flex", gap: 12 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
  input: {
    padding: "7px 10px",
    background: "#1a1a1a",
    color: "#e0e0e0",
    border: "1px solid #333",
    borderRadius: 6,
    fontSize: 13,
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
};
