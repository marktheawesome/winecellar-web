import type { NelsonViolation } from "../api/types";
import { NELSON_RULE_COLORS } from "../api/types";

interface Props {
  violations: NelsonViolation[];
  totalCount: number;
  enabledRules: Set<number>;
  onToggleRule: (rule: number) => void;
}

export default function NelsonViolations({
  violations,
  totalCount,
  enabledRules,
  onToggleRule,
}: Props) {
  const allRules = Array.from({ length: 8 }, (_, i) => i + 1);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Nelson Rules</h3>
        <span style={styles.badge}>
          {totalCount} violation{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Rule toggles */}
      <div style={styles.toggles}>
        {allRules.map((rule) => {
          const violation = violations.find((v) => v.rule === rule);
          const count = violation?.indices.length ?? 0;
          const active = enabledRules.has(rule);
          return (
            <button
              key={rule}
              style={{
                ...styles.toggleBtn,
                borderColor: active ? NELSON_RULE_COLORS[rule] : "#333",
                opacity: active ? 1 : 0.4,
              }}
              onClick={() => onToggleRule(rule)}
              title={violation?.description ?? `Rule ${rule}`}
            >
              <span
                style={{
                  ...styles.dot,
                  backgroundColor: NELSON_RULE_COLORS[rule],
                }}
              />
              <span>R{rule}</span>
              {count > 0 && <span style={styles.count}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Violation details */}
      {violations
        .filter((v) => enabledRules.has(v.rule) && v.indices.length > 0)
        .map((v) => (
          <div key={v.rule} style={styles.detail}>
            <div style={styles.detailHeader}>
              <span
                style={{
                  ...styles.dot,
                  backgroundColor: NELSON_RULE_COLORS[v.rule],
                }}
              />
              <strong>Rule {v.rule}: {v.rule_name}</strong>
              <span style={styles.detailCount}>{v.indices.length}x</span>
            </div>
            <p style={styles.description}>{v.description}</p>
          </div>
        ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#141414",
    border: "1px solid #222",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: 600, color: "#e0e0e0" },
  badge: {
    background: "#7c3aed",
    color: "#fff",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  toggles: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#ccc",
    cursor: "pointer",
    fontSize: 12,
    transition: "all 0.15s",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  count: {
    background: "#333",
    padding: "1px 6px",
    borderRadius: 8,
    fontSize: 11,
  },
  detail: {
    background: "#1a1a1a",
    borderRadius: 6,
    padding: 10,
  },
  detailHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },
  detailCount: { color: "#888", fontSize: 12 },
  description: { color: "#888", fontSize: 12, marginTop: 4 },
};
