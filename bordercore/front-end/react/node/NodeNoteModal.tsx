import React, { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
import { NODE_COLORS, type NodeColor } from "./types";

interface NoteData {
  name: string;
  color: NodeColor;
}

interface NodeNoteModalProps {
  isOpen: boolean;
  action: "Add" | "Edit";
  data: NoteData | null;
  onSave: (data: NoteData) => void;
  onColorChange?: (color: NodeColor) => void;
  onClose: () => void;
}

export default function NodeNoteModal({
  isOpen,
  action,
  data,
  onSave,
  onColorChange,
  onClose,
}: NodeNoteModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<NodeColor>(1);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);

      modalRef.current.addEventListener("hidden.bs.modal", () => {
        onClose();
      });
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen && data) {
      setName(data.name || "");
      setColor(data.color || 1);
    }
  }, [isOpen, data]);

  useEffect(() => {
    if (modalInstanceRef.current) {
      if (isOpen) {
        modalInstanceRef.current.show();
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 500);
      } else {
        modalInstanceRef.current.hide();
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave({ name, color });
    modalInstanceRef.current?.hide();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  const getColorClass = (c: NodeColor) => {
    const selected = c === color ? "selected-color" : "";
    return `node-color node-color-${c} ${selected}`;
  };

  return (
    <div
      ref={modalRef}
      className="modal fade"
      id="modalEditNote"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="myModalLabel">
              {action} Note
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <div className="row mb-3">
              <label className="col-lg-3 col-form-label" htmlFor="id_name_note">
                Name
              </label>
              <div className="col-lg-9">
                <input
                  ref={nameInputRef}
                  id="id_name_note"
                  type="text"
                  className="form-control"
                  autoComplete="off"
                  maxLength={200}
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            <div className="row mb-3">
              <label className="col-lg-3 col-form-label" htmlFor="inputTitle">
                Color
              </label>
              <div className="col-lg-9">
                <div className="d-flex">
                  {NODE_COLORS.map(c => (
                    <div
                      key={c}
                      className={`${getColorClass(c)} flex-grow-1 mx-2 cursor-pointer`}
                      onClick={() => {
                        setColor(c);
                        onColorChange?.(c);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <input
              id="btn-action"
              className="btn btn-primary"
              type="button"
              value="Save"
              onClick={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
