import React, { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons";

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
}

export function DropDownMenu({
  links = [],
  direction = "dropend",
  showTarget = true,
  showOnHover = false,
  iconSlot,
  dropdownSlot,
}: DropDownMenuProps) {
  return (
    <div className="dropdown ms-auto d-flex align-items-center justify-content-center">
      <div className={`cursor-pointer ${showTarget ? "dropdownmenu" : ""} ${showOnHover ? "d-none" : ""}`}>
        <div
          className={`d-flex align-items-center justify-content-center h-100 w-100 ${direction}`}
          data-bs-toggle="dropdown"
          data-bs-auto-close="true"
          data-bs-offset="0,-15"
        >
          {iconSlot || <FontAwesomeIcon icon={faEllipsisV} />}
        </div>
        <ul className="dropdown-menu">
          {dropdownSlot ||
            links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  className="dropdown-item"
                  onClick={link.clickHandler ? (e) => {
                    e.preventDefault();
                    link.clickHandler?.();
                  } : undefined}
                >
                  <span className="me-2">
                    {link.icon && <FontAwesomeIcon icon={link.icon as any} className="text-primary" />}
                  </span>
                  {link.title}
                  {link.extra && <span className="dropdown-item-extra">{link.extra}</span>}
                </a>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export default DropDownMenu;

