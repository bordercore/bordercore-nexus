import React from "react";

interface PasswordStrengthProps {
  password: string;
  confirm: string;
}

export interface StrengthReport {
  checks: { label: string; ok: boolean }[];
  score: number;
  level: "weak" | "ok" | "strong" | "excellent";
  color: string;
}

export function computeStrength(password: string, confirm: string): StrengthReport {
  const checks = [
    { label: "≥ 12 chars", ok: password.length >= 12 },
    { label: "uppercase", ok: /[A-Z]/.test(password) },
    { label: "lowercase", ok: /[a-z]/.test(password) },
    { label: "number", ok: /\d/.test(password) },
    { label: "symbol", ok: /[^A-Za-z0-9]/.test(password) },
    { label: "matches", ok: password.length > 0 && password === confirm },
  ];
  const score = checks.filter(c => c.ok).length;
  const color =
    score <= 2 ? "var(--prefs-danger)" : score <= 4 ? "var(--prefs-warn)" : "var(--prefs-ok)";
  const level: StrengthReport["level"] =
    score <= 2 ? "weak" : score <= 4 ? "ok" : score === 5 ? "strong" : "excellent";
  return { checks, score, level, color };
}

export function PasswordStrength({ password, confirm }: PasswordStrengthProps) {
  if (!password) return null;
  const { checks, score, level, color } = computeStrength(password, confirm);

  return (
    <>
      <div className="prefs-pw-strength">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="bar"
            // must remain inline — color varies with live strength score
            style={{ background: i <= score ? color : "var(--prefs-bg-3)" }}
          />
        ))}
      </div>
      <div className="prefs-pw-meta">
        <span>strength</span>
        {/* must remain inline — color tracks strength score */}
        <span className="level" style={{ color }}>
          {level}
        </span>
      </div>
      <div className="prefs-pw-checklist">
        {checks.map(c => (
          <div key={c.label} className={`item${c.ok ? " ok" : ""}`}>
            <span className="mark">{c.ok ? "✓" : "·"}</span>
            {c.label}
          </div>
        ))}
      </div>
    </>
  );
}

export default PasswordStrength;
