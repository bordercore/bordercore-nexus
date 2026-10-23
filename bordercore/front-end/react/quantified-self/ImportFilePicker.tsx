import React, { useId } from "react";

export default function ImportFilePicker({
  label,
  accept,
  file,
  inputRef,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  return (
    <div className="refined-field">
      <label htmlFor={id}>{label}</label>
      <div className="refined-file">
        <input
          type="text"
          value={file?.name || ""}
          placeholder="No file selected"
          aria-label={`Selected ${label.toLowerCase()}`}
          readOnly
        />
        <button
          type="button"
          className="refined-btn ghost refined-file-pick"
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Change file" : "Choose file"}
        </button>
        <input
          id={id}
          ref={inputRef}
          type="file"
          hidden
          required
          accept={accept}
          onChange={event => onChange(event.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}
