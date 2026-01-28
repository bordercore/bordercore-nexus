import React from "react";

interface ToggleSwitchProps {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({
  name,
  checked,
  onChange,
  disabled = false,
  className = "",
}: ToggleSwitchProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div className={`form-check form-switch ${className}`}>
      <input
        type="checkbox"
        className="form-check-input"
        id={`toggle-${name}`}
        name={name}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        role="switch"
      />
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </div>
  );
}

export default ToggleSwitch;
