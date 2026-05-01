import React from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStar, faTimes } from "@fortawesome/free-solid-svg-icons";
import { TagsInput } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { getCsrfToken } from "../utils/reactUtils";

interface CreatePlaylistModalProps {
  open: boolean;
  onClose: () => void;
  createPlaylistUrl: string;
  tagSearchUrl: string;
}

const sizeOptions = [
  { value: "", display: "Unlimited" },
  { value: "5", display: "5" },
  { value: "10", display: "10" },
  { value: "20", display: "20" },
  { value: "50", display: "50" },
  { value: "100", display: "100" },
];

const excludeRecentOptions = [
  { value: "", display: "No limit" },
  { value: "1", display: "Past Day" },
  { value: "2", display: "Past Two Days" },
  { value: "3", display: "Past Three Days" },
  { value: "7", display: "Past Week" },
  { value: "30", display: "Past Month" },
  { value: "90", display: "Past 3 Months" },
];

export function CreatePlaylistModal({
  open,
  onClose,
  createPlaylistUrl,
  tagSearchUrl,
}: CreatePlaylistModalProps) {
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [playlistType, setPlaylistType] = React.useState<"manual" | "smart">("manual");
  const [tag, setTag] = React.useState<string[]>([]);
  const [startYear, setStartYear] = React.useState("");
  const [endYear, setEndYear] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [excludeRecent, setExcludeRecent] = React.useState("");
  const [excludeAlbums, setExcludeAlbums] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("recent");
  const [size, setSize] = React.useState("20");

  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setNote("");
    setPlaylistType("manual");
    setTag([]);
    setStartYear("");
    setEndYear("");
    setRating(null);
    setHoverRating(null);
    setExcludeRecent("");
    setExcludeAlbums(false);
    setSortBy("recent");
    setSize("20");
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const disabledCreateButton = React.useMemo(() => {
    if (!name.trim()) return true;
    if ((startYear && !endYear) || (!startYear && endYear)) return true;
    if (startYear && endYear && parseInt(endYear) < parseInt(startYear)) return true;
    return false;
  }, [name, startYear, endYear]);

  const handleRatingClick = (starIndex: number) => {
    const clickedRating = starIndex + 1;
    setRating(prev => (clickedRating === prev ? null : clickedRating));
  };

  const displayRating = hoverRating ?? rating ?? 0;

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        action={createPlaylistUrl}
        method="post"
        role="dialog"
        aria-label="create playlist"
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

        <div className="refined-modal-eyebrow">
          <span>new playlist</span>
          <span className="dot">·</span>
          <span className="mono">bordercore / music / playlist</span>
        </div>

        <h2 className="refined-modal-title">Create a playlist</h2>

        <div className="refined-field">
          <label htmlFor="playlist-new-name">name</label>
          <input
            ref={nameRef}
            id="playlist-new-name"
            type="text"
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="off"
            maxLength={200}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="playlist-new-note">
            note <span className="optional">· optional</span>
          </label>
          <textarea
            id="playlist-new-note"
            name="note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
        </div>

        <div className="refined-field">
          <label>type</label>
          <div className="study-method-grid">
            <label className={`study-method-card ${playlistType === "manual" ? "active" : ""}`}>
              <input
                type="radio"
                name="type"
                value="manual"
                checked={playlistType === "manual"}
                onChange={() => setPlaylistType("manual")}
              />
              <span className="title">Manual</span>
              <span className="hint">Add songs by hand.</span>
            </label>
            <label className={`study-method-card ${playlistType === "smart" ? "active" : ""}`}>
              <input
                type="radio"
                name="type"
                value="smart"
                checked={playlistType === "smart"}
                onChange={() => setPlaylistType("smart")}
              />
              <span className="title">Smart</span>
              <span className="hint">Auto-fill by tag, year, or rating.</span>
            </label>
          </div>
        </div>

        {playlistType === "smart" && (
          <>
            <div className="refined-field">
              <label htmlFor="playlist-new-tag">
                tag <span className="optional">· optional</span>
              </label>
              <TagsInput
                id="playlist-new-tag"
                name="tag"
                searchUrl={`${tagSearchUrl}&query=`}
                initialTags={tag}
                onTagsChanged={setTag}
                maxTags={1}
                placeholder="Tag name"
              />
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-new-start-year">start year</label>
                <input
                  id="playlist-new-start-year"
                  type="number"
                  name="start_year"
                  value={startYear}
                  onChange={e => setStartYear(e.target.value)}
                  placeholder="e.g. 1980"
                  autoComplete="off"
                />
              </div>
              <div className="refined-field">
                <label htmlFor="playlist-new-end-year">end year</label>
                <input
                  id="playlist-new-end-year"
                  type="number"
                  name="end_year"
                  value={endYear}
                  onChange={e => setEndYear(e.target.value)}
                  placeholder="e.g. 1989"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="refined-field">
              <label>rating</label>
              <div className="playlist-rating-row" onMouseLeave={() => setHoverRating(null)}>
                {[0, 1, 2, 3, 4].map(starIndex => (
                  <span
                    key={starIndex}
                    className={`rating ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                    onClick={() => handleRatingClick(starIndex)}
                    onMouseOver={() => setHoverRating(starIndex + 1)}
                    role="button"
                    tabIndex={0}
                    aria-label={`set rating ${starIndex + 1}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRatingClick(starIndex);
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                ))}
              </div>
              <input type="hidden" name="rating" value={rating ?? ""} />
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-new-exclude-recent">exclude recent</label>
                <select
                  id="playlist-new-exclude-recent"
                  name="exclude_recent"
                  value={excludeRecent}
                  onChange={e => setExcludeRecent(e.target.value)}
                >
                  {excludeRecentOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
              <div className="refined-field">
                <label htmlFor="playlist-new-sort-by">sort by</label>
                <select
                  id="playlist-new-sort-by"
                  name="sort_by"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="recent">Recently Added</option>
                  <option value="random">Random</option>
                </select>
              </div>
            </div>

            <div className="refined-row-2">
              <div className="refined-field">
                <label htmlFor="playlist-new-size">size</label>
                <select
                  id="playlist-new-size"
                  name="size"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                >
                  {sizeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
              <div className="refined-field playlist-toggle-field">
                <label htmlFor="playlist-new-exclude-albums">exclude albums</label>
                <ToggleSwitch
                  id="playlist-new-exclude-albums"
                  name="exclude_albums"
                  checked={excludeAlbums}
                  onChange={setExcludeAlbums}
                />
              </div>
            </div>
          </>
        )}

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={disabledCreateButton}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            create playlist
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default CreatePlaylistModal;
