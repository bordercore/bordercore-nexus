import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import { SelectValue } from "../common/SelectValue";
import { ROTATE_OPTIONS, type NodeOptions } from "./types";

interface NodeSearchResult {
  uuid: string;
  name: string;
}

interface NodeNodeModalProps {
  isOpen: boolean;
  action: "Add" | "Edit";
  searchUrl: string;
  data: NodeOptions | null;
  onSave: (options: NodeOptions) => void;
  onSelectNode: (nodeUuid: string, options: NodeOptions) => void;
  onClose: () => void;
}

const defaultOptions: NodeOptions = {
  rotate: -1,
};

export default function NodeNodeModal({
  isOpen,
  action,
  searchUrl,
  data,
  onSave,
  onSelectNode,
  onClose,
}: NodeNodeModalProps) {
  const [options, setOptions] = useState<NodeOptions>(defaultOptions);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);

  const selectWrapperRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef<HTMLSelectElement>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setOptions(data || defaultOptions);
    setSelectedNodeUuid(null);
    const t = window.setTimeout(() => {
      if (action === "Add") {
        const input = selectWrapperRef.current?.querySelector("input") as HTMLInputElement | null;
        input?.focus();
      } else {
        rotateRef.current?.focus();
      }
    }, 40);
    return () => window.clearTimeout(t);
  }, [isOpen, data, action]);

  // Escape-to-close.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleNodeSelect = (node: NodeSearchResult) => {
    setSelectedNodeUuid(node.uuid);
  };

  const canSubmit = action === "Edit" || selectedNodeUuid !== null;

  const submit = useCallback(() => {
    if (action === "Add") {
      if (!selectedNodeUuid) return;
      onSelectNode(selectedNodeUuid, options);
    } else {
      onSave(options);
    }
  }, [action, selectedNodeUuid, options, onSelectNode, onSave]);

  if (!isOpen) return null;

  const title = action === "Add" ? "Add node link" : "Edit node link";

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label={title.toLowerCase()}
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">{title}</h2>

        {action === "Add" && (
          <div className="refined-field" ref={selectWrapperRef}>
            <label>name</label>
            <SelectValue
              label="name"
              placeHolder="Search nodes"
              searchUrl={searchUrl}
              onSelect={handleNodeSelect}
            />
          </div>
        )}

        <div className="refined-field">
          <label htmlFor="inputRotate">rotate</label>
          <select
            ref={rotateRef}
            id="inputRotate"
            value={options.rotate}
            onChange={e =>
              setOptions(prev => ({
                ...prev,
                rotate: parseInt(e.target.value, 10),
              }))
            }
          >
            {ROTATE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.display}
              </option>
            ))}
          </select>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            save
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
