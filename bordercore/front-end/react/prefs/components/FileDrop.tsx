import React, { useEffect, useRef, useState } from "react";

export type FileDropKind = "Background" | "Sidebar";

export interface FileDropValue {
  /** Preview URL (existing server asset or object URL). Empty string means no image. */
  url: string;
  /** Display filename, if any. */
  name?: string;
  /** Size in bytes when a new file has been selected. */
  size?: number;
  /** New file selected by the user, pending upload on save. */
  file?: File;
}

interface FileDropProps {
  value: FileDropValue;
  onChange: (value: FileDropValue) => void;
  kind?: FileDropKind;
  accept?: string;
  maxBytes?: number;
  label?: string;
}

const DEFAULT_MAX = 4 * 1024 * 1024;

export function FileDrop({
  value,
  onChange,
  kind = "Background",
  accept = "image/*",
  maxBytes = DEFAULT_MAX,
  label = "Drop an image or",
}: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset image-load failure state whenever the source URL changes.
  useEffect(() => {
    setImageFailed(false);
  }, [value.url]);

  const pick = () => fileRef.current?.click();

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`File exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit.`);
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    onChange({ url, name: file.name, size: file.size, file });
  };

  const clear = () => {
    setError(null);
    onChange({ url: "" });
  };

  const populated = Boolean(value.url);
  const hasFile = Boolean(value.file);
  const showImage = populated && !imageFailed;
  const stripe =
    kind === "Sidebar"
      ? "repeating-linear-gradient(135deg, var(--prefs-bg-2) 0 6px, var(--prefs-bg-3) 6px 12px)"
      : "repeating-linear-gradient(45deg, var(--prefs-bg-2) 0 8px, var(--prefs-bg-3) 8px 16px)";

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
  };

  return (
    <>
      <div className="prefs-file-drop">
        <button
          type="button"
          className={`prefs-file-preview${dragging ? " dragover" : ""}`}
          onClick={pick}
          aria-label={
            populated ? `Replace ${kind.toLowerCase()} image` : `Choose ${kind.toLowerCase()} image`
          }
          {...dragHandlers}
        >
          {showImage ? (
            <img src={value.url} alt={`${kind} preview`} onError={() => setImageFailed(true)} />
          ) : (
            // must remain inline — stripe direction depends on the kind prop
            <div className="gen" style={{ background: stripe }}>
              <div className="placeholder">
                {imageFailed ? (
                  "preview unavailable"
                ) : (
                  <>
                    {kind}
                    <br />
                    image
                  </>
                )}
              </div>
            </div>
          )}
        </button>

        <div className={`prefs-file-dropzone${dragging ? " dragover" : ""}`} {...dragHandlers}>
          <div>
            {populated ? (
              <>
                <div className="path">▸ {value.name || "image"}</div>
                <div className="dim">
                  {hasFile && typeof value.size === "number"
                    ? `${(value.size / 1024).toFixed(1)} KB · drop to replace`
                    : "drop to replace"}
                </div>
              </>
            ) : (
              <>
                <div>{label}</div>
                <div className="dim">PNG, JPG, WEBP · max 4 MB</div>
              </>
            )}
          </div>
          <div className="actions">
            {populated && (
              <button type="button" className="prefs-btn ghost" onClick={clear}>
                clear
              </button>
            )}
            <button type="button" className="prefs-btn" onClick={pick}>
              browse…
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="prefs-hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
      {error && (
        <div className="prefs-errors">
          <span className="err">{error}</span>
        </div>
      )}
    </>
  );
}

export default FileDrop;
