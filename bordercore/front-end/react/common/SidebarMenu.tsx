import React, { ReactNode } from "react";
import { Sidebar, Menu, MenuItem, MenuItemStyles } from "react-pro-sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faSearch,
  faBookmark,
  faBox,
  faGripHorizontal,
  faNewspaper,
  faStickyNote,
  faCopy,
  faGraduationCap,
  faMusic,
  faTasks,
  faTags,
  faRunning,
  faClock,
  faArrowsAltH,
} from "@fortawesome/free-solid-svg-icons";

interface MenuIcon {
  element: string;
  attributes: {
    icon: string;
  };
  class: string;
}

interface MenuBadge {
  text: string | number;
  class: string;
}

interface MenuItemData {
  href: string;
  title: string;
  alias?: string | string[];
  icon?: MenuIcon;
  badge?: MenuBadge;
  class?: string;
  child?: MenuItemData[];
}

interface SidebarMenuProps {
  menu: MenuItemData[];
  collapsed: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onItemClick?: (event: React.MouseEvent, item: MenuItemData, node?: any) => void;
  headerSlot?: React.ReactNode;
  toggleIconSlot?: React.ReactNode;
  dropdownIconSlot?: React.ReactNode;
}

// Map icon names to FontAwesome icons
const iconMap: Record<string, any> = {
  home: faHome,
  search: faSearch,
  bookmark: faBookmark,
  box: faBox,
  "grip-horizontal": faGripHorizontal,
  newspaper: faNewspaper,
  "sticky-note": faStickyNote,
  copy: faCopy,
  "graduation-cap": faGraduationCap,
  music: faMusic,
  tasks: faTasks,
  tags: faTags,
  running: faRunning,
  clock: faClock,
};

// Helper function to get the current path
const getCurrentPath = (): string => {
  if (typeof window !== "undefined") {
    return window.location.pathname;
  }
  return "";
};

// Helper function to check if a path matches an item's href or alias
const isActiveRoute = (item: MenuItemData, currentPath: string): boolean => {
  if (currentPath === item.href) {
    return true;
  }

  if (item.alias) {
    const aliases = Array.isArray(item.alias) ? item.alias : [item.alias];
    return aliases.some((alias) => {
      // Convert wildcard pattern to regex
      const pattern = alias.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(currentPath);
    });
  }

  return false;
};

// Helper function to render icon
const renderIcon = (icon?: MenuIcon): ReactNode => {
  if (!icon || icon.element !== "font-awesome-icon") {
    return null;
  }

  const iconName = icon.attributes.icon;
  const faIcon = iconMap[iconName];
  if (!faIcon) {
    return null;
  }

  // Use the CSS classes for color (sidebar-icon-1, sidebar-icon-2, sidebar-icon-3)
  // No inline styles - colors come from CSS
  return <FontAwesomeIcon icon={faIcon} className={icon.class} />;
};

