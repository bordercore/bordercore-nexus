import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile,
  faFilePdf,
  faFileImage,
  faFileVideo,
  faFileAudio,
  faPenToSquare,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface FilePaneProps {
  filename: string;
  fileSize?: string;
  doctype?: string;
  isNote: boolean;
  downloadUrl?: string;
  onFilenameChange: (name: string) => void;
  onFileReplace: (file: File) => void;
}

function pickIcon(doctype?: string): IconDefinition {
  switch (doctype) {
    case "book":
    case "pdf":
      return faFilePdf;
    case "image":
      return faFileImage;
    case "video":
      return faFileVideo;
    case "audio":
      return faFileAudio;
    default:
      return faFile;
  }
}

export function FilePane({
  filename,
  fileSize,
  doctype,
  isNote,
  downloadUrl,
  onFilenameChange,
  onFileReplace,
}: FilePaneProps) {
  const [dragOver, setDragOver] = useState(false);

  if (isNote) {
    return <div className="be-file-empty">this is a note · no file</div>;
  }

  return (
    <div>
      <div className="be-label">
        file
        {fileSize && <span className="meta">{fileSize}</span>}
      </div>
      <div className="be-file-card">
        <FontAwesomeIcon className="doc-icon" icon={pickIcon(doctype)} />
        <input
          className="filename"
          type="text"
          value={filename}
          onChange={e => onFilenameChange(e.target.value)}
          autoComplete="off"
        />
        <div className="actions">
          <label className="be-btn icon ghost" aria-label="Replace file">
            <FontAwesomeIcon icon={faPenToSquare} />
            <input
              type="file"
              hidden
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onFileReplace(file);
              }}
            />
          </label>
          {downloadUrl && (
            <a className="be-btn icon ghost" href={downloadUrl} download aria-label="Download file">
              <FontAwesomeIcon icon={faDownload} />
            </a>
          )}
        </div>
      </div>
      <div
        className={`be-file-strip ${dragOver ? "drag-over" : ""}`}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFileReplace(file);
        }}
      >
        drop to replace
      </div>
    </div>
  );
}

export default FilePane;
