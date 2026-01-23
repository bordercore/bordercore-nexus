import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import type { TagDetailMatch } from "./types";

interface TagSearchResultProps {
  docType: string;
  matches: TagDetailMatch[];
  isActive?: boolean;
}

export function TagSearchResult({ docType, matches, isActive = false }: TagSearchResultProps) {
  const isGrid =
    docType === "blob" ||
    docType === "book" ||
    docType === "bookmark" ||
    docType === "document" ||
    docType === "note";
  const isFlexWrap = isGrid || docType === "album";

  return (
    <div id={docType} className={`tab-pane fade ${isActive ? "show active" : ""}`}>
      <ul className={`list-unstyled ${isFlexWrap ? "d-flex flex-wrap" : ""}`}>
        {matches.map((match) => (
          <li
            key={match.uuid}
            className={`search-result py-3 ${isGrid ? "grid" : ""}`}
          >
            {docType === "drill" && (
              <div className="col-lg-12">
                <a href={match.object_url}>{match.question}</a>
              </div>
            )}

            {docType === "song" && (
              <div className="col-lg-12">
                <a href={match.object_url}>
                  {match.artist} = {match.title}
                </a>
              </div>
            )}

            {docType === "todo" && (
              <div className="col-lg-12 d-flex flex-column">
                <div>{match.name}</div>
                <div className="search-todo-date ms-2">{match.date}</div>
              </div>
            )}

            {docType === "album" && (
              <div className="d-flex flex-column">
                <div>
                  <a href={match.object_url}>
                    <img src={match.album_artwork_url} height="150" width="150" alt="" />
                  </a>
                </div>
                <div className="mt-1 fw-bold">{match.title}</div>
                <div className="text-light">
                  <a href={match.object_url}>{match.artist}</a>
                </div>
              </div>
            )}

            {/* Default case: blob, book, bookmark, document, note */}
            {docType !== "drill" &&
              docType !== "song" &&
              docType !== "todo" &&
              docType !== "album" && (
                <div className="d-flex my-1">
                  {(docType === "blob" || docType === "book") && match.cover_url && (
                    <div>
                      <img src={match.cover_url} alt="" />
                    </div>
                  )}
                  <div className="d-flex flex-column ms-3">
                    <h4>
                      {match.importance && match.importance > 1 && (
                        <FontAwesomeIcon
                          icon={faHeart}
                          className="favorite"
                          data-bs-toggle="tooltip"
                          data-placement="bottom"
                          title="Favorite"
                        />
                      )}
                      <a href={match.object_url}>{match.name || "No Title"}</a>
                    </h4>
                    {(docType === "blob" ||
                      docType === "book" ||
                      docType === "note" ||
                      docType === "document") && (
                      <>
                        {(docType === "note" || docType === "document") && match.contents && (
                          <h5>{match.contents}</h5>
                        )}
                        {docType !== "note" && docType !== "document" && match.creators && (
                          <small>{match.creators}</small>
                        )}
                        {docType !== "note" && docType !== "document" && match.date && (
                          <div className="search-result-date">{match.date}</div>
                        )}
                      </>
                    )}
                    {docType === "bookmark" && (
                      <div className="d-flex mb-2 align-items-center text-primary">
                        {/* favicon_url is trusted HTML from the backend containing an img tag */}
                        {match.favicon_url && (
                          <span dangerouslySetInnerHTML={{ __html: match.favicon_url }} />
                        )}
                        <div className="ms-2">{match.url_domain}</div>
                      </div>
                    )}
                    <div className="d-flex flex-wrap mt-2">
                      {match.tags.map((tag) => (
                        <a key={tag.name} href={tag.url} className="tag">
                          {tag.name}
                        </a>
                      ))}
                    </div>
                  </div>
                  {(docType === "bookmark" ||
                    docType === "note" ||
                    docType === "document") &&
                    match.date && (
                      <div className="search-result-date text-nowrap ms-auto ps-4">
                        {match.date}
                      </div>
                    )}
                </div>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TagSearchResult;
