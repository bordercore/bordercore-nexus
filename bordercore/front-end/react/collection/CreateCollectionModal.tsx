import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import TagsInput from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { getCsrfToken } from "../utils/reactUtils";

export interface CreateCollectionModalHandle {
  openModal: () => void;
}

interface CreateCollectionModalProps {
  createUrl: string;
  tagSearchUrl: string;
}

export const CreateCollectionModal = forwardRef<
  CreateCollectionModalHandle,
  CreateCollectionModalProps
>(function CreateCollectionModal({ createUrl, tagSearchUrl }, ref) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isFavorite, setIsFavorite] = useState(true);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);

  useImperativeHandle(ref, () => ({
    openModal: () => {
      setName("");
      setDescription("");
      setIsFavorite(true);
      setOpen(true);
    },
  }));

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 40);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", handler);
    };
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={close} />
      <form
        className="refined-modal"
        action={createUrl}
        method="post"
        role="dialog"
        aria-label="create new collection"
        onSubmit={e => {
          const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
            'input[name="csrfmiddlewaretoken"]'
          );
          if (tokenInput) tokenInput.value = getCsrfToken();
        }}
      >
        <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />

        <button type="button" className="refined-modal-close" onClick={close} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a collection</h2>

        <div className="refined-field">
          <label htmlFor="collection-new-name">name</label>
          <input
            ref={nameInputRef}
            id="collection-new-name"
            type="text"
            name="name"
            autoComplete="off"
            maxLength={200}
            placeholder="e.g. travel photos"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="collection-new-description">
            description <span className="optional">· optional</span>
          </label>
          <textarea
            id="collection-new-description"
            name="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="refined-field">
          <label htmlFor="collection-new-tags">
            tags <span className="optional">· optional</span>
          </label>
          <TagsInput id="collection-new-tags" name="tags" searchUrl={`${tagSearchUrl}?query=`} />
        </div>

        <div className="refined-toggle-row">
          <label className="refined-toggle">
            <ToggleSwitch name="is_favorite" checked={isFavorite} onChange={setIsFavorite} />
            <span>favorite</span>
          </label>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={close}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create collection
          </button>
        </div>
      </form>
    </>,
    document.body
  );
});

export default CreateCollectionModal;
