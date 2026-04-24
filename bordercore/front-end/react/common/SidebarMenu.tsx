import React, { ReactNode, useState } from "react";
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
  faCheckDouble,
  faProjectDiagram,
  faPen,
  faCheck,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

export interface MenuItemData {
  href: string;
  title: string;
  alias?: string | string[];
  icon?: MenuIcon;
  badge?: MenuBadge;
  class?: string;
  color?: string;
}

interface SidebarMenuProps {
  menu: MenuItemData[];
  collapsed: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onReorder?: (newOrder: string[]) => void;
  headerSlot?: ReactNode;
}

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
  "check-double": faCheckDouble,
  "project-diagram": faProjectDiagram,
};

const getCurrentPath = (): string =>
  typeof window !== "undefined" ? window.location.pathname : "";

const isActiveRoute = (item: MenuItemData, currentPath: string): boolean => {
  if (currentPath === item.href) {
    return true;
  }
  if (!item.alias) {
    return false;
  }
  const aliases = Array.isArray(item.alias) ? item.alias : [item.alias];
  return aliases.some(alias => {
    const pattern = alias.replace(/\*/g, ".*");
    return new RegExp(`^${pattern}$`).test(currentPath);
  });
};

interface SortableRowProps {
  item: MenuItemData;
  collapsed: boolean;
  editMode: boolean;
  active: boolean;
}

function SortableRow({ item, collapsed, editMode, active }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.href,
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(item.color ? ({ "--row-color": item.color } as React.CSSProperties) : {}),
  };

  const faIcon = item.icon ? iconMap[item.icon.attributes.icon] : null;

  const rowClasses = [
    "sidebar-row",
    active ? "is-active" : "",
    editMode ? "is-editing" : "",
    isDragging ? "is-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span className="sidebar-row-icon">
        {faIcon && <FontAwesomeIcon icon={faIcon} className={item.icon?.class} />}
      </span>
      {!collapsed && (
        <>
          <span className="sidebar-row-label">{item.title}</span>
          {item.badge?.text ? (
            <span className={`sidebar-row-badge ${item.badge.class || ""}`}>{item.badge.text}</span>
          ) : null}
        </>
      )}
    </>
  );

  if (editMode) {
    return (
      // dnd-kit transform + --row-color CSS var must remain inline
      <li ref={setNodeRef} style={style} className={rowClasses} {...attributes} {...listeners}>
        <div className="sidebar-row-inner">{body}</div>
      </li>
    );
  }

  return (
    // dnd-kit transform + --row-color CSS var must remain inline
    <li ref={setNodeRef} style={style} className={rowClasses}>
      <a href={item.href} className="sidebar-row-inner" title={collapsed ? item.title : undefined}>
        {body}
      </a>
    </li>
  );
}

export function SidebarMenu({
  menu,
  collapsed,
  onToggleCollapse,
  onReorder,
  headerSlot,
}: SidebarMenuProps) {
  const currentPath = getCurrentPath();
  const [editMode, setEditMode] = useState(false);
  const [preEditCollapsed, setPreEditCollapsed] = useState<boolean | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = menu.findIndex(m => m.href === active.id);
    const newIndex = menu.findIndex(m => m.href === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const next = arrayMove(menu, oldIndex, newIndex);
    onReorder?.(next.map(m => m.href));
  };

  const handleToggleEdit = () => {
    if (editMode) {
      setEditMode(false);
      if (preEditCollapsed !== null && preEditCollapsed !== collapsed) {
        onToggleCollapse?.(preEditCollapsed);
      }
      setPreEditCollapsed(null);
    } else {
      setPreEditCollapsed(collapsed);
      if (collapsed) {
        onToggleCollapse?.(false);
      }
      setEditMode(true);
    }
  };

  return (
    <aside className="sidebar" data-collapsed={collapsed} data-editing={editMode}>
      {headerSlot && <div className="sidebar-header">{headerSlot}</div>}
      <nav className="sidebar-nav">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={menu.map(m => m.href)} strategy={verticalListSortingStrategy}>
            <ul className="sidebar-list">
              {menu.map(item => (
                <SortableRow
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  editMode={editMode}
                  active={isActiveRoute(item, currentPath)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>
      <div className="sidebar-footer">
        {!collapsed && (
          <button
            type="button"
            className="sidebar-footer-btn"
            onClick={handleToggleEdit}
            title={editMode ? "Done reordering" : "Reorder items"}
          >
            <FontAwesomeIcon icon={editMode ? faCheck : faPen} />
            <span className="sidebar-footer-btn-label">{editMode ? "Done" : "Edit"}</span>
          </button>
        )}
        {!editMode && (
          <button
            type="button"
            className="sidebar-footer-btn sidebar-footer-btn-collapse"
            onClick={() => onToggleCollapse?.(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>
        )}
      </div>
    </aside>
  );
}

export default SidebarMenu;
