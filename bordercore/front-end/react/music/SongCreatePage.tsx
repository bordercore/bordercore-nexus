import React, { useRef, useState, useCallback } from "react";
import axios from "axios";  // Still needed for ID3 extraction and dupe check
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faMusic, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import Card from "../common/Card";

interface SourceOption {
  id: number;
  name: string;
}

interface SongFormData {
  title: string;
  artist: string;
  track: string;
  year: string;
  original_year: string;
  rating: number | null;
  note: string;
  album_name: string;
  compilation: boolean;
  album_artist: string;
  tags: string[];
  source: number | null;
  length: number | null;
}

interface SongFormErrors {
  title?: string[];
  artist?: string[];
  track?: string[];
  year?: string[];
  original_year?: string[];
  rating?: string[];
  note?: string[];
  album_name?: string[];
  compilation?: string[];
  album_artist?: string[];
  tags?: string[];
  source?: string[];
  song?: string[];
  non_field_errors?: string[];
}

interface DupeSong {
  uuid: string;
  title: string;
  url: string;
  note?: string;
  album_name?: string;
  album_url?: string;
}

interface SongInfo {
  songLength: number | null;
  songLengthPretty: string | null;
  songSize: string | null;
  sampleRate: string | null;
  bitRate: string | null;
}

interface TagSuggestion {
  name: string;
  count: number;
}

interface SongCreatePageProps {
  submitUrl: string;
  cancelUrl: string;
  csrfToken: string;
  tagSearchUrl: string;
  artistSearchUrl: string;
  dupeCheckUrl: string;
  id3InfoUrl: string;
  tagSuggestions: TagSuggestion[];
  sourceOptions: SourceOption[];
  initialSourceId: number | null;
}

