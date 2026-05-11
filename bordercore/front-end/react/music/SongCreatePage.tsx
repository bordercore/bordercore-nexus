import React, { useRef, useState, useCallback, useEffect } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faMusic, faExclamationTriangle, faCheck } from "@fortawesome/free-solid-svg-icons";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { getCsrfToken } from "../utils/reactUtils";

// Format an ISO timestamp as a short, sidebar-friendly "when". Returns
// "today" / "yesterday" / "N days ago" for the last fortnight, falling back
// to a locale date for older uploads. Returns "—" for null / invalid input
// so the stats list still has a placeholder when the library is empty.
function formatRelativeUpload(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfNow.getTime() - startOfThen.getTime()) / dayMs);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

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
  genre: string | null;
  artwork: string | null;
}

interface TagSuggestion {
  name: string;
  count: number;
}

interface LibraryStats {
  total_songs: number;
  total_artists: number;
  last_upload_iso: string | null;
}

interface SongCreatePageProps {
  submitUrl: string;
  cancelUrl: string;
  tagSearchUrl: string;
  artistSearchUrl: string;
  dupeCheckUrl: string;
  id3InfoUrl: string;
  tagSuggestions: TagSuggestion[];
  sourceOptions: SourceOption[];
  initialSourceId: number | null;
  libraryStats: LibraryStats | null;
}

