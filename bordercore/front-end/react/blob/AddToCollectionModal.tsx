import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Modal } from "bootstrap";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { doPost } from "../utils/reactUtils";

interface CollectionOption {
  uuid: string;
  name: string;
  cover_url: string;
  num_objects: number;
  contains_blob?: boolean;
}

interface AddToCollectionModalProps {
  blobUuid: string;
  searchUrl: string;
  addObjectUrl: string;
  addCollectionUrl: string;
  onAddToCollection?: () => void;
}

export interface AddToCollectionModalHandle {
  open: () => void;
  close: () => void;
}

export const AddToCollectionModal = forwardRef<AddToCollectionModalHandle, AddToCollectionModalProps>(
  function AddToCollectionModal(
    { blobUuid, searchUrl, addObjectUrl, addCollectionUrl, onAddToCollection },
    ref
  ) {
    const [showCreateNew, setShowCreateNew] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [collectionName, setCollectionName] = useState("");

    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstance = useRef<Modal | null>(null);
    const selectValueRef = useRef<SelectValueHandle>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (modalRef.current && !modalInstance.current) {
        modalInstance.current = new Modal(modalRef.current);
      }

      // Focus input when modal is shown
      const handleShown = () => {
        selectValueRef.current?.focus();
      };

      // Reset state when modal is hidden
      const handleHidden = () => {
        setShowCreateNew(false);
        setCollectionName("");
        setIsFavorite(false);
      };

      modalRef.current?.addEventListener("shown.bs.modal", handleShown);
      modalRef.current?.addEventListener("hidden.bs.modal", handleHidden);
      return () => {
        modalRef.current?.removeEventListener("shown.bs.modal", handleShown);
        modalRef.current?.removeEventListener("hidden.bs.modal", handleHidden);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      open: () => modalInstance.current?.show(),
      close: () => modalInstance.current?.hide(),
    }));

    const addBlobToCollection = useCallback(
      (collectionUuid: string) => {
        doPost(
          addObjectUrl,
          {
            collection_uuid: collectionUuid,
            blob_uuid: blobUuid,
          },
          () => {
            onAddToCollection?.();
            modalInstance.current?.hide();
            // Clear the search input
            selectValueRef.current?.setValue("");
          }
        );
      },
      [addObjectUrl, blobUuid, onAddToCollection]
    );

    const handleCollectionSelect = useCallback(
      (selection: CollectionOption) => {
        if (!selection.contains_blob) {
          addBlobToCollection(selection.uuid);
        }
      },
      [addBlobToCollection]
    );

    const handleCollectionCreate = useCallback(() => {
      if (!collectionName.trim()) return;

      doPost(
        addCollectionUrl,
        {
          is_favorite: isFavorite.toString(),
          name: collectionName,
        },
        (response) => {
          const collectionUuid = response.data.uuid;
          addBlobToCollection(collectionUuid);
        }
      );
    }, [addCollectionUrl, collectionName, isFavorite, addBlobToCollection]);

    const showCreateNewCollection = useCallback(() => {
      setShowCreateNew(true);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }, []);

    const renderOptionSlot = useCallback(
      ({ option }: { option: CollectionOption; search: string }) => {
        return (
          <div
            className={`search-suggestion d-flex align-items-center ${
              option.contains_blob ? "multiselect--disabled" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleCollectionSelect(option);
            }}
          >
            <div>
              <img className="me-2" width="50" height="50" src={option.cover_url} alt="" />
            </div>
            <div className="me-1">{option.name}</div>
            <div className="text-primary mx-1">
              <small>{option.num_objects} blobs</small>
            </div>
            {option.contains_blob && (
              <div className="text-warning ms-auto">Added</div>
            )}
          </div>
        );
      },
      [handleCollectionSelect]
    );

    return (
      <div
        ref={modalRef}
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        id="modalAddToCollection"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add blob to collection</h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="d-flex flex-column">
                {!showCreateNew ? (
                  <div id="search-collections" className="mb-0">
                    <SelectValue
                      ref={selectValueRef}
                      placeHolder="Search collections"
                      searchUrl={searchUrl}
                      onSelect={handleCollectionSelect}
                      optionSlot={renderOptionSlot}
                    />
                    <div className="mt-3">
                      <button
                        className="btn btn-primary d-flex ms-auto"
                        onClick={showCreateNewCollection}
                      >
                        Create new collection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={nameInputRef}
                      className="form-control mb-3"
                      type="text"
                      placeholder="Collection name"
                      autoComplete="off"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCollectionCreate();
                        }
                      }}
                    />
                    <div className="mt-3 d-flex">
                      <div className="me-3">Is Favorite</div>
                      <ToggleSwitch
                        checked={isFavorite}
                        onChange={setIsFavorite}
                      />
                    </div>
                    <button
                      className="btn btn-primary d-flex ms-auto"
                      onClick={handleCollectionCreate}
                    >
                      Create
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default AddToCollectionModal;
