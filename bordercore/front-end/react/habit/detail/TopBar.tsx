import React from "react";

interface TopBarProps {
  name: string;
  isActive: boolean;
  onEnd: () => void;
}

/**
 * Detail page top bar: page-title h1 on the left (the habit name),
 * "End habit" button on the right. The site-wide breadcrumb
 * (`Bordercore / habits / habit`) lives in the global top bar.
 */
export function TopBar({ name, isActive, onEnd }: TopBarProps) {
  return (
    <header className="hb-topbar">
      <h1 className="refined-breadcrumb-h1">
        <span className="current">{name}</span>
      </h1>
      {isActive && (
        <button type="button" className="refined-btn danger" onClick={onEnd}>
          end habit
        </button>
      )}
    </header>
  );
}
