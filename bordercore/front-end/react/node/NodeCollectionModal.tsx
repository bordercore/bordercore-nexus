import React, { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
import { SelectValue } from "../common/SelectValue";
import { ROTATE_OPTIONS } from "./types";

const DISPLAY_OPTIONS = [
  { value: "list", display: "List" },
  { value: "individual", display: "Individual" },
] as const;

export interface CollectionSettings {
  uuid?: string;
  name: string;
  collection_type: "ad-hoc" | "permanent";
  display: "list" | "individual";
  rotate: number;
  random_order: boolean;
  limit: number | null;
  objectCount?: number;
}

interface NodeCollectionModalProps {
  isOpen: boolean;
  action: "Add" | "Edit";
  searchUrl: string;
  data: CollectionSettings | null;
  onSave: (settings: CollectionSettings) => void;
  onAddCollection: (settings: CollectionSettings) => void;
  onClose: () => void;
}

const defaultSettings: CollectionSettings = {
  name: "New Collection",
  collection_type: "ad-hoc",
  display: "list",
  rotate: -1,
  random_order: false,
  limit: null,
};

export default function NodeCollectionModal({
  isOpen,
  action,
  searchUrl,
  data,
  onSave,
  onAddCollection,
  onClose,
}: NodeCollectionModalProps) {
  const [settings, setSettings] = useState<CollectionSettings>(defaultSettings);
  const [selectedCollectionUuid, setSelectedCollectionUuid] = useState<string | null>(null);

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
    if (isOpen) {
      setSettings(data || defaultSettings);
      setSelectedCollectionUuid(null);
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

  const handleCollectionSelect = (collection: { uuid: string; name: string }) => {
    setSelectedCollectionUuid(collection.uuid);
  };

  const handleSave = () => {
    const settingsToSave = {
      ...settings,
      uuid:
        settings.collection_type === "permanent"
          ? selectedCollectionUuid || settings.uuid
          : undefined,
    };

    if (action === "Add") {
      onAddCollection(settingsToSave);
    } else {
      onSave(settingsToSave);
    }
    modalInstanceRef.current?.hide();
  };

  return (
    <div
      ref={modalRef}
      className="modal fade"
      id="modalEditCollection"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="myModalLabel">
              {action} Collection
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
              <>
                <div className="form-section">Type</div>
                <div className="row mt-3">
                  <div className="col-lg-4">
                    <div className="form-check d-flex align-items-center">
                      <input
                        id="id_type_new"
                        className="form-check-input"
                        type="radio"
                        name="type"
                        checked={settings.collection_type === "ad-hoc"}
                        onChange={() =>
                          setSettings(prev => ({
                            ...prev,
                            collection_type: "ad-hoc",
                          }))
                        }
                      />
                      <label className="form-check-label ms-2" htmlFor="id_type_new">
                        New
                      </label>
                    </div>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-lg-4">
                    <div className="form-check d-flex align-items-center">
                      <input
                        id="id_type_existing"
                        className="form-check-input"
                        type="radio"
                        name="type"
                        checked={settings.collection_type === "permanent"}
                        onChange={() =>
                          setSettings(prev => ({
                            ...prev,
                            collection_type: "permanent",
                          }))
                        }
                      />
                      <label className="form-check-label ms-2" htmlFor="id_type_existing">
                        Existing
                      </label>
                    </div>
                  </div>
                  <div className="col-lg-8">
                    {settings.collection_type === "permanent" && (
                      <SelectValue
                        label="name"
                        placeHolder="Search collections"
                        searchUrl={searchUrl}
                        onSelect={handleCollectionSelect}
                        optionSlot={({ option }) => (
                          <div className="search-suggestion d-flex align-items-center">
                            <div>
                              <img
                                className="me-2 mt-2"
                                width="50"
                                height="50"
                                src={option.cover_url}
                                alt=""
                              />
                            </div>
                            <div className="d-flex flex-column">
                              <div>{option.name}</div>
                              <div className="text-secondary lh-1">
                                <small>{option.num_objects} objects</small>
                              </div>
                            </div>
                          </div>
                        )}
                      />
                    )}
                  </div>
                </div>
                <hr className="my-3" />
              </>
            )}

            <div className="form-section">Options</div>

            {settings.collection_type === "ad-hoc" && (
              <div className="row mb-3 mt-3">
                <label className="col-lg-4 col-form-label" htmlFor="inputName">
                  Name
                </label>
                <div className="col-lg-8">
                  <input
                    ref={nameInputRef}
                    id="inputName"
                    type="text"
                    className="form-control"
                    autoComplete="off"
                    maxLength={200}
                    placeholder="Name"
                    value={settings.name}
                    onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleSave();
                    }}
                  />
                </div>
              </div>
            )}

            <div className="row mt-3">
              <label className="col-lg-4 col-form-label" htmlFor="inputDisplay">
                Display
              </label>
              <div className="col-lg-8">
                <select
                  id="inputDisplay"
                  className="form-control form-select"
                  value={settings.display}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      display: e.target.value as "list" | "individual",
                    }))
                  }
                >
                  {DISPLAY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.display}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {settings.display === "individual" ? (
              <div className="row mt-3">
                <label className="col-lg-4 col-form-label" htmlFor="inputRotate">
                  Rotate
                </label>
                <div className="col-lg-8">
                  <select
                    id="inputRotate"
                    className="form-control form-select"
                    value={settings.rotate}
                    onChange={e =>
                      setSettings(prev => ({
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
            ) : (
              <div className="row mt-3">
                <label className="col-lg-4 col-form-label" htmlFor="inputLimit">
                  Limit
                </label>
                <div className="col-lg-8">
                  <input
                    id="inputLimit"
                    type="number"
                    className="form-control"
                    autoComplete="off"
                    min={1}
                    max={data?.objectCount || undefined}
                    value={settings.limit ?? ""}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        limit: e.target.value ? parseInt(e.target.value, 10) : null,
                      }))
                    }
                    onKeyDown={e => {
                      if (e.key === "Enter") handleSave();
                    }}
                  />
                </div>
              </div>
            )}

            <div className="row align-items-center mt-2 mb-3">
              <label className="col-lg-4 col-form-label" htmlFor="inputRandomOrder">
                Random Order
              </label>
              <div className="col-lg-8">
                <input
                  id="inputRandomOrder"
                  type="checkbox"
                  className="form-check-input"
                  checked={settings.random_order}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      random_order: e.target.checked,
                    }))
                  }
                />
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
