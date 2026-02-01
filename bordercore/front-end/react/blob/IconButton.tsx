import React, { useState, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faStickyNote, faBook, faSquareRootAlt } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const iconMap: Record<string, IconDefinition> = {
  heart: faHeart,
  "sticky-note": faStickyNote,
  book: faBook,
  "square-root-alt": faSquareRootAlt,
};

interface IconButtonProps {
  label: string;
  icon: string;
  initialEnabled?: boolean;
  formName: string;
  onEnableOption?: (formName: string, enabled: boolean) => void;
}

export interface IconButtonHandle {
  setValue: (value: boolean) => void;
  getValue: () => boolean;
}

export const IconButton = forwardRef<IconButtonHandle, IconButtonProps>(function IconButton(
  { label, icon, initialEnabled = false, formName, onEnableOption },
  ref
) {
  const [enabled, setEnabled] = useState(initialEnabled);

  const handleClick = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    onEnableOption?.(formName, newValue);
  };

  useImperativeHandle(ref, () => ({
    setValue: (value: boolean) => {
      setEnabled(value);
      onEnableOption?.(formName, value);
    },
    getValue: () => enabled,
  }));

  const iconDef = iconMap[icon];

  return (
    <div
      className={`icon-button d-flex flex-column align-items-center mx-2 cursor-pointer ${
        enabled ? "enabled" : ""
      }`}
      onClick={handleClick}
      title={label}
    >
      <div className={`icon-circle ${enabled ? "active" : ""}`}>
        {iconDef && (
          <FontAwesomeIcon icon={iconDef} className={enabled ? "text-primary" : "text-secondary"} />
        )}
      </div>
      <small className={`mt-1 ${enabled ? "text-primary" : "text-muted"}`}>{label}</small>
    </div>
  );
});

export default IconButton;
