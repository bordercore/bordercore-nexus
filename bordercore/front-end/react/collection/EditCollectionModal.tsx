import React, { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { Modal } from "bootstrap";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import type { CollectionDetail } from "./types";

export interface EditCollectionModalHandle {
  openModal: () => void;
}

interface EditCollectionModalProps {
  collection: CollectionDetail;
  initialTags: string[];
  updateUrl: string;
  tagSearchUrl: string;
  csrfToken: string;
}

export const EditCollectionModal = forwardRef<
  EditCollectionModalHandle,
  EditCollectionModalProps
>(function EditCollectionModal(
  { collection, initialTags, updateUrl, tagSearchUrl, csrfToken },
  ref
) {
  const [name, setName] = React.useState(collection.name);
  const [description, setDescription] = React.useState(collection.description || "");
  const [isFavorite, setIsFavorite] = React.useState(collection.is_favorite);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  // Update state when collection changes
  useEffect(() => {
    setName(collection.name);
    setDescription(collection.description || "");
    setIsFavorite(collection.is_favorite);
  }, [collection]);

  useImperativeHandle(ref, () => ({
    openModal: () => {
      // Reset to current collection values
      setName(collection.name);
      setDescription(collection.description || "");
      setIsFavorite(collection.is_favorite);
      tagsInputRef.current?.setTagList(initialTags);

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
      id="modalEdit"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="editModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form action={updateUrl} method="post" id="form-collection-edit">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="modal-header">
              <h4 className="modal-title" id="editModalLabel">
                Edit Collection
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
                <label className="col-lg-3 col-form-label" htmlFor="edit_id_name">
                  Name
                </label>
                <div className="col-lg-9 d-flex">
                  <input
                    ref={nameInputRef}
                    id="edit_id_name"
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
                <label className="col-lg-3 col-form-label" htmlFor="edit_id_description">
                  Description
                </label>
                <div className="col-lg-9 d-flex">
                  <textarea
                    id="edit_id_description"
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
                <label className="col-lg-3 col-form-label" htmlFor="edit_id_tags">
                  Tags
                </label>
                <div className="col-lg-9 d-flex">
                  <TagsInput
                    ref={tagsInputRef}
                    id="edit_id_tags"
                    name="tags"
                    searchUrl={`${tagSearchUrl}?query=`}
                    initialTags={initialTags}
                    placeholder="Add tags..."
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="col-lg-3 col-form-label">Is Favorite</label>
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
                id="btn-edit-action"
                className="btn btn-primary"
                type="submit"
                name="Go"
                value="Save"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

export default EditCollectionModal;
