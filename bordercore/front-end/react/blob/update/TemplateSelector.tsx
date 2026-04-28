import React from "react";

export interface TemplateOption {
  uuid: string;
  name: string;
}

interface TemplateSelectorProps {
  templates: TemplateOption[];
  value: string;
  onChange: (uuid: string) => void;
}

export function TemplateSelector({ templates, value, onChange }: TemplateSelectorProps) {
  if (templates.length === 0) return null;

  return (
    <div className="be-section">
      <div className="be-template">
        <label htmlFor="be-template-select">Template</label>
        <select
          id="be-template-select"
          className="be-input"
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="-1">Use Template</option>
          {templates.map(t => (
            <option key={t.uuid} value={t.uuid}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default TemplateSelector;
