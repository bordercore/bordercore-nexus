import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import { SelectValue } from "../common/SelectValue";
import { ToggleSwitch } from "../common/ToggleSwitch";
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

  const nameInputRef = useRef<HTMLInputElement>(null);
  const displaySelectRef = useRef<HTMLSelectElement>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setSettings(data || defaultSettings);
    setSelectedCollectionUuid(null);
    const t = window.setTimeout(() => {
      // In Edit mode the name input doesn't exist for permanent collections,
      // so fall back to the always-present display select.
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      } else {
        displaySelectRef.current?.focus();
      }
    }, 40);
    return () => window.clearTimeout(t);
  }, [isOpen, data]);

  // Escape-to-close.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleCollectionSelect = (collection: { uuid: string; name: string }) => {
    setSelectedCollectionUuid(collection.uuid);
  };

  const handleSave = useCallback(() => {
    const settingsToSave: CollectionSettings = {
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
  }, [action, onAddCollection, onSave, selectedCollectionUuid, settings]);

  if (!isOpen) return null;

  const title = action === "Add" ? "Add a collection" : "Edit collection";
  const showNameInput = settings.collection_type === "ad-hoc";

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label={title.toLowerCase()}
        onSubmit={e => {
          e.preventDefault();
          handleSave();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">{title}</h2>

        {action === "Add" && (
          <div className="refined-field">
            <label>type</label>
            <div className="study-method-grid">
              <label
                className={`study-method-card ${
                  settings.collection_type === "ad-hoc" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="collection_type"
                  value="ad-hoc"
                  checked={settings.collection_type === "ad-hoc"}
                  onChange={() =>
                    setSettings(prev => ({
                      ...prev,
                      collection_type: "ad-hoc",
                    }))
                  }
                />
                <span className="title">New</span>
                <span className="hint">Build an ad-hoc list of objects.</span>
              </label>
              <label
                className={`study-method-card ${
                  settings.collection_type === "permanent" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="collection_type"
                  value="permanent"
                  checked={settings.collection_type === "permanent"}
                  onChange={() =>
                    setSettings(prev => ({
                      ...prev,
                      collection_type: "permanent",
                    }))
                  }
                />
                <span className="title">Existing</span>
                <span className="hint">Reference a saved collection.</span>
              </label>
            </div>
          </div>
        )}

        {action === "Add" && settings.collection_type === "permanent" && (
          <div className="refined-field">
            <label htmlFor="node-collection-existing">collection</label>
            <SelectValue
              id="node-collection-existing"
              label="name"
              placeHolder="Search collections"
              searchUrl={searchUrl}
              onSelect={handleCollectionSelect}
              optionSlot={({ option }) => (
                <div className="search-suggestion flex items-center">
                  <div>
                    <img
                      className="me-2 mt-2"
                      width="50"
                      height="50"
                      src={option.cover_url}
                      alt=""
                    />
                  </div>
                  <div className="flex flex-col">
                    <div>{option.name}</div>
                    <div className="text-ink-2 leading-none">
                      <small>{option.num_objects} objects</small>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        )}

        {showNameInput && (
          <div className="refined-field">
            <label htmlFor="node-collection-name">name</label>
            <input
              ref={nameInputRef}
              id="node-collection-name"
              type="text"
              autoComplete="off"
              maxLength={200}
              placeholder="Name"
              value={settings.name}
              onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
        )}

        <div className="refined-row-2">
          <div className="refined-field">
            <label htmlFor="node-collection-display">display</label>
            <select
              ref={displaySelectRef}
              id="node-collection-display"
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

          {settings.display === "individual" ? (
            <div className="refined-field">
              <label htmlFor="node-collection-rotate">rotate</label>
              <select
                id="node-collection-rotate"
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
          ) : (
            <div className="refined-field">
              <label htmlFor="node-collection-limit">
                limit <span className="optional">· optional</span>
              </label>
              <input
                id="node-collection-limit"
                type="number"
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
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="refined-toggle-row">
          <label className="refined-toggle">
            <ToggleSwitch
              name="random_order"
              checked={settings.random_order}
              onChange={checked =>
                setSettings(prev => ({
                  ...prev,
                  random_order: checked,
                }))
              }
            />
            <span>random order</span>
          </label>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary">
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            save
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