export function SongCreatePage({
  submitUrl,
  cancelUrl,
  tagSearchUrl,
  artistSearchUrl,
  dupeCheckUrl,
  id3InfoUrl,
  tagSuggestions,
  sourceOptions,
  initialSourceId,
  libraryStats,
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
  const [submitting] = useState(false);
  const [dupeSongs, setDupeSongs] = useState<DupeSong[]>([]);
  const [songInfo, setSongInfo] = useState<SongInfo>({
    songLength: null,
    songLengthPretty: null,
    songSize: null,
    sampleRate: null,
    bitRate: null,
    genre: null,
    artwork: null,
  });
  const [filename, setFilename] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const tagsInputRef = useRef<TagsInputHandle>(null);
  const selectValueRef = useRef<SelectValueHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    let newValue: string | boolean | number | null = value;
    if (type === "checkbox") newValue = checked;
    else if (name === "source") newValue = value ? parseInt(value, 10) : null;
    setFormData(prev => ({ ...prev, [name]: newValue }));
    if (errors[name as keyof SongFormErrors]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name as keyof SongFormErrors];
        return next;
      });
    }
  };

  const checkForDuplicates = useCallback(
    async (artist: string, title: string) => {
      if (!artist || !title) return;
      try {
        const response = await axios.get(
          `${dupeCheckUrl}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
        );
        setDupeSongs(response.data.dupes || []);
      } catch (error) {
        console.error("Error checking for duplicates:", error);
      }
    },
    [dupeCheckUrl]
  );

  const handleArtistSelect = (option: { label?: string; artist?: string }) => {
    const artistName = option.artist || option.label || "";
    setFormData(prev => ({ ...prev, artist: artistName }));
    checkForDuplicates(artistName, formData.title);
  };

  const handleTitleBlur = () => {
    checkForDuplicates(formData.artist, formData.title);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setSongFile(file);
    setProcessingFile(true);
    setErrors(prev => {
      const next = { ...prev };
      delete next.song;
      return next;
    });

    const uploadData = new FormData();
    uploadData.append("song", file);

    try {
      const response = await axios.post(id3InfoUrl, uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = response.data;

      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        artist: data.artist || prev.artist,
        year: data.year || prev.year,
        track: data.track || prev.track,
        album_name: data.album_name || prev.album_name,
        length: data.length || prev.length,
      }));

      if (data.artist && selectValueRef.current) {
        selectValueRef.current.setValue(data.artist);
      }

      setSongInfo({
        songLength: data.length,
        songLengthPretty: data.length_pretty,
        songSize: data.filesize,
        sampleRate: data.sample_rate,
        bitRate: data.bit_rate,
        genre: data.genre || null,
        artwork: data.artwork || null,
      });

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
    const currentTags = tagsInputRef.current?.getTags() || [];
    if (currentTags.includes(tagName)) return;
    tagsInputRef.current?.addTag(tagName);
  };

  const handleTagsChanged = (tags: string[]) => {
    setFormData(prev => ({ ...prev, tags }));
  };

  const setRating = useCallback((value: number) => {
    setFormData(prev => ({ ...prev, rating: prev.rating === value ? null : value }));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!songFile) {
      e.preventDefault();
      setErrors({ song: ["Please select a song file to upload."] });
      return;
    }
    const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
      'input[name="csrfmiddlewaretoken"]'
    );
    if (tokenInput) tokenInput.value = getCsrfToken();
  };

  // Keyboard shortcuts: 1-5 → rating, Esc → cancel.
  // Bare digits only fire when focus is outside an editable field, so typing
  // a year of "1985" doesn't accidentally rewrite the rating.
  useEffect(() => {
    const isEditing = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isEditing(event.target)) {
        event.preventDefault();
        window.location.href = cancelUrl;
        return;
      }
      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        /^[1-5]$/.test(event.key) &&
        !isEditing(event.target)
      ) {
        event.preventDefault();
        setRating(parseInt(event.key, 10));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelUrl, setRating]);

  const displayRating = hoverRating ?? formData.rating ?? 0;

  return (
    <div className="music-library-os mlo-edit-page mlo-create-page">
      <header className="mlo-edit-hero">
        <div className="mlo-edit-hero-cover">
          {songInfo.artwork ? (
            <img src={songInfo.artwork} alt={formData.album_name || "Embedded cover art"} />
          ) : (
            <div className="mlo-edit-hero-cover-empty" aria-hidden="true">
              <FontAwesomeIcon icon={faMusic} />
            </div>
          )}
        </div>
        <div className="mlo-edit-hero-text">
          <div className="mlo-edit-hero-eyebrow">creating song</div>
          <h1 className="mlo-edit-hero-title">{formData.title || "New Song"}</h1>
          <div className="mlo-edit-hero-byline">
            {formData.artist ? <span>{formData.artist}</span> : <span>unknown artist</span>}
            {formData.album_name && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formData.album_name}</span>
              </>
            )}
            {formData.year && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formData.year}</span>
              </>
            )}
          </div>
          {songInfo.songLength != null && (
            <div className="mlo-edit-hero-stats">
              {songInfo.songLengthPretty && (
                <div className="mlo-edit-hero-stat">
                  <span className="mlo-edit-hero-stat-label">length</span>
                  <span className="mlo-edit-hero-stat-value">{songInfo.songLengthPretty}</span>
                </div>
              )}
              {songInfo.songSize && (
                <div className="mlo-edit-hero-stat">
                  <span className="mlo-edit-hero-stat-label">size</span>
                  <span className="mlo-edit-hero-stat-value">{songInfo.songSize}</span>
                </div>
              )}
              {songInfo.sampleRate && (
                <div className="mlo-edit-hero-stat">
                  <span className="mlo-edit-hero-stat-label">sample rate</span>
                  <span className="mlo-edit-hero-stat-value">{songInfo.sampleRate}</span>
                </div>
              )}
              {songInfo.bitRate && (
                <div className="mlo-edit-hero-stat">
                  <span className="mlo-edit-hero-stat-label">bit rate</span>
                  <span className="mlo-edit-hero-stat-value">{songInfo.bitRate}</span>
                </div>
              )}
              {songInfo.genre && (
                <div className="mlo-edit-hero-stat">
                  <span className="mlo-edit-hero-stat-label">genre</span>
                  <span className="mlo-edit-hero-stat-value">{songInfo.genre}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <aside className="mlo-edit-sidebar">
        {tagSuggestions.length > 0 && (
          <div className="mlo-edit-sidebar-card">
            <div className="mlo-edit-sidebar-head">Tag Suggestions</div>
            <p className="mlo-create-hint mlo-create-hint-tight">
              Click a chip to add it. Numbers show how many songs already use the tag.
            </p>
            <div className="mlo-edit-sidebar-tags">
              {tagSuggestions.map(tag => (
                <button
                  type="button"
                  key={tag.name}
                  className="mlo-edit-tag-chip"
                  onClick={() => handleTagClick(tag.name)}
                  title={`${tag.count} song${tag.count === 1 ? "" : "s"}`}
                >
                  <span className="mlo-edit-tag-chip-name">{tag.name}</span>
                  <span className="mlo-edit-tag-chip-count">{tag.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {songInfo.genre && (
          <div className="mlo-edit-sidebar-card">
            <div className="mlo-edit-sidebar-head">From this file</div>
            <p className="mlo-create-hint mlo-create-hint-tight">
              ID3 reported a genre. Click to add it as a tag.
            </p>
            <div className="mlo-edit-sidebar-tags">
              <button
                type="button"
                className="mlo-edit-tag-chip mlo-edit-tag-chip-id3"
                onClick={() => handleTagClick(songInfo.genre as string)}
              >
                <span className="mlo-edit-tag-chip-name">{songInfo.genre}</span>
              </button>
            </div>
          </div>
        )}
        {filename === "" && (
          <div className="mlo-edit-sidebar-card">
            <div className="mlo-edit-sidebar-head">How it works</div>
            <p className="mlo-create-hint">
              Choose a local <strong>MP3</strong>. Embedded <strong>ID3v2</strong> tags fill in
              title, artist, album, year, track, and length automatically — including the file's bit
              rate, sample rate, and (when present) genre.
            </p>
            <p className="mlo-create-hint">
              As soon as artist and title are set, the page silently checks for{" "}
              <strong>possible duplicates</strong> already in the library and surfaces them inline
              under the Title field.
            </p>
            <p className="mlo-create-hint">
              Click any chip in <strong>Tag Suggestions</strong> to add it; the most-used tags show
              their song count so you can pick high-coverage ones first.
            </p>
          </div>
        )}
        <div className="mlo-edit-sidebar-card">
          <div className="mlo-edit-sidebar-head">Shortcuts</div>
          <ul className="mlo-create-shortcuts">
            <li>
              <span className="mlo-create-shortcut-keys">
                <kbd>1</kbd>–<kbd>5</kbd>
              </span>
              <span className="mlo-create-shortcut-desc">set rating</span>
            </li>
            <li>
              <span className="mlo-create-shortcut-keys">
                <kbd>Esc</kbd>
              </span>
              <span className="mlo-create-shortcut-desc">cancel and return</span>
            </li>
          </ul>
          <p className="mlo-create-hint mlo-create-hint-tight">
            Bare digits only fire when you're not typing in a field, so a year like 1985 won't
            rewrite the rating.
          </p>
        </div>
        {libraryStats && (
          <div className="mlo-edit-sidebar-card">
            <div className="mlo-edit-sidebar-head">Library at a glance</div>
            <dl className="mlo-create-stats">
              <div className="mlo-create-stat">
                <dt>songs</dt>
                <dd>{libraryStats.total_songs.toLocaleString()}</dd>
              </div>
              <div className="mlo-create-stat">
                <dt>artists</dt>
                <dd>{libraryStats.total_artists.toLocaleString()}</dd>
              </div>
              <div className="mlo-create-stat">
                <dt>last upload</dt>
                <dd>{formatRelativeUpload(libraryStats.last_upload_iso)}</dd>
              </div>
            </dl>
          </div>
        )}
      </aside>

      <form
        id="song-form"
        className="mlo-edit-form"
        action={submitUrl}
        method="POST"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        noValidate
      >
        <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />
        <input type="hidden" name="length" value={formData.length || ""} />
        <input type="hidden" name="artist" value={formData.artist} />
        <input type="hidden" name="rating" value={formData.rating || ""} />

        {errors.non_field_errors && (
          <div className="mlo-edit-form-error">
            {errors.non_field_errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        )}

        <section className="mlo-edit-section">
          <div className="mlo-edit-section-head">Identity</div>

          <div className="refined-field">
            <label htmlFor="id_file">File</label>
            <div className="refined-file">
              <input
                type="text"
                id="id_filename"
                value={filename}
                readOnly
                autoComplete="off"
                placeholder="No file chosen"
                className={errors.song ? "is-invalid" : undefined}
              />
              <label className="refined-file-pick mlo-create-file-btn">
                {processingFile ? "Processing…" : filename ? "Change" : "Choose"}
                <input
                  type="file"
                  ref={fileInputRef}
                  id="id_file"
                  name="song"
                  hidden
                  accept="audio/mpeg,.mp3"
                  onChange={handleFileChange}
                  disabled={processingFile}
                />
              </label>
            </div>
            {errors.song && <span className="mlo-edit-field-error">{errors.song.join(", ")}</span>}
          </div>

          <div className="refined-field">
            <label htmlFor="id_title">Title</label>
            <input
              type="text"
              id="id_title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              onBlur={handleTitleBlur}
              autoComplete="off"
              className={errors.title ? "is-invalid" : undefined}
            />
            {errors.title && (
              <span className="mlo-edit-field-error">{errors.title.join(", ")}</span>
            )}
            {dupeSongs.length > 0 && (
              <div className="mlo-edit-dupe-warning">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>Possible duplicate{dupeSongs.length > 1 ? "s" : ""}:</span>
                <ul>
                  {dupeSongs.map(d => (
                    <li key={d.uuid}>
                      <a href={d.url} target="bc-dupe-song">
                        {d.title}
                      </a>
                      {d.album_name && d.album_url && (
                        <>
                          {" — "}
                          <a className="mlo-edit-dupe-album" href={d.album_url}>
                            {d.album_name}
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="refined-field">
            <label htmlFor="id_artist">Artist</label>
            <SelectValue
              ref={selectValueRef}
              id="id_artist"
              label="artist"
              searchUrl={`${artistSearchUrl}?term=`}
              placeHolder=""
              onSelect={handleArtistSelect}
            />
            {errors.artist && (
              <span className="mlo-edit-field-error">{errors.artist.join(", ")}</span>
            )}
          </div>

          <div className="refined-row-2">
            <div className="refined-field">
              <label htmlFor="id_album_name">Album</label>
              <input
                type="text"
                id="id_album_name"
                name="album_name"
                value={formData.album_name}
                onChange={handleChange}
                autoComplete="off"
                className={errors.album_name ? "is-invalid" : undefined}
              />
              {errors.album_name && (
                <span className="mlo-edit-field-error">{errors.album_name.join(", ")}</span>
              )}
            </div>
            <div className="refined-field">
              <label htmlFor="id_track">Track</label>
              <input
                type="text"
                id="id_track"
                name="track"
                value={formData.track}
                onChange={handleChange}
                autoComplete="off"
                className={errors.track ? "is-invalid" : undefined}
              />
              {errors.track && (
                <span className="mlo-edit-field-error">{errors.track.join(", ")}</span>
              )}
            </div>
          </div>

          <div className="refined-toggle-row">
            <label className="refined-toggle">
              <ToggleSwitch
                id="id_compilation"
                name="compilation"
                checked={formData.compilation}
                onChange={checked => setFormData(prev => ({ ...prev, compilation: checked }))}
              />
              <span>Compilation</span>
            </label>
            <span className="mlo-edit-field-hint mlo-edit-toggle-hint">
              groups the track under a shared "album artist" instead of the song's own artist
            </span>
          </div>

          {formData.compilation && (
            <div className="refined-field">
              <label htmlFor="id_album_artist">Album artist</label>
              <input
                type="text"
                id="id_album_artist"
                name="album_artist"
                value={formData.album_artist}
                onChange={handleChange}
                autoComplete="off"
                className={errors.album_artist ? "is-invalid" : undefined}
              />
              {errors.album_artist && (
                <span className="mlo-edit-field-error">{errors.album_artist.join(", ")}</span>
              )}
            </div>
          )}
        </section>

        <section className="mlo-edit-section">
          <div className="mlo-edit-section-head">Catalog</div>

          <div className="refined-row-2">
            <div className="refined-field">
              <label htmlFor="id_year">Year</label>
              <input
                type="text"
                id="id_year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                autoComplete="off"
                className={errors.year ? "is-invalid" : undefined}
              />
              {errors.year && (
                <span className="mlo-edit-field-error">{errors.year.join(", ")}</span>
              )}
            </div>
            <div className="refined-field">
              <label htmlFor="id_original_year">
                Original year
                <span className="mlo-edit-field-hint">
                  for reissues — when the song first released
                </span>
              </label>
              <input
                type="text"
                id="id_original_year"
                name="original_year"
                value={formData.original_year}
                onChange={handleChange}
                autoComplete="off"
                className={errors.original_year ? "is-invalid" : undefined}
              />
              {errors.original_year && (
                <span className="mlo-edit-field-error">{errors.original_year.join(", ")}</span>
              )}
            </div>
          </div>

          <div className="refined-field">
            <label htmlFor="id_source">Source</label>
            <select
              id="id_source"
              name="source"
              value={formData.source || ""}
              onChange={handleChange}
              className={errors.source ? "is-invalid" : undefined}
            >
              {sourceOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {errors.source && (
              <span className="mlo-edit-field-error">{errors.source.join(", ")}</span>
            )}
          </div>

          <div className="refined-field">
            <label htmlFor="id_tags">Tags</label>
            <TagsInput
              ref={tagsInputRef}
              id="id_tags"
              name="tags"
              searchUrl={`${tagSearchUrl}?query=`}
              initialTags={[]}
              onTagsChanged={handleTagsChanged}
            />
            {errors.tags && <span className="mlo-edit-field-error">{errors.tags.join(", ")}</span>}
          </div>
        </section>

        <section className="mlo-edit-section">
          <div className="mlo-edit-section-head">Notes</div>

          <div className="refined-field">
            <label>
              Rating
              <span className="mlo-edit-field-hint">press 1–5</span>
            </label>
            <div className="mlo-edit-rating" onMouseLeave={() => setHoverRating(null)}>
              {[0, 1, 2, 3, 4].map(starIndex => (
                <button
                  type="button"
                  key={starIndex}
                  className={`rating-no-hover mlo-edit-rating-star ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                  aria-label={`Set rating to ${starIndex + 1}`}
                  onClick={() => setRating(starIndex + 1)}
                  onMouseOver={() => setHoverRating(starIndex + 1)}
                >
                  <FontAwesomeIcon icon={faStar} />
                </button>
              ))}
            </div>
          </div>

          <div className="refined-field">
            <label htmlFor="id_note">Note</label>
            <textarea
              id="id_note"
              name="note"
              rows={3}
              value={formData.note}
              onChange={handleChange}
              className={errors.note ? "is-invalid" : undefined}
            />
            {errors.note && <span className="mlo-edit-field-error">{errors.note.join(", ")}</span>}
          </div>
        </section>

        <div className="mlo-edit-actions">
          <a href={cancelUrl} className="mlo-edit-cancel">
            Cancel <kbd>Esc</kbd>
          </a>
          <button type="submit" className="mlo-edit-save mlo-btn-primary" disabled={submitting}>
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SongCreatePage;
