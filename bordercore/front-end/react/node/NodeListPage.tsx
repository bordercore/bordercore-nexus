import React, { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { DropDownMenu } from "../common/DropDownMenu";
import type { NodeListItem, FormField } from "./types";

interface NodeListPageProps {
  nodes: NodeListItem[];
  createUrl: string;
  formFields: FormField[];
}

export default function NodeListPage({ nodes, createUrl, formFields }: NodeListPageProps) {
  const [modalInstance, setModalInstance] = useState<Modal | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      const modal = new Modal(modalRef.current);
      setModalInstance(modal);
    }
  }, []);

  const handleClickCreate = () => {
    if (modalInstance) {
      modalInstance.show();
      // Focus the name input after modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 500);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleClickCreate();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPlus} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New Node</span>
        </a>
      </li>
    </ul>
  );

  return (
    <>
      <div className="card-grid d-flex ms-3">
        <div className="d-flex flex-row flex-wrap">
          {nodes.map(node => (
            <div key={node.uuid} className="w-50">
              <h4>
                <a href={`/node/${node.uuid}/`} data-name={node.name}>
                  {node.name}
                </a>
                <div className="ps-2 pt-1 text-primary">
                  <ul className="list-unstyled">
                    <li>
                      Last modified:{" "}
                      <span className="text-emphasis">{formatDate(node.modified)}</span>
                    </li>
                    <li>
                      Collection count:{" "}
                      <span className="text-emphasis">{node.collection_count}</span>
                    </li>
                    <li>
                      Todo count: <span className="text-emphasis">{node.todo_count}</span>
                    </li>
                  </ul>
                </div>
              </h4>
            </div>
          ))}
        </div>

        <div className="me-2">
          <DropDownMenu dropdownSlot={dropdownContent} />
        </div>
      </div>

      {/* Create Node Modal - Traditional Form POST */}
      <div className="card-grid ms-3">
        <form action={createUrl} method="post" id="form-node-create">
          <input
            type="hidden"
            name="csrfmiddlewaretoken"
            value={window.BASE_TEMPLATE_DATA?.csrfToken || ""}
          />
          <div
            ref={modalRef}
            className="modal fade"
            id="modalAdd"
            tabIndex={-1}
            role="dialog"
            aria-labelledby="myModalLabel"
          >
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title" id="myModalLabel">
                    New Node
                  </h4>
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body">
                  {formFields.map(field => (
                    <div key={field.name} className="row mb-3">
                      <label className="col-lg-3 col-form-label" htmlFor={`id_${field.name}`}>
                        {field.label}
                      </label>
                      <div className="col-lg-9">
                        {field.type === "textarea" ? (
                          <textarea
                            id={`id_${field.name}`}
                            name={field.name}
                            className="form-control"
                            defaultValue={field.value || ""}
                          />
                        ) : (
                          <input
                            ref={field.name === "name" ? nameInputRef : undefined}
                            type="text"
                            id={`id_${field.name}`}
                            name={field.name}
                            className="form-control"
                            autoComplete="off"
                            maxLength={field.maxLength || 200}
                            required={field.required}
                            defaultValue={field.value || ""}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <input
                    id="btn-action"
                    className="btn btn-primary"
                    type="submit"
                    name="Go"
                    value="Create"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
