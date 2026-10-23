import React, { useEffect, useRef, useState } from "react";
import { api, errorText, today } from "./api";
import { Kind, Reading, labels } from "./types";

export default function ReadingForm({
  kind,
  row,
  root,
  unit,
  onSaved,
  onClose,
}: {
  kind: Kind;
  row?: Reading;
  root: string;
  unit: string;
  onSaved: (unit?: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [another, setAnother] = useState(false);
  const timestamp = row?.timestamp;
  const [values, setValues] = useState<Record<string, string>>({
    date: timestamp ? timestamp.slice(0, 10) : row?.date || today(),
    time: timestamp ? timestamp.slice(11, 19) : row?.time || "",
    timezone: row?.timezone || "America/New_York",
    utc_offset: timestamp ? timestamp.slice(-6) : row?.utc_offset || "",
    value: row?.value || "",
    unit: row?.unit || unit,
    systolic: String(row?.systolic || ""),
    diastolic: String(row?.diastolic || ""),
    pulse: String(row?.pulse || ""),
    note: row?.note || "",
  });
  const [excluded, setExcluded] = useState(row?.excluded || false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const field = (name: string, title: string, type = "text", required = false) => (
    <label>
      {title}
      <input
        name={name}
        type={type}
        required={required}
        value={values[name]}
        step={
          type === "number" ? (name === "value" ? "0.001" : "1") : type === "time" ? "1" : undefined
        }
        min={type === "number" ? (name === "value" ? "0.001" : "1") : undefined}
        onChange={e =>
          setValues({
            ...values,
            [name]: e.target.value,
            ...(["date", "time", "timezone"].includes(name) ? { utc_offset: "" } : {}),
          })
        }
      />
    </label>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`${root}${kind}/records/${row ? `${row.uuid}/` : ""}`, row ? "PUT" : "POST", {
        ...values,
        excluded,
      });
      onSaved(kind === "weight" ? values.unit : undefined);
      if (another && !row) {
        setValues({
          ...values,
          value: "",
          systolic: "",
          diastolic: "",
          pulse: "",
          time: "",
          note: "",
          utc_offset: "",
        });
      } else onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="qs-dialog"
      aria-labelledby="qs-form-title"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="qs-dialog-head">
          <h2 id="qs-form-title">
            {row ? "Edit" : "Add"} {labels[kind].toLowerCase()}
          </h2>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <fieldset disabled={busy}>
          <div className="qs-form-grid">
            {field("date", "Date", "date", true)}
            {field(
              "time",
              kind === "awakenings" ? "Time (New York)" : "Time (optional)",
              "time",
              kind === "awakenings"
            )}
            {kind === "weight" && (
              <>
                {field("value", "Weight", "number", true)}
                <label>
                  Unit
                  <select
                    value={values.unit}
                    onChange={e => setValues({ ...values, unit: e.target.value })}
                  >
                    <option>lb</option>
                    <option>kg</option>
                  </select>
                </label>
              </>
            )}
            {kind === "blood-pressure" && (
              <>
                {field("systolic", "Systolic · mmHg", "number", true)}
                {field("diastolic", "Diastolic · mmHg", "number", true)}
                {field("pulse", "Pulse · bpm (optional)", "number")}
              </>
            )}
          </div>
          <details>
            <summary>Timezone and clock changes</summary>
            <div className="qs-form-grid">
              {kind !== "awakenings" && field("timezone", "Timezone", "text", true)}
              {field("utc_offset", "UTC offset (only needed for ambiguous times)")}
            </div>
            <p>
              For example, -04:00 or -05:00 when a clock time occurs twice. Leave time blank if it
              is unknown.
            </p>
          </details>
          <label>
            Note
            <textarea
              rows={3}
              maxLength={10000}
              value={values.note}
              onChange={e => setValues({ ...values, note: e.target.value })}
            />
          </label>
          {row && (
            <label className="qs-check">
              <input
                type="checkbox"
                checked={excluded}
                onChange={e => setExcluded(e.target.checked)}
              />{" "}
              Exclude from charts and analysis (keeps the original record)
            </label>
          )}
          {!row && (
            <label className="qs-check">
              <input
                type="checkbox"
                checked={another}
                onChange={e => setAnother(e.target.checked)}
              />{" "}
              Save and add another
            </label>
          )}
        </fieldset>
        {error && (
          <p className="qs-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="qs-primary" disabled={busy}>
            {busy ? "Saving…" : "Save reading"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
