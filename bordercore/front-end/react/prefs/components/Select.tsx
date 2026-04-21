import React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ id, value, onChange, options, placeholder }: SelectProps) {
  return (
    <div className="prefs-select-wrap">
      <select
        id={id}
        className="prefs-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Select;
