import React, { useRef, useEffect, useCallback } from "react";
import axios from "axios"; // Still needed for fetching form data and dupe check
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
  tags: string[];
  source: number | null;
  length: number | null;
  length_pretty: string;
  last_time_played: string;
  times_played: number;
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
  tags?: string[];
  source?: string[];
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

interface TagSuggestion {
  name: string;
  count: number;
}

interface SongEditPageProps {
  formAjaxUrl: string;
  submitUrl: string;
  cancelUrl: string;
  returnUrl?: string;
  csrfToken: string;
  tagSearchUrl: string;
  artistSearchUrl: string;
  dupeCheckUrl: string;
  tagSuggestions: TagSuggestion[];
}

export function SongEditPage({
  formAjaxUrl,
  submitUrl,
  cancelUrl,
  returnUrl,
  csrfToken,
  tagSearchUrl,
  artistSearchUrl,
  dupeCheckUrl,
  tagSuggestions,
}: SongEditPageProps) {
  const [formData, setFormData] = React.useState<SongFormData>({
    title: "",
    artist: "",
    track: "",
    year: "",
    original_year: "",
    rating: null,
    note: "",
    album_name: "",
    compilation: false,
    tags: [],
    source: null,
    length: null,
    length_pretty: "",
    last_time_played: "Never",
    times_played: 0,
  });
  const [errors, setErrors] = React.useState<SongFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [dupeSongs, setDupeSongs] = React.useState<DupeSong[]>([]);
  const [songUuid, setSongUuid] = React.useState<string>("");
  const [sourceOptions, setSourceOptions] = React.useState<SourceOption[]>([]);

  // Rating hover state
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  // Refs for components
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const selectValueRef = useRef<SelectValueHandle>(null);

  // Fetch initial form data
  useEffect(() => {
    const fetchFormData = async () => {
      if (formAjaxUrl) {
        try {
          setLoading(true);
          const response = await axios.get<
            SongFormData & { uuid?: string; source_options?: SourceOption[] }
          >(formAjaxUrl);
          setFormData(response.data);
          if (response.data.uuid) {
            setSongUuid(response.data.uuid);
          }
          // Set source options
          if (response.data.source_options) {
            setSourceOptions(response.data.source_options);
          }
          // Set initial tags in TagsInput
          if (tagsInputRef.current && response.data.tags) {
            tagsInputRef.current.setTagList(response.data.tags);
          }
        } catch (err) {
          console.error("Error fetching form data:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [formAjaxUrl]);

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

    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear error for this field
    if (errors[name as keyof SongFormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof SongFormErrors];
        return newErrors;
      });
    }
  };

  const handleArtistSelect = (option: { label?: string; artist?: string }) => {
    const artistName = option.artist || option.label || "";
    setFormData(prev => ({
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
        let dupes = response.data.dupes || [];
        // Filter out the current song if we're editing
        if (songUuid) {
          dupes = dupes.filter((d: DupeSong) => d.uuid !== songUuid);
        }
        setDupeSongs(dupes);
      } catch (error) {
        console.error("Error checking for duplicates:", error);
      }
    },
    [dupeCheckUrl, songUuid]
  );

  const handleTagClick = (tagName: string) => {
    // Check if tag already exists
    const currentTags = tagsInputRef.current?.getTags() || [];
    if (currentTags.includes(tagName)) {
      return;
    }
    tagsInputRef.current?.addTag(tagName);
  };

  const handleTagsChanged = (tags: string[]) => {
    setFormData(prev => ({
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
      setFormData(prev => ({ ...prev, rating: null }));
    } else {
      setFormData(prev => ({ ...prev, rating: clickedRating }));
    }
  };

  const displayRating = hoverRating ?? formData.rating ?? 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Let the form submit naturally (don't call e.preventDefault())
    // Browser will POST form data and follow the redirect
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-0 h-100 music-dashboard">
      {/* Left sidebar */}
      <div className="col-lg-3 d-flex flex-column pe-2">
        <div className="w-100">
          {/* Duplicate songs warning */}
          {dupeSongs.length > 0 && (
            <Card className="backdrop-filter">
              <h6 className="text-warning mb-2 text-center">Possible duplicate songs found</h6>
              {dupeSongs.map(dupe => (
                <div key={dupe.uuid} className="my-2">
                  <hr className="divider" />
                  <div className="d-flex">
                    <FontAwesomeIcon icon={faMusic} className="text-secondary mt-2" />
                    <div className="ms-2">
                      <a href={dupe.url} target="bc-dupe-song">
                        {dupe.title}
                      </a>
                      {dupe.note && <div className="dupe-song-note text-truncate">{dupe.note}</div>}
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

          {/* Song Info Card */}
          {(formData.length != null ||
            formData.last_time_played !== "Never" ||
            formData.times_played > 0) && (
            <Card title="Song Info" className="backdrop-filter ms-3">
              <ul>
                {formData.length != null && (
                  <li>
                    Song Length <span className="ms-1 text-primary">{formData.length_pretty}</span>
                  </li>
                )}
                <li>
                  Last Played <span className="ms-1 text-primary">{formData.last_time_played}</span>
                </li>
                {formData.times_played > 0 && (
                  <li>
                    Times Played <span className="ms-1 text-primary">{formData.times_played}</span>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Tag Suggestions Card */}
          <Card title="Tag Suggestions" className="backdrop-filter ms-3">
            <hr className="divider" />
            <ul className="list-group interior-borders">
              {tagSuggestions.map(tag => (
                <li
                  key={tag.name}
                  className="list-with-counts ps-2 py-1 pe-2 d-flex"
                  onClick={() => handleTagClick(tag.name)}
                >
                  <div className="text-truncate">{tag.name}</div>
                  <div className="ms-auto me-1">
                    <span className="px-2 badge rounded-pill">{tag.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Main form area */}
      <div className="col-lg-8 h-100">
        <p className="lead offset-lg-3 fw-bold ps-2">Edit Song</p>

        <form id="song-form" action={submitUrl} method="POST" onSubmit={handleSubmit} noValidate>
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
          <input type="hidden" name="return_url" value={returnUrl || ""} />
          <input type="hidden" name="length" value={formData.length || ""} />
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
                initialValue={{ label: formData.artist, artist: formData.artist }}
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
                initialTags={formData.tags}
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

          {/* Rating */}
          <div className="row align-items-center mb-3">
            <label className="col-lg-3 col-form-label fw-bold text-end">Rating</label>
            <div className="col-lg-9" onMouseLeave={handleRatingMouseLeave}>
              {[0, 1, 2, 3, 4].map(starIndex => (
                <span
                  key={starIndex}
                  className={`rating-no-hover me-1 cursor-pointer ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                  data-rating={starIndex}
                  onClick={() => handleRatingClick(starIndex)}
                  onMouseOver={() => handleRatingMouseOver(starIndex)}
                >
                  <FontAwesomeIcon icon={faStar} />
                </span>
              ))}
              <input type="hidden" name="rating" value={formData.rating || ""} />
            </div>
          </div>

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
                {sourceOptions.map(option => (
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
    </div>
  );
}

export default SongEditPage;
