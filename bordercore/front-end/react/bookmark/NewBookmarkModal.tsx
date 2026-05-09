import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { doGet, doPost } from "../utils/reactUtils";

interface CreatedBookmark {
  uuid: string;
  url: string;
  name: string;
}

interface NewBookmarkModalProps {
  open: boolean;
  onClose: () => void;
  createApiUrl: string;
  tagSearchUrl: string;
  getTitleFromUrl: string;
  onAdd?: (bookmark: CreatedBookmark) => void;
}

export function NewBookmarkModal({
  open,
  onClose,
  createApiUrl,
  tagSearchUrl,
  getTitleFromUrl,
  onAdd,
}: NewBookmarkModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [importance, setImportance] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [daily, setDaily] = useState(false);

  const urlRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<TagsInputHandle>(null);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setName("");
    setNote("");
    setTags([]);
    setImportance(false);
    setIsPinned(false);
    setDaily(false);
    const t = window.setTimeout(() => urlRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = url.trim().length > 0 && name.trim().length > 0;

  // Mirror the existing BookmarkFormPage behavior: when the user fills in a URL
  // and tabs away with an empty name, fetch the page title for them.
  const handleUrlBlur = useCallback(() => {
    if (!url || name) return;
    const encoded = encodeURIComponent(url).replace(/%/g, "%25");
    doGet(
      `${getTitleFromUrl}?url=${encoded}`,
      response => {
        if (response.data?.title && !name) {
          setName(response.data.title);
        }
      },
      "Error getting title from url"
    );
  }, [url, name, getTitleFromUrl]);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    doPost(
      createApiUrl,
      {
        url,
        name,
        note,
        tags: tags.join(","),
        importance: importance ? "true" : "false",
        is_pinned: isPinned ? "true" : "false",
        daily: daily ? "true" : "false",
      },
      response => {
        onAdd?.(response.data);
        onClose();
      },
      "Bookmark created."
    );
  }, [canSubmit, createApiUrl, url, name, note, tags, importance, isPinned, daily, onAdd, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label="create new bookmark"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Create a bookmark</h2>

        <div className="refined-field">
          <label htmlFor="bookmark-new-url">url</label>
          <input
            ref={urlRef}
            id="bookmark-new-url"
            type="url"
            autoComplete="off"
            placeholder="https://…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="bookmark-new-name">name</label>
          <input
            id="bookmark-new-name"
            type="text"
            autoComplete="off"
            maxLength={200}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="bookmark-new-note">
            note <span className="optional">· optional</span>
          </label>
          <textarea id="bookmark-new-note" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="refined-field">
          <label htmlFor="bookmark-new-tags">
            tags <span className="optional">· optional</span>
          </label>
          <TagsInput
            ref={tagsRef}
            id="bookmark-new-tags"
            searchUrl={`${tagSearchUrl}?query=`}
            initialTags={tags}
            onTagsChanged={setTags}
          />
        </div>

        <div className="refined-toggle-row">
          <label className="refined-toggle">
            <ToggleSwitch name="importance" checked={importance} onChange={setImportance} />
            <span>important</span>
          </label>
          <label className="refined-toggle">
            <ToggleSwitch name="is_pinned" checked={isPinned} onChange={setIsPinned} />
            <span>pinned</span>
          </label>
          <label className="refined-toggle">
            <ToggleSwitch name="daily" checked={daily} onChange={setDaily} />
            <span>daily</span>
          </label>
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default NewBookmarkModal;
