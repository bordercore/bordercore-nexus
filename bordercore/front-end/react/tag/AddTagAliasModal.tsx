import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { SelectValue, type SelectValueHandle } from "../common/SelectValue";
import { doPost } from "../utils/reactUtils";

export interface AddTagAliasModalHandle {
  openModal: () => void;
}

interface AddTagAliasModalProps {
  tagSearchUrl: string;
  addAliasUrl: string;
  onAliasAdded: () => void;
}

export const AddTagAliasModal = forwardRef<AddTagAliasModalHandle, AddTagAliasModalProps>(
  function AddTagAliasModal({ tagSearchUrl, addAliasUrl, onAliasAdded }, ref) {
    const [aliasName, setAliasName] = useState("");
    const [message, setMessage] = useState("");

    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstanceRef = useRef<Modal | null>(null);
    const selectValueRef = useRef<SelectValueHandle>(null);
    const aliasInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      openModal: () => {
        // Reset form
        setAliasName("");
        setMessage("");
        selectValueRef.current?.setValue("");

        if (modalRef.current) {
          modalInstanceRef.current = new Modal(modalRef.current);
          modalInstanceRef.current.show();
          setTimeout(() => {
            selectValueRef.current?.focus();
          }, 500);
        }
      },
    }));

    const handleSelectAlias = () => {
      aliasInputRef.current?.focus();
    };

    const handleAddAlias = () => {
      const tagName = selectValueRef.current?.search || "";

      if (!tagName || !aliasName) {
        setMessage("Both tag name and alias name are required");
        return;
      }

      doPost(
        addAliasUrl,
        {
          tag_name: tagName,
          alias_name: aliasName,
        },
        () => {
          // Reset form
          setAliasName("");
          setMessage("");
          selectValueRef.current?.setValue("");

          // Close modal
          modalInstanceRef.current?.hide();

          // Notify parent to refresh the list
          onAliasAdded();
        },
        "Tag alias added",
        ""
      );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleAddAlias();
      }
    };

    return (
      <div
        ref={modalRef}
        id="modal-tagalias"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="myModalLabel">
                New Tag Alias
              </h4>
              <button
                type="button"
                className="close-button btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="form-row align-items-center">
                <div className="mx-1 d-flex">
                  <div className="w-100 me-3">
                    <SelectValue
                      ref={selectValueRef}
                      searchUrl={`${tagSearchUrl}?skip_tag_aliases=true&query=`}
                      placeHolder="Tag name"
                      onSelect={handleSelectAlias}
                    />
                  </div>
                  <input
                    ref={aliasInputRef}
                    id="tag-alias-alias"
                    className="form-control"
                    type="text"
                    name="alias"
                    autoComplete="off"
                    placeholder="Alias"
                    value={aliasName}
                    onChange={(e) => setAliasName(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer align-items-start align-items-center">
              <div className="mt-2 text-secondary">
                {message && (
                  <>
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="me-1 pt-1 success"
                    />
                    {message}
                  </>
                )}
              </div>
              <input
                className="btn btn-primary"
                type="button"
                value="Save"
                onClick={handleAddAlias}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default AddTagAliasModal;
