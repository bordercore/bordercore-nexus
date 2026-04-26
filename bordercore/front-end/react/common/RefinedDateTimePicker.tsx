import React from "react";
import { RefinedDatePicker } from "./RefinedDatePicker";

interface RefinedDateTimePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
}

const ISO_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/;

function splitDateTime(value: string | undefined): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const m = value.match(ISO_DATETIME_RE);
  if (!m) return { date: "", time: "" };
  return { date: m[1], time: m[2] };
}

function combine(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function RefinedDateTimePicker({ id, value, onChange }: RefinedDateTimePickerProps) {
  const { date, time } = splitDateTime(value);

  return (
    <div className="refined-datetimepicker">
      <RefinedDatePicker
        id={id}
        value={date}
        onChange={newDate => onChange(newDate ? combine(newDate, time) : "")}
      />
      <input
        type="time"
        className="refined-datetimepicker-time"
        value={time}
        onChange={e => onChange(combine(date, e.target.value))}
        aria-label="time"
      />
    </div>
  );
}

export default RefinedDateTimePicker;
