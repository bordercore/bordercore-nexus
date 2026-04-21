import React from "react";

interface NavItem {
  key: string;
  label: string;
  count: string;
  href?: string;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
}

interface PreferencesLayoutProps {
  activeTab: "main" | "password";
  prefsUrl: string;
  passwordUrl: string;
  pageTitle: string;
  pageSubtitle: string;
  pageDescription: string;
  sidebarInfo: { title: string; body: string };
  children: React.ReactNode;
}

export function PreferencesLayout({
  activeTab,
  prefsUrl,
  passwordUrl,
  pageTitle,
  pageSubtitle,
  pageDescription,
  sidebarInfo,
  children,
}: PreferencesLayoutProps) {
  const navItems: NavItem[] = [
    {
      key: "main",
      label: "Preferences",
      count: "12",
      href: prefsUrl,
      active: activeTab === "main",
    },
    {
      key: "password",
      label: "Password & Security",
      count: "3",
      href: passwordUrl,
      active: activeTab === "password",
    },
  ];

  return (
    <div className="prefs-shell">
      <header className="prefs-topbar">
        <div className="prefs-brand">
          <span className="prefs-brand-dot" aria-hidden="true" />
          <span>bordercore</span>
          <span className="prefs-brand-path">
            <span className="slash">/</span>
            <span>settings</span>
            <span className="slash">/</span>
            <span className="leaf">{activeTab === "main" ? "preferences" : "password"}</span>
          </span>
        </div>
      </header>

      <aside className="prefs-sidebar">
        <h3>Settings</h3>
        <nav>
          {navItems.map(item => {
            const className = [item.active ? "active" : "", item.muted ? "muted" : ""]
              .filter(Boolean)
              .join(" ");
            if (item.muted || !item.href) {
              return (
                <a key={item.key} className={className} aria-disabled="true">
                  <span>{item.label}</span>
                  <span className="count">{item.count}</span>
                </a>
              );
            }
            return (
              <a key={item.key} className={className} href={item.href}>
                <span>{item.label}</span>
                <span className="count">{item.count}</span>
              </a>
            );
          })}
        </nav>

        <div className="prefs-sidebar-info">
          <div className="title">{sidebarInfo.title}</div>
          {sidebarInfo.body}
        </div>
      </aside>

      <main className="prefs-main">
        <div className="prefs-page-head">
          <h1>
            {pageTitle} <span className="dim">— {pageSubtitle}</span>
          </h1>
          <p>{pageDescription}</p>
        </div>

        {children}
      </main>
    </div>
  );
}

export default PreferencesLayout;
