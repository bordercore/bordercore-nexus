import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faStickyNote,
  faBook,
  faSquareRootVariable,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface FlagsState {
  importance: boolean;
  is_note: boolean;
  is_book: boolean;
  math_support: boolean;
}

interface FlagsCardProps {
  flags: FlagsState;
  onChange: (key: keyof FlagsState, value: boolean) => void;
}

interface FlagSpec {
  key: keyof FlagsState;
  label: string;
  icon: IconDefinition;
}

const FLAGS: FlagSpec[] = [
  { key: "importance", label: "Important", icon: faHeart },
  { key: "is_note", label: "Note", icon: faStickyNote },
  { key: "is_book", label: "Book", icon: faBook },
  { key: "math_support", label: "Math", icon: faSquareRootVariable },
];

export function FlagsCard({ flags, onChange }: FlagsCardProps) {
  return (
    <div className="be-section">
      <div className="be-label">flags</div>
      <div className="be-flags">
        {FLAGS.map(({ key, label, icon }) => {
          const active = flags[key];
          return (
            <button
              key={key}
              type="button"
              className={`be-flag ${active ? "active" : ""}`}
              onClick={() => onChange(key, !active)}
              aria-pressed={active}
            >
              <FontAwesomeIcon icon={icon} />
              <span>{label}</span>
              {active && <FontAwesomeIcon className="check" icon={faCheck} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FlagsCard;
