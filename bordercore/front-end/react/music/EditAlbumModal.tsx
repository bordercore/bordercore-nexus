import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import type { Album } from "./types";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";

interface EditAlbumModalProps {
  album: Album;
  initialTags: string[];
  updateAlbumUrl: string;
  searchArtistsUrl: string;
  searchTagsUrl: string;
  onAlbumUpdated?: () => void;
}

export interface EditAlbumModalHandle {
  openModal: () => void;
}

export const EditAlbumModal = React.forwardRef<EditAlbumModalHandle, EditAlbumModalProps>(
  function EditAlbumModal(
    { album, initialTags, updateAlbumUrl, searchArtistsUrl, searchTagsUrl, onAlbumUpdated },
    ref
  ) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(album.title);
    const [artistName, setArtistName] = useState(album.artist_name);
    const [year, setYear] = useState(album.year?.toString() || "");
    const [note, setNote] = useState(album.note);
    const [tags, setTags] = useState<string[]>(initialTags);
    const [coverImageFilename, setCoverImageFilename] = useState("");
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const titleRef = useRef<HTMLInputElement>(null);
    const tagsRef = useRef<TagsInputHandle>(null);
    const artistRef = useRef<SelectValueHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openModal = useCallback(() => {
      setTitle(album.title);
      setArtistName(album.artist_name);
      setYear(album.year?.toString() || "");
      setNote(album.note);
      setTags(initialTags);
      setCoverImageFilename("");
      setCoverImageFile(null);
      setOpen(true);
    }, [album, initialTags]);

    useImperativeHandle(ref, () => ({ openModal }), [openModal]);

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
      if (!open) return;
      const t = window.setTimeout(() => titleRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [open, close]);

    const handleArtistSelect = (option: { label?: string; artist?: string }) => {
      setArtistName(option.artist || option.label || "");
    };

    const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setCoverImageFilename(file.name);
        setCoverImageFile(file);
      }
    };

    const submit = async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("artist", artistName);
        formData.append("year", year);
        formData.append("note", note || "");
        formData.append("tags", tags.join(","));
        if (coverImageFile) {
          formData.append("cover_image", coverImageFile);
        }
        await axios.post(updateAlbumUrl, formData, { withCredentials: true });
        if (onAlbumUpdated) {
          onAlbumUpdated();
        } else {
          window.location.href = window.location.pathname + "?cache_buster=" + Date.now();
        }
      } catch (error) {
        console.error("Error updating album:", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    const canSubmit = title.trim().length > 0 && artistName.trim().length > 0;

    if (!open) return null;

    return createPortal(
      <>
        <div className="refined-modal-scrim" onClick={close} />
        <form
          className="refined-modal"
          role="dialog"
          aria-label="edit album"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
          encType="multipart/form-data"
        >
          <button type="button" className="refined-modal-close" onClick={close} aria-label="close">
            <FontAwesomeIcon icon={faTimes} />
          </button>

          <div className="refined-modal-eyebrow">
            <span>edit album</span>
            <span className="dot">·</span>
            <span className="mono">bordercore / music / edit</span>
          </div>

          <h2 className="refined-modal-title">Edit album</h2>

          <div className="refined-field">
            <label htmlFor="album-edit-title">title</label>
            <input
              ref={titleRef}
              id="album-edit-title"
              type="text"
              autoComplete="off"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="refined-field">
            <label htmlFor="album-edit-artist">artist</label>
            <SelectValue
              ref={artistRef}
              id="album-edit-artist"
              label="artist"
              searchUrl={`${searchArtistsUrl}?term=`}
              placeHolder=""
              initialValue={{ label: artistName, artist: artistName }}
              onSelect={handleArtistSelect}
            />
          </div>

          <div className="refined-row-2">
            <div className="refined-field">
              <label htmlFor="album-edit-year">year</label>
              <input
                id="album-edit-year"
                type="number"
                autoComplete="off"
                value={year}
                onChange={e => setYear(e.target.value)}
              />
            </div>
            <div className="refined-field">
              <label htmlFor="album-edit-note">
                note <span className="optional">· optional</span>
              </label>
              <input
                id="album-edit-note"
                type="text"
                autoComplete="off"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="refined-field">
            <label htmlFor="album-edit-tags">
              tags <span className="optional">· optional</span>
            </label>
            <TagsInput
              ref={tagsRef}
              id="album-edit-tags"
              searchUrl={`${searchTagsUrl}?query=`}
              initialTags={tags}
              onTagsChanged={setTags}
            />
          </div>

          <div className="refined-field">
            <label htmlFor="album-edit-cover">
              cover image <span className="optional">· optional</span>
            </label>
            <div className="refined-file">
              <input
                id="album-edit-cover"
                type="text"
                value={coverImageFilename}
                placeholder="no file selected"
                readOnly
              />
              <label className="refined-btn ghost refined-file-pick">
                Choose image
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleCoverImageSelect}
                />
              </label>
            </div>
          </div>

          <div className="refined-modal-actions compact">
            <button type="button" className="refined-btn ghost" onClick={close}>
              cancel
            </button>
            <button
              type="submit"
              className="refined-btn primary"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "saving…" : "save"}
            </button>
          </div>
        </form>
      </>,
      document.body
    );
  }
);

export default EditAlbumModal;
