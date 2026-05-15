import React from "react";
import { VISUALIZER_REGISTRY } from "../../visualizers/registry";
import { RENDERABLE_KEYS, type VisualizerKey } from "../../visualizers/types";

export interface VisualizerOption {
  value: string;
  label: string;
}

interface VisualizerPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: VisualizerOption[];
}

function PreviewBody({ value }: { value: string }) {
  if (value === "none") {
    return <div className="viz-preview viz-preview-text">empty</div>;
  }
  if (value === "random") {
    return <div className="viz-preview viz-preview-text">surprise</div>;
  }
  const entry = VISUALIZER_REGISTRY[value as keyof typeof VISUALIZER_REGISTRY];
  if (!entry) return <div className="viz-preview viz-preview-text">?</div>;
  const Component = entry.component;
  return (
    <div className="viz-preview">
      <Component />
    </div>
  );
}

function descriptionFor(value: string): string {
  if (value === "none") return "Leave the slot empty";
  if (value === "random") return "Pick a different one each visit";
  const entry = VISUALIZER_REGISTRY[value as keyof typeof VISUALIZER_REGISTRY];
  return entry?.description ?? "";
}

export function VisualizerPicker({ value, onChange, options }: VisualizerPickerProps) {
  const ordered = [...options].sort((a, b) => {
    const order = [...RENDERABLE_KEYS, "random", "none"] as VisualizerKey[];
    return order.indexOf(a.value as VisualizerKey) - order.indexOf(b.value as VisualizerKey);
  });

  return (
    <div className="prefs-theme-grid prefs-viz-grid">
      {ordered.map(opt => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`prefs-theme-card${selected ? " selected" : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            data-visualizer={opt.value}
            title={descriptionFor(opt.value)}
          >
            <PreviewBody value={opt.value} />
            <div className="name">
              <span>{opt.label}</span>
              <span className="check">✓ active</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default VisualizerPicker;
