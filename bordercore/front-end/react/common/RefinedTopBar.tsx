import React from "react";

interface RefinedTopBarProps {
  leaf: string;
  crumbs?: string[];
  username?: string;
  showQuickNav?: boolean;
}

export function RefinedTopBar({ leaf, crumbs, username, showQuickNav }: RefinedTopBarProps) {
  const initials = username ? username.slice(0, 1).toUpperCase() : "";
  return (
    <header className="refined-topbar">
      <div className="refined-brand">
        <span className="refined-brand-dot" aria-hidden="true" />
        <span>bordercore</span>
        <span className="refined-brand-path">
          {(crumbs ?? []).map(crumb => (
            <React.Fragment key={crumb}>
              <span className="slash">/</span>
              <span>{crumb}</span>
            </React.Fragment>
          ))}
          <span className="slash">/</span>
          <span className="leaf">{leaf}</span>
        </span>
      </div>

      {(showQuickNav || username) && (
        <div className="refined-topbar-right">
          {showQuickNav && (
            <>
              <span className="refined-kbd">⌘</span>
              <span className="refined-kbd">K</span>
              <span>quick nav</span>
              <span className="sep" aria-hidden="true">
                │
              </span>
            </>
          )}
          {username && (
            <>
              <span className="user">
                hello <em>{username}</em>
              </span>
              <span className="refined-avatar" aria-hidden="true">
                {initials}
              </span>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default RefinedTopBar;