export function SidebarMenu({
  menu,
  collapsed,
  onToggleCollapse,
  onItemClick,
  headerSlot,
  toggleIconSlot,
}: SidebarMenuProps) {
  const currentPath = getCurrentPath();

  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    onToggleCollapse?.(newCollapsed);
  };

  // Custom menu item styles to match existing design
  const menuItemStyles: MenuItemStyles = {
    root: {
      fontSize: "14px",
      fontWeight: 400,
      color: "var(--sidebar-color)",
      "&:hover": {
        backgroundColor: "var(--sidebar-hover-bg) !important",
        color: "var(--sidebar-hover-color)",
        boxShadow: "0px 0px 10px 1px rgba(115, 103, 240, 0.7)",
        borderRadius: "5px",
        "& .ps-menu-icon": {
          color: "var(--sidebar-hover-color) !important",
        },
      },
      "&.ps-active": {
        backgroundColor: "var(--sidebar-active-bg)",
        color: "var(--sidebar-active-color)",
        boxShadow: "0px 0px 10px 1px rgba(115, 103, 240, 0.7)",
        backgroundImage: "linear-gradient(90deg, #0000, #00000003)",
        borderRadius: "5px",
        "& .ps-menu-icon": {
          color: "var(--sidebar-active-color)",
        },
      },
    },
    icon: {
      color: "inherit",
      "& svg": {
        color: "inherit",
      },
      ...(collapsed && {
        margin: 0,
      }),
    },
    subMenuContent: {
      backgroundColor: "transparent",
    },
    label: {
      color: "inherit",
    },
    prefix: {
      color: "inherit",
    },
    suffix: {
      fontSize: "12px",
      fontWeight: 600,
      textTransform: "uppercase",
      padding: "0px 6px",
      borderRadius: "3px",
      height: "20px",
      lineHeight: "20px",
      backgroundColor: "var(--bs-primary, #0d6efd)",
      color: "var(--sidebar-color)",
    },
  };

  // Sidebar root styles with gradient background
  const sidebarRootStyles = {
    background: "linear-gradient(180deg, var(--sidebar-gradient-start) 29%, var(--sidebar-gradient-end) 90%)",
    color: "var(--sidebar-color)",
    height: "100vh",
    position: "fixed" as const,
    left: 0,
    top: 0,
    zIndex: 999,
    paddingBottom: "50px", // Add padding at bottom for the toggle button
  };

  return (
    <>
      <style>{`
        /* Override react-pro-sidebar styles to match existing design */
        .ps-sidebar-container {
          background: linear-gradient(180deg, var(--sidebar-gradient-start) 29%, var(--sidebar-gradient-end) 90%) !important;
        }
        .ps-menu-button:hover {
          background-color: var(--sidebar-hover-bg) !important;
        }
        .ps-menu-button:hover .sidebar-icon-1,
        .ps-menu-button:hover .sidebar-icon-2,
        .ps-menu-button:hover .sidebar-icon-3,
        .ps-menu-button:hover .ps-menu-icon svg {
          color: var(--sidebar-hover-color) !important;
        }
        .ps-menu-button.ps-active .sidebar-icon-1,
        .ps-menu-button.ps-active .sidebar-icon-2,
        .ps-menu-button.ps-active .sidebar-icon-3,
        .ps-menu-button.ps-active .ps-menu-icon svg {
          color: var(--sidebar-active-color) !important;
        }
        .ps-menu-button .ps-menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* Center icons when sidebar is collapsed */
        .ps-sidebar-root[data-collapsed="true"] .ps-menu-button {
          padding: 0 !important;
          display: flex !important;
          justify-content: center !important;
        }
        .ps-sidebar-root[data-collapsed="true"] .ps-menu-icon {
          margin: 0 !important;
          min-width: unset !important;
          width: 100% !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        .ps-sidebar-root[data-collapsed="true"] .ps-menu-label {
          display: none !important;
        }
        .ps-sidebar-root[data-collapsed="true"] .ps-menu-root > ul {
          padding: 0 !important;
        }
        /* Ensure the sub-menu-content is also centered if it exists */
        .ps-sidebar-root[data-collapsed="true"] .ps-submenu-content {
          padding: 0 !important;
        }
      `}</style>
      <Sidebar
        collapsed={collapsed}
        rootStyles={sidebarRootStyles}
        width="240px"
        collapsedWidth="64px"
        transitionDuration={300}
      >
      {headerSlot}
          <Menu menuItemStyles={menuItemStyles}>
            {menu.map((item) => {
              const isActive = isActiveRoute(item, currentPath);
              const icon = renderIcon(item.icon);
              const suffix = item.badge && item.badge.text ? (
                <span className={item.badge.class || ""}>{item.badge.text}</span>
              ) : undefined;

          return (
            <MenuItem
              key={item.href}
              icon={icon}
              active={isActive}
              suffix={suffix}
              onClick={(e) => {
                // Navigate using window.location for regular href navigation
                window.location.href = item.href;
                if (onItemClick) {
                  onItemClick(e as any, item);
                }
              }}
            >
              {item.title}
            </MenuItem>
          );
        })}
      </Menu>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          cursor: "pointer",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "transparent",
        }}
        onClick={handleToggleCollapse}
      >
        {toggleIconSlot || <FontAwesomeIcon icon={faArrowsAltH} />}
      </div>
    </Sidebar>
    </>
  );
}

export default SidebarMenu;
