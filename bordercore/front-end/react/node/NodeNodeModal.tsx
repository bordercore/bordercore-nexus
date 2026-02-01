import React, { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
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
      setSelectedNodeUuid(null);
    }
  }, [isOpen, data]);

  useEffect(() => {
    if (modalInstanceRef.current) {
      if (isOpen) {
        modalInstanceRef.current.show();
        // Focus the search input after modal opens
        setTimeout(() => {
          const input = modalRef.current?.querySelector(
            "#modalSelectNode input"
          ) as HTMLInputElement;
          if (input && action === "Add") {
            input.focus();
          }
        }, 500);
      } else {
        modalInstanceRef.current.hide();
      }
    }
  }, [isOpen, action]);

  const handleNodeSelect = (node: NodeSearchResult) => {
    setSelectedNodeUuid(node.uuid);
  };

  const handleSave = () => {
    if (action === "Add" && selectedNodeUuid) {
      onSelectNode(selectedNodeUuid, options);
    } else if (action === "Edit") {
      onSave(options);
    }
    modalInstanceRef.current?.hide();
  };

  return (
    <div
      ref={modalRef}
      className="modal fade"
      id="modalSelectNode"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="myModalLabel">
              {action} Node
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            {action === "Add" && (
              <div className="mb-3">
                <SelectValue
                  label="name"
                  placeHolder="Search nodes"
                  searchUrl={searchUrl}
                  onSelect={handleNodeSelect}
                />
              </div>
            )}
            <div className="form-section">Options</div>
            <div className="row mt-3">
              <label className="col-lg-4 col-form-label" htmlFor="inputRotate">
                Rotate
              </label>
              <div className="col-lg-8">
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
