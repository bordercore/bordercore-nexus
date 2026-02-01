import React, { useRef, useState, useMemo } from "react";
import axios from "axios";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";

interface SourceOption {
  id: number;
  name: string;
}

interface SongInfo {
  track: number;
  artist: string;
  title: string;
  note: string;
}

interface AlbumCreatePageProps {
  scanUrl: string;
  addUrl: string;
  tagSearchUrl: string;
  songSources: SourceOption[];
  defaultSourceId: number | null;
  csrfToken: string;
}

export function AlbumCreatePage({
  scanUrl,
  addUrl,
  tagSearchUrl,
  songSources,
  defaultSourceId,
  csrfToken,
}: AlbumCreatePageProps) {
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [songList, setSongList] = useState<SongInfo[]>([]);
  const [songSource, setSongSource] = useState<number | null>(defaultSourceId);
  const [fileData, setFileData] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tagsInputRef = useRef<TagsInputHandle>(null);

  // Compute unique artists from song list
  const artistsUnique = useMemo(() => {
    return new Set(songList.map(song => song.artist));
  }, [songList]);

  // Collect song list changes for submission
  const collectSongListChanges = () => {
    const changes: Record<number, { title: string; note: string }> = {};
    for (const song of songList) {
      changes[song.track] = {
        title: song.title,
        note: song.note,
      };
    }
    return JSON.stringify(changes);
  };

  // Handle song title change
  const handleSongTitleChange = (index: number, newTitle: string) => {
    setSongList(prev => prev.map((song, i) => (i === index ? { ...song, title: newTitle } : song)));
  };

  // Handle song note change
  const handleSongNoteChange = (index: number, newNote: string) => {
    setSongList(prev => prev.map((song, i) => (i === index ? { ...song, note: newNote } : song)));
  };

  // Handle zipfile upload to scan
  const handleAlbumUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) {
      return;
    }

    setFileData(file);
    setProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("zipfile", file);

    try {
      const response = await axios.post(scanUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-CSRFToken": csrfToken,
        },
      });

      // Small delay before hiding modal for smoother UX
      setTimeout(() => {
        setProcessing(false);
      }, 500);

      setAlbum(response.data.album);
      setArtist(response.data.artist[0]);
      setSongList(response.data.song_info);
    } catch (err) {
      setProcessing(false);
      console.error("Error scanning album:", err);
      setError("Error scanning album zipfile. Please try again.");
    }
  };

  // Handle album creation
  const handleAlbumAdd = async () => {
    if (!fileData) {
      setError("No file selected");
      return;
    }

    setProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("zipfile", fileData);
    formData.append("artist", artist);
    formData.append("source", String(songSource || ""));
    formData.append("tags", tagsInputRef.current?.getTags().join(",") || "");
    formData.append("songListChanges", collectSongListChanges());

    try {
      const response = await axios.post(addUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-CSRFToken": csrfToken,
        },
      });

      if (response.data.status !== "OK") {
        setProcessing(false);
        setError(response.data.error || "Error creating album");
      } else {
        // Redirect to new album
        window.location.href = response.data.url;
      }
    } catch (err) {
      setProcessing(false);
      console.error("Error creating album:", err);
      setError("Error creating album. Please try again.");
    }
  };

  return (
    <div>
      <h1 className="text-center">Upload Album</h1>

      {/* Error message */}
      {error && (
        <div className="alert alert-danger text-center" role="alert">
          {error}
        </div>
      )}

      <div id="create-album-container">
        {/* File upload */}
        <div>
          <label htmlFor="id_file" className="form-label">
            Upload album zipfile
          </label>
          <input
            className="form-control form-control-lg"
            id="id_file"
            type="file"
            accept=".zip"
            onChange={handleAlbumUpload}
            disabled={processing}
          />
        </div>

        {/* Album details - shown after scan */}
        {songList.length > 0 && (
          <div className="slide-fade-enter-active">
            {/* Album/Artist/Song count display */}
            <div className="d-flex justify-content-evenly mt-2">
              <div>
                <div className="text4 fw-bold text-center me-3">ARTIST</div>
                <div className="text-center me-3">{artist}</div>
              </div>
              <div>
                <div className="text4 fw-bold text-center me-3">ALBUM</div>
                <div className="text-center me-3">{album}</div>
              </div>
              <div>
                <div className="text4 fw-bold text-center me-3">SONG COUNT</div>
                <div className="text-center me-3">{songList.length}</div>
              </div>
            </div>

            {/* Song source and tags */}
            <div className="mt-2">
              <hr className="divider" />
              <div className="d-flex justify-content-evenly">
                <div className="d-flex">
                  <div className="text-nowrap me-3">Song Source</div>
                  <select
                    className="form-control form-select"
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
                <div className="d-flex">
                  <div className="text-nowrap me-3">Tags</div>
                  <TagsInput
                    ref={tagsInputRef}
                    id="id_tags"
                    searchUrl={`${tagSearchUrl}?query=`}
                    initialTags={[]}
                  />
                </div>
              </div>
            </div>

            {/* Multiple artists warning and song table */}
            {artistsUnique.size > 1 && (
              <div className="d-flex flex-column justify-content-center mt-3">
                <hr className="divider" />
                <div className="d-flex justify-content-center">
                  <div className="me-3">
                    <strong className="me-2">NOTE</strong>Multiple artists detected. Please choose
                    one:
                  </div>
                  <div>
                    <select
                      className="form-control form-select"
                      value={artist}
                      onChange={e => setArtist(e.target.value)}
                    >
                      {Array.from(artistsUnique).map(artistOption => (
                        <option key={artistOption} value={artistOption}>
                          {artistOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <table className="table mt-3">
                  <thead>
                    <tr>
                      <th className="text-center">Track #</th>
                      <th>Artist</th>
                      <th>Title</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {songList.map((song, index) => (
                      <tr key={song.track}>
                        <td className="text-center">{song.track}</td>
                        <td>{song.artist}</td>
                        <td>
                          <input
                            className="form-control"
                            type="text"
                            size={20}
                            value={song.title}
                            onChange={e => handleSongTitleChange(index, e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            type="text"
                            size={20}
                            value={song.note}
                            onChange={e => handleSongNoteChange(index, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add button */}
            <div className="d-flex justify-content-center mt-2">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleAlbumAdd}
                disabled={processing}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Modal */}
      {processing && (
        <div className="modal show d-block music-modal-overlay" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Processing...</span>
                </div>
                <p className="mb-0">Processing...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlbumCreatePage;
