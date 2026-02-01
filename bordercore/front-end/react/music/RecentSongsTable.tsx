import React from "react";
import MarkdownIt from "markdown-it";
import type { RecentAddedSong } from "./types";

// markdown-it sanitizes HTML by default, providing XSS protection
const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface RecentSongsTableProps {
  songs: RecentAddedSong[];
}

export function RecentSongsTable({ songs }: RecentSongsTableProps) {
  const renderNote = (note: string) => {
    return { __html: markdown.render(note) };
  };

  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Title</th>
            <th>Artist</th>
            <th>Year</th>
            <th className="text-center">Length</th>
          </tr>
        </thead>
        <tbody>
          {songs.map(song => (
            <tr key={song.uuid} className="song hover-target">
              <td className="align-middle">
                <span>{song.title}</span>
                {song.note && (
                  <span
                    className="ps-2 table-note"
                    dangerouslySetInnerHTML={renderNote(song.note)}
                  />
                )}
              </td>
              <td className="align-middle">
                <a href={song.artist_url}>{song.artist}</a>
              </td>
              <td className="align-middle">{song.year}</td>
              <td className="align-middle text-center">{song.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RecentSongsTable;
