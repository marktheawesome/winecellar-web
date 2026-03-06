import type { DeviceInfo } from "../api/types";

interface Props {
  devices: DeviceInfo[];
  selected: string | null;
  onChange: (deviceId: string) => void;
  loading: boolean;
}

export default function DevicePicker({ devices, selected, onChange, loading }: Props) {
  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>Device</label>
      <select
        style={styles.select}
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="" disabled>
          {loading ? "Loading..." : "Select a device"}
        </option>
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id}>
            {d.device_id} ({d.total_readings.toLocaleString()} readings)
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
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
