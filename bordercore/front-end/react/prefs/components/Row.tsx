import React from "react";

interface RowProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  errors?: string[];
  children: React.ReactNode;
}

export function Row({ label, hint, htmlFor, errors, children }: RowProps) {
  return (
    <div className="prefs-row">
      <div className="label">
        <label className="key" htmlFor={htmlFor}>
          {label}
        </label>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="field">
        {children}
        {errors && errors.length > 0 && (
          <div className="prefs-errors">
            {errors.map((e, i) => (
              <span key={i} className="err">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Row;
