import React from "react";
import axios from "axios";
import { Modal } from "bootstrap";
import type { Album, Artist } from "./types";

interface EditAlbumModalProps {
  album: Album;
  initialTags: string[];
  updateAlbumUrl: string;
  searchArtistsUrl: string;
  searchTagsUrl: string;
  csrfToken: string;
  onAlbumUpdated?: () => void;
}

export interface EditAlbumModalHandle {
  openModal: () => void;
}

interface ArtistSearchResult {
  name: string;
  uuid: string;
}

export const EditAlbumModal = React.forwardRef<EditAlbumModalHandle, EditAlbumModalProps>(
  function EditAlbumModal(
    { album, initialTags, updateAlbumUrl, searchArtistsUrl, searchTagsUrl, csrfToken, onAlbumUpdated },
    ref
  ) {
    const [title, setTitle] = React.useState(album.title);
    const [artistName, setArtistName] = React.useState(album.artist_name);
    const [year, setYear] = React.useState(album.year?.toString() || "");
    const [note, setNote] = React.useState(album.note);
    const [tags, setTags] = React.useState(initialTags.join(", "));
    const [coverImageFilename, setCoverImageFilename] = React.useState("");
    const [coverImageFile, setCoverImageFile] = React.useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [artistSuggestions, setArtistSuggestions] = React.useState<ArtistSearchResult[]>([]);
    const [showArtistSuggestions, setShowArtistSuggestions] = React.useState(false);
    const modalRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const artistInputRef = React.useRef<HTMLInputElement>(null);

    const openModal = React.useCallback(() => {
      // Reset form to current album values
      setTitle(album.title);
      setArtistName(album.artist_name);
      setYear(album.year?.toString() || "");
      setNote(album.note);
      setTags(initialTags.join(", "));
      setCoverImageFilename("");
      setCoverImageFile(null);

      if (modalRef.current) {
        const modal = new Modal(modalRef.current);
        modal.show();
      }
    }, [album, initialTags]);

    // Expose openModal to parent via ref
    React.useImperativeHandle(ref, () => ({
      openModal,
    }));

    // Search artists as user types
    const handleArtistChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setArtistName(value);

      if (value.length >= 2) {
        try {
          const response = await axios.get<ArtistSearchResult[]>(
            `${searchArtistsUrl}?term=${encodeURIComponent(value)}`
          );
          setArtistSuggestions(response.data);
          setShowArtistSuggestions(true);
        } catch (error) {
          console.error("Error searching artists:", error);
        }
      } else {
        setArtistSuggestions([]);
        setShowArtistSuggestions(false);
      }
    };

    const selectArtist = (artist: ArtistSearchResult) => {
      setArtistName(artist.name);
      setShowArtistSuggestions(false);
    };

    const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setCoverImageFilename(file.name);
        setCoverImageFile(file);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("title", title);
        formData.append("artist", artistName);
        formData.append("year", year);
        formData.append("note", note || "");
        formData.append("tags", tags);

        if (coverImageFile) {
          formData.append("cover_image", coverImageFile);
        }

        await axios.post(updateAlbumUrl, formData, {
          headers: {
            "X-CSRFToken": csrfToken,
          },
          withCredentials: true,
        });

        // Reload page to show updated data
        if (onAlbumUpdated) {
          onAlbumUpdated();
        } else {
          // Add cache buster to force image reload
          window.location.href = window.location.pathname + "?cache_buster=" + Date.now();
        }
      } catch (error) {
        console.error("Error updating album:", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    // Close suggestions when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          artistInputRef.current &&
          !artistInputRef.current.contains(e.target as Node)
        ) {
          setShowArtistSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div
        ref={modalRef}
        id="modalEditAlbum"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="editAlbumModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <form onSubmit={handleSubmit} encType="multipart/form-data">
              <div className="modal-header">
                <h4 id="editAlbumModalLabel" className="modal-title">
                  Edit Album
                </h4>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                {/* Title */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Title
                  </label>
                  <div className="col-lg-8">
                    <input
                      type="text"
                      name="title"
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Artist */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Artist
                  </label>
                  <div className="col-lg-8 position-relative" ref={artistInputRef}>
                    <input
                      type="text"
                      name="artist"
                      className="form-control"
                      value={artistName}
                      onChange={handleArtistChange}
                      onFocus={() => artistSuggestions.length > 0 && setShowArtistSuggestions(true)}
                      autoComplete="off"
                    />
                    {showArtistSuggestions && artistSuggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100" style={{ zIndex: 1000 }}>
                        {artistSuggestions.map((artist) => (
                          <li
                            key={artist.uuid}
                            className="list-group-item list-group-item-action"
                            onClick={() => selectArtist(artist)}
                            style={{ cursor: "pointer" }}
                          >
                            {artist.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Year */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Year
                  </label>
                  <div className="col-lg-8">
                    <input
                      type="number"
                      name="year"
                      className="form-control"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Tags
                  </label>
                  <div className="col-lg-8">
                    <input
                      type="text"
                      name="tags"
                      className="form-control"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="Comma-separated tags"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Note
                  </label>
                  <div className="col-lg-8">
                    <input
                      type="text"
                      name="note"
                      className="form-control"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Cover Image */}
                <div className="row mb-3">
                  <label className="col-lg-4 col-form-label fw-bold text-end">
                    Cover Image
                  </label>
                  <div className="col-lg-8">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={coverImageFilename}
                        readOnly
                        autoComplete="off"
                      />
                      <label className="btn btn-primary">
                        Choose image
                        <input
                          type="file"
                          ref={fileInputRef}
                          name="cover_image"
                          hidden
                          accept="image/*"
                          onChange={handleCoverImageSelect}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="row">
                  <div className="col-lg-12 offset-lg-4">
                    <button
                      id="btn-action"
                      className="btn btn-primary"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
);

export default EditAlbumModal;
