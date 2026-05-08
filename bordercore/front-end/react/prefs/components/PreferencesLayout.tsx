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
  // Section nav is rendered by the global RefinedTopBar; this layout only
  // owns the in-page sidebar + main column.
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
            <span className="bc-page-title">{pageTitle}</span>{" "}
            <span className="dim">— {pageSubtitle}</span>
          </h1>
          <p>{pageDescription}</p>
        </div>

        {children}
      </main>
    </div>
  );
}

export default PreferencesLayout;
