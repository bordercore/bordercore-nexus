import React from "react";
import { DENSITY_STOPS, densityFromIndex, indexFromDensity, type Density } from "./density";

interface DensitySliderProps {
  density: Density;
  count: number;
  onChange: (next: Density) => void;
}

export function DensitySlider({ density, count, onChange }: DensitySliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(densityFromIndex(Number(e.target.value)));
  };

  return (
    <div className="cl-density">
      <span className="cl-density-icon" aria-hidden="true">
        ⊟
      </span>
      <input
        type="range"
        min={0}
        max={DENSITY_STOPS.length - 1}
        step={1}
        value={indexFromDensity(density)}
        onChange={handleChange}
        aria-label="display density"
        aria-valuetext={density}
      />
      <span className="cl-density-stop">{density}</span>
      <span className="cl-density-count">· {count}</span>
    </div>
  );
}

export default DensitySlider;