export function SongCreatePage({
  submitUrl,
  cancelUrl,
  csrfToken,
  tagSearchUrl,
  artistSearchUrl,
  dupeCheckUrl,
  id3InfoUrl,
  tagSuggestions,
  sourceOptions,
  initialSourceId,
}: SongCreatePageProps) {
  const [formData, setFormData] = useState<SongFormData>({
    title: "",
    artist: "",
    track: "",
    year: "",
    original_year: "",
    rating: null,
    note: "",
    album_name: "",
    compilation: false,
    album_artist: "Various Artists",
    tags: [],
    source: initialSourceId,
    length: null,
  });
  const [errors, setErrors] = useState<SongFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [dupeSongs, setDupeSongs] = useState<DupeSong[]>([]);
  const [songInfo, setSongInfo] = useState<SongInfo>({
    songLength: null,
    songLengthPretty: null,
    songSize: null,
    sampleRate: null,
    bitRate: null,
  });
  const [filename, setFilename] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);

  // Rating hover state
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Refs for components
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const selectValueRef = useRef<SelectValueHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    let newValue: string | boolean | number | null = value;
    if (type === "checkbox") {
      newValue = checked;
    } else if (name === "source") {
      newValue = value ? parseInt(value, 10) : null;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear error for this field
    if (errors[name as keyof SongFormErrors]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof SongFormErrors];
        return newErrors;
      });
    }
  };

  const handleArtistSelect = (option: { label?: string; artist?: string }) => {
    const artistName = option.artist || option.label || "";
    setFormData((prev) => ({
      ...prev,
      artist: artistName,
    }));
    checkForDuplicates(artistName, formData.title);
  };

  const handleTitleBlur = () => {
    checkForDuplicates(formData.artist, formData.title);
  };

  const checkForDuplicates = useCallback(
    async (artist: string, title: string) => {
      if (!artist || !title) {
        return;
      }

      try {
        const response = await axios.get(
          `${dupeCheckUrl}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
        );
        const dupes = response.data.dupes || [];
        setDupeSongs(dupes);
      } catch (error) {
        console.error("Error checking for duplicates:", error);
      }
    },
    [dupeCheckUrl]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setSongFile(file);
    setProcessingFile(true);

    // Upload file to get ID3 info
    const uploadData = new FormData();
    uploadData.append("song", file);

    try {
      const response = await axios.post(id3InfoUrl, uploadData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-CSRFToken": csrfToken,
        },
      });

      const data = response.data;

      // Update form fields with ID3 data
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        artist: data.artist || prev.artist,
        year: data.year || prev.year,
        track: data.track || prev.track,
        album_name: data.album_name || prev.album_name,
        length: data.length || prev.length,
      }));

      // Update artist select if we got an artist
      if (data.artist && selectValueRef.current) {
        selectValueRef.current.setValue(data.artist);
      }

      // Update song info
      setSongInfo({
        songLength: data.length,
        songLengthPretty: data.length_pretty,
        songSize: data.filesize,
        sampleRate: data.sample_rate,
        bitRate: data.bit_rate,
      });

      // Check for duplicates after ID3 extraction
      if (data.artist && data.title) {
        checkForDuplicates(data.artist, data.title);
      }
    } catch (error) {
      console.error("Error extracting ID3 info:", error);
    } finally {
      setProcessingFile(false);
    }
  };

  const handleTagClick = (tagName: string) => {
    // Check if tag already exists
    const currentTags = tagsInputRef.current?.getTags() || [];
    if (currentTags.includes(tagName)) {
      return;
    }
    tagsInputRef.current?.addTag(tagName);
  };

  const handleTagsChanged = (tags: string[]) => {
    setFormData((prev) => ({
      ...prev,
      tags,
    }));
  };

  // Star rating handlers
  const handleRatingMouseOver = (starIndex: number) => {
    setHoverRating(starIndex + 1);
  };

  const handleRatingMouseLeave = () => {
    setHoverRating(null);
  };

  const handleRatingClick = (starIndex: number) => {
    const clickedRating = starIndex + 1;
    // If clicking the same rating, deselect it
    if (clickedRating === formData.rating) {
      setFormData((prev) => ({ ...prev, rating: null }));
    } else {
      setFormData((prev) => ({ ...prev, rating: clickedRating }));
    }
  };

  const displayRating = hoverRating ?? formData.rating ?? 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Validate file is selected - if not, prevent submission and show error
    if (!songFile) {
      e.preventDefault();
      setErrors({ song: ["Please select a song file to upload."] });
      return;
    }
    // Let the form submit naturally (don't call e.preventDefault())
    // Browser will POST form data and follow the redirect
  };

  return (
    <div className="row g-0 h-100 music-dashboard">
      {/* Left sidebar */}
      <div className="col-lg-3 d-flex flex-column pe-2">
        <div className="w-100">
          {/* Duplicate songs warning */}
          {dupeSongs.length > 0 && (
            <Card className="backdrop-filter ms-3">
              <h6 className="text-warning mb-2 text-center">
                Possible duplicate songs found
              </h6>
              {dupeSongs.map((dupe) => (
                <div key={dupe.uuid} className="my-2">
                  <hr className="divider" />
                  <div className="d-flex">
                    <FontAwesomeIcon icon={faMusic} className="text-secondary mt-2" />
                    <div className="ms-2">
                      <a href={dupe.url} target="bc-dupe-song">
                        {dupe.title}
                      </a>
                      {dupe.note && (
                        <div className="dupe-song-note text-truncate">{dupe.note}</div>
                      )}
                      {dupe.album_name && (
                        <div>
                          <a className="text-primary" href={dupe.album_url}>
                            {dupe.album_name}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Song Info Card - only shown after file is selected */}
          {songInfo.songLength !== null && (
            <Card title="Song Info" className="backdrop-filter ms-3">
              <ul>
                <li>
                  Song Length <span className="ms-1 text-primary">{songInfo.songLengthPretty}</span>
                </li>
                {songInfo.songSize && (
                  <li>
                    Song Size <span className="ms-1 text-primary">{songInfo.songSize}</span>
                  </li>
                )}
                {songInfo.sampleRate && (
                  <li>
                    Sample Rate <span className="ms-1 text-primary">{songInfo.sampleRate}</span>
                  </li>
                )}
                {songInfo.bitRate && (
                  <li>
                    Bit Rate <span className="ms-1 text-primary">{songInfo.bitRate}</span>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Tag Suggestions Card */}
          <Card title="Tag Suggestions" className="backdrop-filter ms-3">
            <hr className="divider" />
            <ul className="list-group interior-borders">
              {tagSuggestions.map((tag) => (
                <li
                  key={tag.name}
                  className="list-with-counts ps-2 py-1 pe-2 d-flex"
                  onClick={() => handleTagClick(tag.name)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="text-truncate">{tag.name}</div>
                  <div className="ms-auto me-1">
                    <span className="px-2 badge rounded-pill">{tag.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Instructions Card - shown before file is selected */}
          {songInfo.songLength === null && (
            <Card className="backdrop-filter ms-3">
              <div>
                Choose the local MP3 file containing the song you want to upload. Any embedded{" "}
                <strong>ID3v2</strong> tags will be scanned and the corresponding form fields will
                be populated.
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Main form area */}
      <div className="col-lg-8 h-100">
        <p className="lead offset-lg-3 fw-bold ps-2">New Song</p>

        <form id="song-form" action={submitUrl} method="POST" onSubmit={handleSubmit} encType="multipart/form-data" noValidate>
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
          {errors.non_field_errors && (
            <div className="row">
              <div className="col-lg-9 offset-lg-3">
                <div className="form-error mb-2">
                  {errors.non_field_errors.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className={`row mb-3 ${errors.song ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">File</label>
            <div className="col-lg-9">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  id="id_filename"
                  value={filename}
                  readOnly
                  autoComplete="off"
                />
                <label className="btn btn-primary">
                  {processingFile ? "Processing..." : "Choose song"}
                  <input
                    type="file"
                    ref={fileInputRef}
                    id="id_file"
                    name="song"
                    hidden
                    accept="audio/*"
                    onChange={handleFileChange}
                    disabled={processingFile}
                  />
                </label>
              </div>
              {errors.song && <span className="form-error">{errors.song.join(", ")}</span>}
            </div>
          </div>

          {/* Title */}
          <div className={`row mb-3 ${errors.title ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Title</label>
            <div className="col-lg-9">
              <input
                type="text"
                className={`form-control ${errors.title ? "is-invalid" : ""}`}
                id="id_title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleTitleBlur}
                autoComplete="off"
              />
              {errors.title && <span className="form-error">{errors.title.join(", ")}</span>}
            </div>
          </div>

          {/* Artist */}
          <div className={`row mb-3 ${errors.artist ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Artist</label>
            <div className="col-lg-9">
              <SelectValue
                ref={selectValueRef}
                id="id_artist"
                label="artist"
                searchUrl={`${artistSearchUrl}?term=`}
                placeHolder=""
                onSelect={handleArtistSelect}
              />
              <input type="hidden" name="artist" value={formData.artist} />
              {errors.artist && <span className="form-error">{errors.artist.join(", ")}</span>}
            </div>
          </div>

          {/* Track */}
          <div className={`row mb-3 ${errors.track ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Track</label>
            <div className="col-lg-9">
              <input
                type="text"
                className={`form-control ${errors.track ? "is-invalid" : ""}`}
                id="id_track"
                name="track"
                value={formData.track}
                onChange={handleChange}
                autoComplete="off"
              />
              {errors.track && <span className="form-error">{errors.track.join(", ")}</span>}
            </div>
          </div>

          {/* Year */}
          <div className={`row mb-3 ${errors.year ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Year</label>
            <div className="col-lg-9">
              <input
                type="text"
                className={`form-control ${errors.year ? "is-invalid" : ""}`}
                id="id_year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                autoComplete="off"
              />
              {errors.year && <span className="form-error">{errors.year.join(", ")}</span>}
            </div>
          </div>

          {/* Original Year */}
          <div className={`row mb-3 ${errors.original_year ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Original Year</label>
            <div className="col-lg-9">
              <input
                type="text"
                className={`form-control ${errors.original_year ? "is-invalid" : ""}`}
                id="id_original_year"
                name="original_year"
                value={formData.original_year}
                onChange={handleChange}
                autoComplete="off"
              />
              {errors.original_year && (
                <span className="form-error">{errors.original_year.join(", ")}</span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className={`row mb-3 ${errors.tags ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Tags</label>
            <div className="col-lg-9">
              <TagsInput
                ref={tagsInputRef}
                id="id_tags"
                name="tags"
                searchUrl={`${tagSearchUrl}?query=`}
                initialTags={[]}
                onTagsChanged={handleTagsChanged}
              />
              {errors.tags && <span className="form-error">{errors.tags.join(", ")}</span>}
            </div>
          </div>

          {/* Album Name */}
          <div className={`row mb-3 ${errors.album_name ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Album</label>
            <div className="col-lg-9">
              <input
                type="text"
                className={`form-control ${errors.album_name ? "is-invalid" : ""}`}
                id="id_album_name"
                name="album_name"
                value={formData.album_name}
                onChange={handleChange}
                autoComplete="off"
              />
              {errors.album_name && (
                <span className="form-error">{errors.album_name.join(", ")}</span>
              )}
            </div>
          </div>

          {/* Compilation Toggle */}
          <div className="row align-items-center mb-3">
            <div className="col-lg-9 offset-lg-3 form-inline">
              <div className="d-flex align-items-center">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="id_compilation"
                    name="compilation"
                    checked={formData.compilation}
                    onChange={handleChange}
                  />
                  <label className="form-check-label ms-2" htmlFor="id_compilation">
                    Compilation
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Album Artist - only shown when compilation is checked */}
          {formData.compilation && (
            <div className={`row mb-3 ${errors.album_artist ? "error" : ""}`}>
              <label className="col-lg-3 col-form-label fw-bold text-end">Album Artist</label>
              <div className="col-lg-9">
                <input
                  type="text"
                  className={`form-control ${errors.album_artist ? "is-invalid" : ""}`}
                  id="id_album_artist"
                  name="album_artist"
                  value={formData.album_artist}
                  onChange={handleChange}
                  autoComplete="off"
                />
                {errors.album_artist && (
                  <span className="form-error">{errors.album_artist.join(", ")}</span>
                )}
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="row align-items-center mb-3">
            <label className="col-lg-3 col-form-label fw-bold text-end">Rating</label>
            <div className="col-lg-9" onMouseLeave={handleRatingMouseLeave}>
              {[0, 1, 2, 3, 4].map((starIndex) => (
                <span
                  key={starIndex}
                  className={`rating-no-hover me-1 ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                  data-rating={starIndex}
                  onClick={() => handleRatingClick(starIndex)}
                  onMouseOver={() => handleRatingMouseOver(starIndex)}
                  style={{ cursor: "pointer" }}
                >
                  <FontAwesomeIcon icon={faStar} />
                </span>
              ))}
              <input type="hidden" name="rating" value={formData.rating || ""} />
            </div>
          </div>

          {/* Hidden input for length */}
          <input type="hidden" name="length" value={formData.length || ""} />

          {/* Note */}
          <div className={`row mb-3 ${errors.note ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Note</label>
            <div className="col-lg-9">
              <textarea
                className={`form-control ${errors.note ? "is-invalid" : ""}`}
                id="id_note"
                name="note"
                rows={3}
                value={formData.note}
                onChange={handleChange}
              />
              {errors.note && <span className="form-error">{errors.note.join(", ")}</span>}
            </div>
          </div>

          {/* Source */}
          <div className={`row mb-3 ${errors.source ? "error" : ""}`}>
            <label className="col-lg-3 col-form-label fw-bold text-end">Source</label>
            <div className="col-lg-9">
              <select
                className={`form-control form-select ${errors.source ? "is-invalid" : ""}`}
                id="id_source"
                name="source"
                value={formData.source || ""}
                onChange={handleChange}
              >
                {sourceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {errors.source && <span className="form-error">{errors.source.join(", ")}</span>}
            </div>
          </div>

          {/* Submit buttons */}
          <div>
            <div className="col-lg-9 offset-lg-3">
              <button type="submit" className="btn btn-primary ms-2" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </button>
              <a href={cancelUrl} className="ms-3">
                <FontAwesomeIcon icon={faArrowLeft} className="me-1" />
                Cancel
              </a>
            </div>
          </div>
        </form>
      </div>

      {/* Processing Modal */}
      {processingFile && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Processing...</span>
                </div>
                <p className="mb-0">Processing song file...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SongCreatePage;
