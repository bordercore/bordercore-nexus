import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { Modal } from "bootstrap";
import TagsInput from "../common/TagsInput";

export interface CreateCollectionModalHandle {
  openModal: () => void;
}

interface CreateCollectionModalProps {
  createUrl: string;
  tagSearchUrl: string;
  csrfToken: string;
}

export const CreateCollectionModal = forwardRef<
  CreateCollectionModalHandle,
  CreateCollectionModalProps
>(function CreateCollectionModal({ createUrl, tagSearchUrl, csrfToken }, ref) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isFavorite, setIsFavorite] = React.useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openModal: () => {
      // Reset form
      setName("");
      setDescription("");
      setIsFavorite(true);

      if (modalRef.current) {
        modalInstanceRef.current = new Modal(modalRef.current);
        modalInstanceRef.current.show();
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 500);
      }
    },
  }));

  return (
    <div
      ref={modalRef}
      id="modalAdd"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form action={createUrl} method="post" id="form-collection-edit">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="modal-header">
              <h4 className="modal-title" id="myModalLabel">
                New Collection
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
                <label className="col-lg-3 col-form-label" htmlFor="id_name">
                  Name
                </label>
                <div className="col-lg-9 d-flex">
                  <input
                    ref={nameInputRef}
                    id="id_name"
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    maxLength={200}
                    required
                    className="form-control"
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="col-lg-3 col-form-label" htmlFor="id_description">
                  Description
                </label>
                <div className="col-lg-9 d-flex">
                  <textarea
                    id="id_description"
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    cols={40}
                    rows={3}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="col-lg-3 col-form-label" htmlFor="id_tags">
                  Tags
                </label>
                <div className="col-lg-9 d-flex">
                  <TagsInput
                    id="id_tags"
                    name="tags"
                    searchUrl={`${tagSearchUrl}?query=`}
                    placeholder="Add tags..."
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="col-lg-3 col-form-label">
                  Is Favorite
                </label>
                <div className="col-lg-9 d-flex align-items-center">
                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      name="is_favorite"
                      className="form-check-input"
                      checked={isFavorite}
                      onChange={(e) => setIsFavorite(e.target.checked)}
                      value="true"
                    />
                  </div>
                </div>
              </div>
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
          </form>
        </div>
      </div>
    </div>
  );
});

export default CreateCollectionModal;
