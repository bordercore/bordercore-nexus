import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCompactDisc, faFileImport, faMusic } from "@fortawesome/free-solid-svg-icons";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { Spinner } from "../common/Spinner";
import { getCsrfToken } from "../utils/reactUtils";

interface SourceOption {
  id: number;
  name: string;
}

interface SongInfo {
  track: number;
  artist: string;
  title: string;
  note?: string;
  year?: string;
}

type UploadProgress =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; current: number; total: number; title: string }
  | { phase: "done" };

interface AlbumCreatePageProps {
  scanUrl: string;
  addUrl: string;
  tagSearchUrl: string;
  songSources: SourceOption[];
  defaultSourceId: number | null;
}

export function AlbumCreatePage({
  scanUrl,
  addUrl,
  tagSearchUrl,
  songSources,
  defaultSourceId,
}: AlbumCreatePageProps) {
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [songList, setSongList] = useState<SongInfo[]>([]);
  const [songSource, setSongSource] = useState<number | null>(defaultSourceId);
  const [fileData, setFileData] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const tagsInputRef = useRef<TagsInputHandle>(null);

  const artistsUnique = useMemo(() => new Set(songList.map(song => song.artist)), [songList]);

  const albumYear = useMemo(() => {
    const first = songList.find(s => s.year);
    return first?.year ?? "";
  }, [songList]);

  // ESC key dismisses the error banner so the user can retry quickly
  useEffect(() => {
    if (!error) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setError(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [error]);

  const collectSongListChanges = () => {
    const changes: Record<number, { title: string; note: string }> = {};
    for (const song of songList) {
      changes[song.track] = { title: song.title, note: song.note ?? "" };
    }
    return JSON.stringify(changes);
  };

  const handleSongTitleChange = (index: number, newTitle: string) => {
    setSongList(prev => prev.map((song, i) => (i === index ? { ...song, title: newTitle } : song)));
  };

  const handleSongNoteChange = (index: number, newNote: string) => {
    setSongList(prev => prev.map((song, i) => (i === index ? { ...song, note: newNote } : song)));
  };

  const scanFile = async (file: File) => {
    setFileData(file);
    setProcessing(true);
    setUploadProgress({ phase: "idle" });
    setError(null);

    const formData = new FormData();
    formData.append("zipfile", file);

    try {
      const response = await axios.post(scanUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setTimeout(() => setProcessing(false), 300);
      setAlbum(response.data.album);
      setArtist(response.data.artist[0]);
      setSongList(response.data.song_info);
    } catch (err) {
      setProcessing(false);
      console.error("Error scanning album:", err);
      setError("Error scanning album zipfile. Please try again.");
    }
  };

  const handleFileInputChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (file) scanFile(file);
  };

  const handleDrop = (evt: React.DragEvent<HTMLElement>) => {
    evt.preventDefault();
    setIsDragOver(false);
    const file = evt.dataTransfer.files?.[0];
    if (file) scanFile(file);
  };

  const handleDragOver = (evt: React.DragEvent<HTMLElement>) => {
    evt.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleAlbumAdd = async () => {
    if (!fileData) {
      setError("No file selected");
      return;
    }

    setProcessing(true);
    setUploadProgress({ phase: "uploading" });
    setError(null);

    const formData = new FormData();
    formData.append("zipfile", fileData);
    formData.append("artist", artist);
    formData.append("source", String(songSource || ""));
    formData.append("tags", tagsInputRef.current?.getTags().join(",") || "");
    formData.append("songListChanges", collectSongListChanges());

    try {
      const response = await fetch(addUrl, {
        method: "POST",
        body: formData,
        headers: { "X-CSRFToken": getCsrfToken() },
      });

      if (!response.ok) {
        let detail = "Error creating album. Please try again.";
        try {
          const body = await response.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // Non-JSON error body — keep the default message.
        }
        setProcessing(false);
        setUploadProgress({ phase: "idle" });
        setError(detail);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf("\n");
        while (nl !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf("\n");
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "start") {
            setUploadProgress({
              phase: "processing",
              current: 0,
              total: event.total,
              title: "",
            });
          } else if (event.type === "progress") {
            setUploadProgress({
              phase: "processing",
              current: event.current,
              total: event.total,
              title: event.title,
            });
          } else if (event.type === "done") {
            window.location.href = event.url;
            return;
          } else if (event.type === "error") {
            setProcessing(false);
            setUploadProgress({ phase: "idle" });
            setError(event.detail);
            return;
          }
        }
      }
    } catch (err) {
      setProcessing(false);
      setUploadProgress({ phase: "idle" });
      console.error("Error creating album:", err);
      setError("Error creating album. Please try again.");
    }
  };

  const hasScan = songList.length > 0;
  const dropzoneClasses = ["refined-album-dropzone"];
  if (isDragOver) dropzoneClasses.push("is-dragover");

  return (
    <div className="refined-page-shell refined-album-page">
      <div className="refined-page-header">
        {hasScan && (
          <div className="refined-meta-strip">
            <span className="meta-item">
              <span className="meta-label">artist</span>
              <span className="meta-value">{artist || "—"}</span>
            </span>
            {albumYear && (
              <span className="meta-item">
                <span className="meta-label">year</span>
                <span className="meta-value">{albumYear}</span>
              </span>
            )}
            <span className="meta-item">
              <span className="meta-label">tracks</span>
              <span className="meta-value">{songList.length}</span>
            </span>
            {fileData && (
              <span className="meta-item">
                <span className="meta-label">size</span>
                <span className="meta-value">{(fileData.size / (1024 * 1024)).toFixed(1)} MB</span>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 p-6 rounded border border-[var(--danger)] bg-surface-2 text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      {!hasScan && (
        <section className="refined-section">
          <label
            htmlFor="id_file"
            className={dropzoneClasses.join(" ")}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <FontAwesomeIcon icon={faFileImport} className="dropzone-icon" />
            <div className="dropzone-headline">Drop a ZIP file here, or click to browse</div>
            <div className="dropzone-sub">
              <FontAwesomeIcon icon={faCompactDisc} className="me-2" />
              expects an album archive of mp3 files with id3 tags
            </div>
          </label>
          <input
            id="id_file"
            type="file"
            accept=".zip"
            onChange={handleFileInputChange}
            disabled={processing}
            className="sr-only"
          />
        </section>
      )}

      {hasScan && (
        <div className="refined-page-grid">
          <aside className="refined-page-sidebar">
            <section className="refined-section">
              <h3 className="refined-section-title">
                <FontAwesomeIcon icon={faCompactDisc} className="me-2" />
                album
              </h3>
              <dl className="refined-album-summary">
                <div>
                  <dt>artist</dt>
                  <dd>{artist || "—"}</dd>
                </div>
                <div>
                  <dt>album</dt>
                  <dd>{album || "—"}</dd>
                </div>
                {albumYear && (
                  <div>
                    <dt>year</dt>
                    <dd>{albumYear}</dd>
                  </div>
                )}
                <div>
                  <dt>tracks</dt>
                  <dd>{songList.length}</dd>
                </div>
              </dl>
            </section>

            <section className="refined-section">
              <h3 className="refined-section-title">source</h3>
              <div className="refined-field">
                <label htmlFor="id_source">song source</label>
                <div className="refined-select-wrap">
                  <select
                    className="refined-select"
                    id="id_source"
                    value={songSource || ""}
                    onChange={e => setSongSource(parseInt(e.target.value, 10))}
                  >
                    {songSources.map(source => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="refined-field">
                <label htmlFor="id_tags">
                  tags <span className="optional">· optional</span>
                </label>
                <TagsInput
                  ref={tagsInputRef}
                  id="id_tags"
                  searchUrl={`${tagSearchUrl}?query=`}
                  initialTags={[]}
                />
              </div>
            </section>
          </aside>

          <main className="refined-page-main">
            <section className="refined-section">
              <h3 className="refined-section-title">
                <FontAwesomeIcon icon={faMusic} className="me-2" />
                tracks
              </h3>

              {artistsUnique.size > 1 && (
                <div className="refined-album-notice">
                  <span className="notice-label">multiple artists · choose primary</span>
                  <div className="refined-select-wrap">
                    <select
                      className="refined-select"
                      value={artist}
                      onChange={e => setArtist(e.target.value)}
                      aria-label="primary artist"
                    >
                      {Array.from(artistsUnique).map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <table className="refined-track-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    {artistsUnique.size > 1 && <th>artist</th>}
                    <th>title</th>
                    <th>note</th>
                  </tr>
                </thead>
                <tbody>
                  {songList.map((song, index) => (
                    <tr key={song.track}>
                      <td className="num">{song.track}</td>
                      {artistsUnique.size > 1 && <td className="artist">{song.artist}</td>}
                      <td>
                        <input
                          type="text"
                          value={song.title}
                          onChange={e => handleSongTitleChange(index, e.target.value)}
                          aria-label={`title for track ${song.track}`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={song.note ?? ""}
                          onChange={e => handleSongNoteChange(index, e.target.value)}
                          aria-label={`note for track ${song.track}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="refined-page-actions">
              <button
                type="button"
                className="refined-btn ghost"
                onClick={() => {
                  setFileData(null);
                  setSongList([]);
                  setAlbum("");
                  setArtist("");
                  setError(null);
                }}
                disabled={processing}
              >
                cancel
              </button>
              <button
                type="button"
                className="refined-btn primary"
                onClick={handleAlbumAdd}
                disabled={processing}
              >
                add album
              </button>
            </div>
          </main>
        </div>
      )}

      {processing && (
        <>
          <div className="refined-modal-scrim" />
          <div className="refined-modal" role="dialog" aria-modal="true">
            <h2 className="refined-modal-title">
              {uploadProgress.phase === "processing"
                ? "Uploading album"
                : uploadProgress.phase === "uploading"
                  ? "Uploading…"
                  : "Processing…"}
            </h2>
            {uploadProgress.phase === "processing" ? (
              <div className="refined-album-progress">
                <div className="progress-line">
                  <span className="title">
                    {uploadProgress.current === 0 ? "Preparing…" : uploadProgress.title || "—"}
                  </span>
                  <span className="count">
                    {uploadProgress.current} / {uploadProgress.total}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    // must remain inline
                    style={{
                      width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <Spinner />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AlbumCreatePage;
