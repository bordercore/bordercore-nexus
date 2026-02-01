import React, { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
import {
  NODE_COLORS,
  ROTATE_OPTIONS,
  FORMAT_OPTIONS,
  type NodeColor,
  type QuoteOptions,
} from "./types";

interface NodeQuoteModalProps {
  isOpen: boolean;
  action: "Add" | "Edit";
  nodeUuid: string;
  addQuoteUrl: string;
  data: QuoteOptions | null;
  onSave: (options: QuoteOptions) => void;
  onAddQuote: (options: QuoteOptions) => void;
  onClose: () => void;
}

const defaultOptions: QuoteOptions = {
  color: 1,
  rotate: -1,
  format: "standard",
  favorites_only: false,
};

export default function NodeQuoteModal({
  isOpen,
  action,
  data,
  onSave,
  onAddQuote,
  onClose,
}: NodeQuoteModalProps) {
  const [options, setOptions] = useState<QuoteOptions>(defaultOptions);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);

      modalRef.current.addEventListener("hidden.bs.modal", () => {
        onClose();
      });
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setOptions(data || defaultOptions);
    }
  }, [isOpen, data]);

  useEffect(() => {
    if (modalInstanceRef.current) {
      if (isOpen) {
        modalInstanceRef.current.show();
      } else {
        modalInstanceRef.current.hide();
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    if (action === "Add") {
      onAddQuote(options);
    } else {
      onSave(options);
    }
    modalInstanceRef.current?.hide();
  };

  const getColorClass = (c: NodeColor) => {
    const selected = c === options.color ? "selected-color" : "";
    return `node-color node-color-${c} ${selected}`;
  };

  return (
    <div
      ref={modalRef}
      className="modal fade"
      id="modalEditQuote"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="myModalLabel">
              {action} Quote
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
              <label className="col-lg-3 col-form-label" htmlFor="inputTitle">
                Color
              </label>
              <div className="col-lg-9">
                <div className="d-flex">
                  {NODE_COLORS.map(c => (
                    <div
                      key={c}
                      className={`${getColorClass(c)} flex-grow-1 mx-2 cursor-pointer`}
                      onClick={() => setOptions(prev => ({ ...prev, color: c }))}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <label className="col-lg-3 col-form-label" htmlFor="inputRotate">
                Rotate
              </label>
              <div className="col-lg-9">
                <div className="d-flex flex-column">
                  <select
                    id="inputRotate"
                    className="form-control form-select"
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
                  <div className="d-flex align-items-center mt-1">
                    <input
                      type="checkbox"
                      id="favoritesOnly"
                      className="form-check-input"
                      checked={options.favorites_only}
                      onChange={e =>
                        setOptions(prev => ({
                          ...prev,
                          favorites_only: e.target.checked,
                        }))
                      }
                    />
                    <label className="ms-2" htmlFor="favoritesOnly">
                      Favorites Only
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <label className="col-lg-3 col-form-label" htmlFor="inputFormat">
                Format
              </label>
              <div className="col-lg-9">
                <div className="d-flex flex-column">
                  <select
                    id="inputFormat"
                    className="form-control form-select"
                    value={options.format}
                    onChange={e =>
                      setOptions(prev => ({
                        ...prev,
                        format: e.target.value as "standard" | "minimal",
                      }))
                    }
                  >
                    {FORMAT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.display}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <input className="btn btn-primary" type="button" value="Save" onClick={handleSave} />
          </div>
        </div>
      </div>
    </div>
  );
}
