import React, { useCallback, useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faTimes } from "@fortawesome/free-solid-svg-icons";

interface RefinedDatePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseISODate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = value.match(ISO_DATE_RE);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
}

function formatISODate(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DISPLAY_FMT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDisplay(date: Date | undefined): string {
  return date ? DISPLAY_FMT.format(date) : "";
}

export function RefinedDatePicker({
  id,
  value,
  onChange,
  placeholder = "select a date",
  ariaLabel,
}: RefinedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = parseISODate(value);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (wrap && e.target instanceof Node && !wrap.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    onChange(formatISODate(date));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={wrapRef} className="refined-datepicker">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`refined-datepicker-trigger${selected ? "" : " is-empty"}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="refined-datepicker-value">
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        {selected && (
          <span
            className="refined-datepicker-clear"
            role="button"
            tabIndex={0}
            aria-label="clear date"
            onClick={handleClear}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </span>
        )}
        <span className="refined-datepicker-icon" aria-hidden>
          <FontAwesomeIcon icon={faCalendarAlt} />
        </span>
      </button>

      {open && (
        <div className="refined-datepicker-popover" role="dialog">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            showOutsideDays
            weekStartsOn={0}
            captionLayout="label"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

export default RefinedDatePicker;
