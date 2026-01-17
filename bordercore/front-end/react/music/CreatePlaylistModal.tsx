import React from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";

export interface CreatePlaylistModalHandle {
  openModal: () => void;
}

interface CreatePlaylistModalProps {
  createPlaylistUrl: string;
  tagSearchUrl: string;
  csrfToken: string;
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

export const CreatePlaylistModal = React.forwardRef<
  CreatePlaylistModalHandle,
  CreatePlaylistModalProps
>(function CreatePlaylistModal({ createPlaylistUrl, tagSearchUrl, csrfToken }, ref) {
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [playlistType, setPlaylistType] = React.useState<"manual" | "smart">("manual");
  const [tag, setTag] = React.useState("");
  const [startYear, setStartYear] = React.useState("");
  const [endYear, setEndYear] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [excludeRecent, setExcludeRecent] = React.useState("");
  const [excludeAlbums, setExcludeAlbums] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("recent");
  const [size, setSize] = React.useState("20");

  const modalRef = React.useRef<HTMLDivElement>(null);
  const modalInstanceRef = React.useRef<any>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => ({
    openModal: () => {
      if (modalRef.current) {
        modalInstanceRef.current = new Modal(modalRef.current);
        modalInstanceRef.current.show();
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 500);
      }
    },
  }));

  const disabledCreateButton = React.useMemo(() => {
    if (!name.trim()) return true;
    if ((startYear && !endYear) || (!startYear && endYear)) return true;
    if (startYear && endYear && parseInt(endYear) < parseInt(startYear)) return true;
    return false;
  }, [name, startYear, endYear]);

  const handleRatingClick = (starIndex: number) => {
    const clickedRating = starIndex + 1;
    if (clickedRating === rating) {
      setRating(null);
    } else {
      setRating(clickedRating);
    }
  };

  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <div
      ref={modalRef}
      id="modalEditor"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <form action={createPlaylistUrl} method="post">
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Create Playlist
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="row mb-3">
                <label className="col-lg-4 col-form-label" htmlFor="id_name">
                  Name
                </label>
                <div className="col-lg-8">
                  <input
                    ref={nameInputRef}
                    id="id_name"
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    maxLength={200}
                    required
                    className="form-control"
                  />
                </div>
              </div>
              <div className="row">
                <label className="col-lg-4 col-form-label" htmlFor="id_note">
                  Note
                </label>
                <div className="col-lg-8">
                  <textarea
                    id="id_note"
                    name="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    cols={40}
                    rows={3}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="row mt-3">
                <label className="col-lg-4 col-form-label pt-0" htmlFor="id_type">
                  Type
                </label>
                <div className="col-lg-8">
                  <div className="d-flex">
                    <div className="form-check">
                      <input
                        id="id_type_manual"
                        className="form-check-input mt-2"
                        type="radio"
                        name="type"
                        value="manual"
                        checked={playlistType === "manual"}
                        onChange={() => setPlaylistType("manual")}
                      />
                      <label className="form-check-label d-flex" htmlFor="id_type_manual">
                        Manual
                      </label>
                    </div>
                    <div className="form-check ms-5">
                      <input
                        id="id_type_smart"
                        className="form-check-input mt-2"
                        type="radio"
                        name="type"
                        value="smart"
                        checked={playlistType === "smart"}
                        onChange={() => setPlaylistType("smart")}
                      />
                      <label className="form-check-label d-flex" htmlFor="id_type_smart">
                        Smart
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {playlistType === "smart" && (
                <div className="smart-playlist-options">
                  <hr className="mb-1" />
                  <div className="form-section">Options</div>
                  <div className="row mt-3">
                    <label className="col-lg-4 form-check-label">Tag</label>
                    <div className="col-lg-8">
                      <input
                        type="text"
                        name="tag"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="Tag name"
                        className="form-control"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 from-check-label text-nowrap">
                      Time Period
                    </label>
                    <div className="col-lg-8 d-flex">
                      <input
                        type="number"
                        name="start_year"
                        value={startYear}
                        onChange={(e) => setStartYear(e.target.value)}
                        className="form-control me-1"
                        size={4}
                        placeholder="Start Year"
                        autoComplete="off"
                      />
                      <input
                        type="number"
                        name="end_year"
                        value={endYear}
                        onChange={(e) => setEndYear(e.target.value)}
                        className="form-control ms-1"
                        size={4}
                        placeholder="End Year"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 from-check-label">Rating</label>
                    <div className="col-lg-8">
                      <div
                        className="rating-container d-flex"
                        onMouseLeave={() => setHoverRating(null)}
                      >
                        {[0, 1, 2, 3, 4].map((starIndex) => (
                          <span
                            key={starIndex}
                            className={`rating me-1 ${displayRating > starIndex ? "rating-star-selected" : ""}`}
                            onClick={() => handleRatingClick(starIndex)}
                            onMouseOver={() => setHoverRating(starIndex + 1)}
                            style={{ cursor: "pointer" }}
                          >
                            <FontAwesomeIcon icon={faStar} />
                          </span>
                        ))}
                      </div>
                      <input type="hidden" name="rating" value={rating ?? ""} />
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 col-form-label">
                      Exclude Recent Listens
                    </label>
                    <div className="col-lg-8">
                      <select
                        name="exclude_recent"
                        value={excludeRecent}
                        onChange={(e) => setExcludeRecent(e.target.value)}
                        className="form-control form-select"
                      >
                        {excludeRecentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.display}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 col-form-label">Exclude Albums</label>
                    <div className="col-lg-8 d-flex align-items-center">
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          name="exclude_albums"
                          className="form-check-input"
                          checked={excludeAlbums}
                          onChange={(e) => setExcludeAlbums(e.target.checked)}
                          value="true"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 col-form-label">Sort By</label>
                    <div className="col-lg-8">
                      <select
                        name="sort_by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="form-control form-select"
                      >
                        <option value="recent">Recently Added</option>
                        <option value="random">Random</option>
                      </select>
                    </div>
                  </div>
                  <div className="row mt-3">
                    <label className="col-lg-4 col-form-label">Size</label>
                    <div className="col-lg-8">
                      <select
                        name="size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="form-control form-select"
                      >
                        {sizeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.display}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer justify-content-end">
              <input
                id="btn-action"
                className="btn btn-primary"
                type="submit"
                name="Go"
                value="Save"
                disabled={disabledCreateButton}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

export default CreatePlaylistModal;
