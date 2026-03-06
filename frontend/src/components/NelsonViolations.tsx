import type { NelsonViolation } from "../api/types";
import { NELSON_RULE_COLORS } from "../api/types";

interface Props {
  violations: NelsonViolation[];
  totalCount: number;
  enabledRules: Set<number>;
  onToggleRule: (rule: number) => void;
}

const ALL_RULES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function NelsonViolations({ violations, totalCount, enabledRules, onToggleRule }: Props) {
  const activeViolations = violations.filter((v) => enabledRules.has(v.rule) && v.indices.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Rule toggle grid */}
      <div className="rules-bar">
        {ALL_RULES.map((rule) => {
          const v = violations.find((x) => x.rule === rule);
          const count = v?.indices.length ?? 0;
          const on = enabledRules.has(rule);
          return (
            <button
              key={rule}
              className={`rule-btn ${on ? "on" : ""}`}
              style={{
                borderColor: on ? NELSON_RULE_COLORS[rule] : undefined,
                opacity: on ? 1 : 0.45,
              }}
              onClick={() => onToggleRule(rule)}
              title={v?.description ?? `Rule ${rule}`}
            >
              <span className="dot" style={{ backgroundColor: NELSON_RULE_COLORS[rule] }} />
              <span className="label">R{rule}</span>
              {count > 0 && <span className="cnt">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Violation details */}
      {activeViolations.map((v) => (
        <div key={v.rule} className="violation-card">
          <div className="violation-head">
            <span className="dot" style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: NELSON_RULE_COLORS[v.rule], flexShrink: 0 }} />
            <strong>Rule {v.rule}: {v.rule_name}</strong>
            <span className="violation-count">{v.indices.length}x</span>
          </div>
          <p className="violation-desc">{v.description}</p>
        </div>
      ))}

      {/* Empty states */}
      {enabledRules.size === 0 && (
        <div className="empty" style={{ padding: 28 }}>
          <p>Tap the rule buttons above to enable violation checks.</p>
        </div>
      )}
      {enabledRules.size > 0 && activeViolations.length === 0 && (
        <div className="empty" style={{ padding: 28 }}>
          <p>No violations found for the selected rules.</p>
        </div>
      )}
    </div>
  );
}
