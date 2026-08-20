import React from "react";

import { ToggleSwitch } from "../../common/ToggleSwitch";

export interface ReminderFormState {
  name: string;
  note: string;
  is_active: boolean;
  create_todo: boolean;
  schedule_type: string;
  trigger_time: string;
  days_of_week: number[];
  days_of_month: number[];
  months: number[];
  start_at: string;
}

export interface ReminderFormErrors {
  [key: string]: string[] | undefined;
}

interface ReminderFormBodyProps {
  idPrefix: string;
  state: ReminderFormState;
  errors: ReminderFormErrors;
  onChange: (next: ReminderFormState) => void;
  nameRef?: React.Ref<HTMLInputElement>;
  onSubmitOnEnter: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

function fieldError(errors: ReminderFormErrors, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = errors[key];
    if (value && value.length > 0) return value;
  }
  return undefined;
}

export function ReminderFormBody({
  idPrefix,
  state,
  errors,
  onChange,
  nameRef,
  onSubmitOnEnter,
}: ReminderFormBodyProps) {
  const setField = <K extends keyof ReminderFormState>(key: K, value: ReminderFormState[K]) =>
    onChange({ ...state, [key]: value });

  const toggleDayOfWeek = (day: number) => {
    const next = state.days_of_week.includes(day)
      ? state.days_of_week.filter(d => d !== day)
      : [...state.days_of_week, day].sort((a, b) => a - b);
    setField("days_of_week", next);
  };

  const toggleDayOfMonth = (day: number) => {
    const next = state.days_of_month.includes(day)
      ? state.days_of_month.filter(d => d !== day)
      : [...state.days_of_month, day].sort((a, b) => a - b);
    setField("days_of_month", next);
  };

  const toggleMonth = (month: number) => {
    const next = state.months.includes(month)
      ? state.months.filter(m => m !== month)
      : [...state.months, month].sort((a, b) => a - b);
    setField("months", next);
  };

  const nameErr = fieldError(errors, "name");
  const noteErr = fieldError(errors, "note");
  const scheduleErr = fieldError(errors, "schedule_type");
  const timeErr = fieldError(errors, "trigger_time");
  const dowErr = fieldError(errors, "days_of_week_input", "days_of_week");
  const domErr = fieldError(errors, "days_of_month_input", "days_of_month");
  const monthsErr = fieldError(errors, "months_input", "months");
  const startErr = fieldError(errors, "start_at");
  const nonField = fieldError(errors, "non_field_errors", "__all__");

  return (
    <>
      {nonField && (
        <div className="rm-modal-error" role="alert">
          {nonField.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      )}

      <div className="refined-field">
        <label htmlFor={`${idPrefix}-name`}>name</label>
        <input
          ref={nameRef}
          id={`${idPrefix}-name`}
          type="text"
          autoComplete="off"
          maxLength={255}
          placeholder="e.g. water plants"
          value={state.name}
          onChange={e => setField("name", e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmitOnEnter();
            }
          }}
          required
        />
        {nameErr && <FieldError messages={nameErr} />}
      </div>

      <div className="refined-row-2">
        <div className="refined-field">
          <label htmlFor={`${idPrefix}-schedule`}>schedule</label>
          <select
            id={`${idPrefix}-schedule`}
            value={state.schedule_type}
            onChange={e => setField("schedule_type", e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          {scheduleErr && <FieldError messages={scheduleErr} />}
        </div>
        <div className="refined-field">
          <label htmlFor={`${idPrefix}-time`}>trigger time</label>
          <input
            id={`${idPrefix}-time`}
            type="time"
            value={state.trigger_time}
            onChange={e => setField("trigger_time", e.target.value)}
          />
          {timeErr && <FieldError messages={timeErr} />}
        </div>
      </div>

      {state.schedule_type === "weekly" && (
        <div className="refined-field">
          <label>days of week</label>
          <div className="rm-day-grid">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day.value}
                type="button"
                className={`rm-day-chip${state.days_of_week.includes(day.value) ? " is-on" : ""}`}
                onClick={() => toggleDayOfWeek(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
          {dowErr && <FieldError messages={dowErr} />}
        </div>
      )}

      {state.schedule_type === "monthly" && (
        <div className="refined-field">
          <label>days of month</label>
          <div className="rm-day-grid rm-day-grid-month">
            {DAYS_OF_MONTH.map(day => (
              <button
                key={day}
                type="button"
                className={`rm-day-chip${state.days_of_month.includes(day) ? " is-on" : ""}`}
                onClick={() => toggleDayOfMonth(day)}
              >
                {day}
              </button>
            ))}
          </div>
          {domErr && <FieldError messages={domErr} />}
        </div>
      )}

      {state.schedule_type === "yearly" && (
        <div className="refined-field">
          <label>
            months <span className="optional">· fires on the 1st</span>
          </label>
          <div className="rm-day-grid">
            {MONTHS.map(month => (
              <button
                key={month.value}
                type="button"
                className={`rm-day-chip${state.months.includes(month.value) ? " is-on" : ""}`}
                onClick={() => toggleMonth(month.value)}
              >
                {month.label}
              </button>
            ))}
          </div>
          {monthsErr && <FieldError messages={monthsErr} />}
        </div>
      )}

      <div className="refined-field">
        <label htmlFor={`${idPrefix}-note`}>
          note <span className="optional">· optional</span>
        </label>
        <textarea
          id={`${idPrefix}-note`}
          placeholder="freeform — markdown supported"
          value={state.note}
          onChange={e => setField("note", e.target.value)}
        />
        {noteErr && <FieldError messages={noteErr} />}
      </div>

      <div className="refined-field">
        <label htmlFor={`${idPrefix}-start`}>
          start at <span className="optional">· optional</span>
        </label>
        <input
          id={`${idPrefix}-start`}
          type="datetime-local"
          value={state.start_at}
          onChange={e => setField("start_at", e.target.value)}
        />
        {startErr && <FieldError messages={startErr} />}
      </div>

      <div className="rm-modal-checks">
        <label className="rm-modal-check">
          <ToggleSwitch
            name="is_active"
            checked={state.is_active}
            onChange={checked => setField("is_active", checked)}
          />
          <span>active</span>
        </label>
        <label className="rm-modal-check">
          <ToggleSwitch
            name="create_todo"
            checked={state.create_todo}
            onChange={checked => setField("create_todo", checked)}
          />
          <span>create todo when triggered</span>
        </label>
      </div>
    </>
  );
}

function FieldError({ messages }: { messages: string[] }) {
  return (
    <div className="rm-field-error" role="alert">
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
    </div>
  );
}

export const DEFAULT_FORM_STATE: ReminderFormState = {
  name: "",
  note: "",
  is_active: true,
  create_todo: false,
  schedule_type: "daily",
  trigger_time: "09:00",
  days_of_week: [],
  days_of_month: [],
  months: [],
  start_at: "",
};

export default ReminderFormBody;
