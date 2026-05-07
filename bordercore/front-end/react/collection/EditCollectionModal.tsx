import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { CollectionDetail } from "./types";
import { getCsrfToken } from "../utils/reactUtils";

interface EditCollectionModalProps {
  open: boolean;
  onClose: () => void;
  collection: CollectionDetail;
  initialTags: string[];
  updateUrl: string;
  tagSearchUrl: string;
}

export function EditCollectionModal({
  open,
  onClose,
  collection,
  initialTags,
  updateUrl,
  tagSearchUrl,
}: EditCollectionModalProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [isFavorite, setIsFavorite] = useState(collection.is_favorite);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  useEffect(() => {
    setName(collection.name);
    setDescription(collection.description || "");
    setIsFavorite(collection.is_favorite);
  }, [collection]);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(collection.name);
    setDescription(collection.description || "");
    setIsFavorite(collection.is_favorite);
    tagsInputRef.current?.setTagList(initialTags);
  }, [open, collection, initialTags]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 40);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        action={updateUrl}
        method="post"
        role="dialog"
        aria-label="edit collection"
        onSubmit={e => {
          const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
            'input[name="csrfmiddlewaretoken"]'
          );
          if (tokenInput) tokenInput.value = getCsrfToken();
        }}
      >
        <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />

        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Edit collection</h2>

        <div className="refined-field">
          <label htmlFor="collection-edit-name">name</label>
          <input
            ref={nameInputRef}
            id="collection-edit-name"
            type="text"
            name="name"
            autoComplete="off"
            maxLength={200}
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="collection-edit-description">
            description <span className="optional">· optional</span>
          </label>
          <textarea
            id="collection-edit-description"
            name="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="refined-field">
          <label htmlFor="collection-edit-tags">
            tags <span className="optional">· optional</span>
          </label>
          <TagsInput
            ref={tagsInputRef}
            id="collection-edit-tags"
            name="tags"
            searchUrl={`${tagSearchUrl}?query=`}
            initialTags={initialTags}
          />
        </div>

        <div className="refined-toggle-row">
          <label className="refined-toggle">
            <ToggleSwitch name="is_favorite" checked={isFavorite} onChange={setIsFavorite} />
            <span>favorite</span>
          </label>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            save
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default EditCollectionModal;
