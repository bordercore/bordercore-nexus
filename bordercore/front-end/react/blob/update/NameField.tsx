import React from "react";

interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function NameField({ value, onChange }: NameFieldProps) {
  return (
    <div className="be-namefield">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
        placeholder="Name"
      />
    </div>
  );
}

export default NameField;
