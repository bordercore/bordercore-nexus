import React, { ReactNode, useState, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faBriefcase,
  faChartBar,
  faComment,
  faPencilAlt,
  faQuestion,
  faSignOutAlt,
  faTimes,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { Popover } from "./Popover";

interface Link {
  id: string;
  title: string;
  url: string;
  icon?: string;
  extra?: number | string;
  clickHandler?: () => void;
}

interface DropDownMenuProps {
  links?: Link[];
  direction?: string;
  showTarget?: boolean;
  showOnHover?: boolean;
  iconSlot?: ReactNode;
  dropdownSlot?: ReactNode;
  allowFlip?: boolean;
}

export interface DropDownMenuHandle {
  close: () => void;
}

export const DropDownMenu = forwardRef<DropDownMenuHandle, DropDownMenuProps>(function DropDownMenu(
  {
    links = [],
    direction = "dropend",
    showTarget = true,
    showOnHover = false,
    iconSlot,
    dropdownSlot,
    allowFlip = true,
  },
  ref
) {
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    close: () => setIsOpen(false),
  }));

  // Map icon name strings to FontAwesome icon objects
  const getIcon = (iconName: string | undefined): IconDefinition | null => {
    if (!iconName) return null;
    const iconMap: Record<string, IconDefinition> = {
      briefcase: faBriefcase,
      "chart-bar": faChartBar,
      comment: faComment,
      "pencil-alt": faPencilAlt,
      question: faQuestion,
      "sign-out-alt": faSignOutAlt,
      times: faTimes,
    };
    return iconMap[iconName] || null;
  };

  const handleItemClick = (link: Link, e: React.MouseEvent) => {
    if (link.clickHandler) {
      e.preventDefault();
      link.clickHandler();
    }
    setIsOpen(false);
  };

  const trigger = (
    <div className={`dropdown-trigger ${showTarget ? "dropdownmenu" : ""}`}>
      <div className="d-flex align-items-center justify-content-center h-100 w-100 cursor-pointer">
        {iconSlot || <FontAwesomeIcon icon={faEllipsisV} />}
      </div>
    </div>
  );

  const dropdownContent = dropdownSlot || (
    <ul className="dropdown-menu-list">
      {links.map(link => {
        const icon = typeof link.icon === "string" ? getIcon(link.icon) : link.icon;
        return (
          <li key={link.id}>
            <a
              href={link.url}
              className="dropdown-menu-item"
              onClick={e => handleItemClick(link, e)}
            >
              <span className="dropdown-menu-icon">{icon && <FontAwesomeIcon icon={icon} />}</span>
              <span className="dropdown-menu-text">{link.title}</span>
              {link.extra !== undefined && link.extra !== null && Number(link.extra) !== 0 && (
                <span className="dropdown-menu-extra">{link.extra}</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="dropdown-wrapper">
      <Popover
        trigger={trigger}
        placement={direction === "dropend" ? "bottom-end" : "bottom-start"}
        openOnHover={showOnHover}
        offsetDistance={4}
        className="dropdown-popover"
        open={isOpen}
        onOpenChange={setIsOpen}
        allowFlip={allowFlip}
      >
        <div className="dropdown-content">{dropdownContent}</div>
      </Popover>
    </div>
  );
});

export default DropDownMenu;
