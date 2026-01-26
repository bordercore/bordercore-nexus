import React, { useState } from "react";
import { Card } from "../common/Card";
import { DrillTagProgress } from "./DrillTagProgress";
import { CalendarCard } from "./CalendarCard";
import type {
  Task,
  DrillProgress,
  OverdueExercise,
  Bookmark,
  Song,
  Quote,
  RandomImageInfo,
  DefaultCollection,
  CollectionBlob,
} from "./types";

interface HomepagePageProps {
  // URLs
  todoListUrl: string;
  drillListUrl: string;
  bookmarkOverviewUrl: string;
  bookmarkCreateUrl: string;
  blobCreateUrl: string;
  getCalendarEventsUrl: string;

  // Data
  tasks: Task[];
  drillProgress: DrillProgress;
  overdueExercises: OverdueExercise[];
  dailyBookmarks: Bookmark[];
  pinnedBookmarks: Bookmark[];
  bookmarks: Bookmark[];
  music: Song[];
  quote: Quote | null;
  randomImageInfo: RandomImageInfo | null;
  defaultCollection: DefaultCollection | null;

  // URL templates
  exerciseDetailUrlTemplate: string;
  bookmarkClickUrlTemplate: string;
  artistDetailUrlTemplate: string;
  blobDetailUrlTemplate: string;
  collectionDetailUrlTemplate: string;
}

export function HomepagePage({
  todoListUrl,
  drillListUrl,
  bookmarkOverviewUrl,
  bookmarkCreateUrl,
  blobCreateUrl,
  getCalendarEventsUrl,
  tasks,
  drillProgress,
  overdueExercises,
  dailyBookmarks,
  pinnedBookmarks,
  bookmarks,
  music,
  quote,
  randomImageInfo,
  defaultCollection,
  exerciseDetailUrlTemplate,
  bookmarkClickUrlTemplate,
  artistDetailUrlTemplate,
  blobDetailUrlTemplate,
  collectionDetailUrlTemplate,
}: HomepagePageProps) {
  const [showModal, setShowModal] = useState(false);

  const getExerciseDetailUrl = (uuid: string) =>
    exerciseDetailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const getBookmarkClickUrl = (uuid: string) =>
    bookmarkClickUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const getArtistDetailUrl = (uuid: string) =>
    artistDetailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const getBlobDetailUrl = (uuid: string) =>
    blobDetailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const getCollectionDetailUrl = (uuid: string) =>
    collectionDetailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const getFaviconUrl = (url: string): string | null => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      // Strip www. prefix if present
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }
      return `https://www.bordercore.com/favicons/${domain}.ico`;
    } catch {
      return null;
    }
  };

  return (
    <div className="homepage">
      <div className="row h-100 g-0 mx-2">
        {/* First Column */}
        <div className="d-flex flex-column col-lg-3 pe-gutter">
          {/* Important Tasks Card */}
          <Card
            className="backdrop-filter"
            titleSlot={
              <div className="card-title">
                <a href={todoListUrl}>Important Tasks</a>
              </div>
            }
          >
            <ul id="important-tasks" className="list-group interior-borders">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <li key={task.uuid} className="list-group-item list-group-item-secondary">
                    {task.name}
                    {task.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </li>
                ))
              ) : (
                <li className="list-group-item list-group-item-secondary">All done!</li>
              )}
            </ul>
          </Card>

          {/* Drill Total Progress Card */}
          <Card
            className="backdrop-filter"
            titleSlot={
              <div className="card-title">
                <a href={drillListUrl}>Drill Total Progress</a>
              </div>
            }
          >
            <div className="d-flex">
              <div className="d-flex justify-content-center align-items-center">
                Percentage across all tags of questions not needing review
              </div>
              <DrillTagProgress count={drillProgress.count} progress={drillProgress.percentage} />
            </div>
          </Card>

          {/* Overdue Exercises Card */}
          <Card title="Overdue Exercises" className="backdrop-filter">
            <ul className="list-group interior-borders">
              {overdueExercises.length > 0 ? (
                overdueExercises.map((exercise) => (
                  <li key={exercise.uuid} className="list-group-item list-group-item-secondary">
                    <a href={getExerciseDetailUrl(exercise.uuid)}>{exercise.name}</a>
                    <span className="item-value">{exercise.delta_days} days</span>
                  </li>
                ))
              ) : (
                <li className="list-group-item list-group-item-secondary">No active exercises.</li>
              )}
            </ul>
          </Card>

          {/* Daily Bookmarks Card */}
          <Card title="Daily Bookmarks" className="backdrop-filter">
            <ul className="list-group interior-borders">
              {dailyBookmarks.length > 0 ? (
                dailyBookmarks.map((bookmark) => (
                  <li
                    key={bookmark.uuid}
                    className={`list-group-item list-group-item-secondary ${
                      bookmark.daily?.viewed === "false" ? "fw-bold" : ""
                    }`}
                  >
                    <a href={getBookmarkClickUrl(bookmark.uuid)}>{bookmark.name}</a>
                  </li>
                ))
              ) : (
                <li className="list-group-item list-group-item-secondary">
                  No bookmarks marked as Daily.
                </li>
              )}
            </ul>
          </Card>

          {/* Pinned Bookmarks Card */}
          <Card title="Pinned Bookmarks" className="backdrop-filter flex-grow-1">
            <ul className="list-group interior-borders">
              {pinnedBookmarks.length > 0 ? (
                pinnedBookmarks.map((bookmark) => (
                  <li
                    key={bookmark.uuid}
                    id="pinned-bookmarks"
                    className="list-group-item list-group-item-secondary"
                  >
                    <a href={bookmark.url}>{bookmark.name}</a>
                  </li>
                ))
              ) : (
                <li className="list-group-item list-group-item-secondary">No pinned bookmarks.</li>
              )}
            </ul>
          </Card>
        </div>

        {/* Second Column */}
        <div className="col-lg-5 d-flex flex-column pe-gutter">
          {/* Recent Bookmarks Card */}
          <Card
            className="backdrop-filter"
            titleSlot={
              <div className="card-title">
                <a href={bookmarkOverviewUrl}>Recent Bookmarks</a>
              </div>
            }
          >
            {bookmarks.length > 0 ? (
              <ul
                id="recent-bookmarks"
                className="list-group interior-borders scrollable-panel-scrollbar-hover vh-50"
              >
                {bookmarks.map((bookmark) => {
                  const faviconUrl = getFaviconUrl(bookmark.url);
                  return (
                    <li key={bookmark.uuid} className="list-group-item text-success d-flex align-items-start">
                      {faviconUrl && (
                        <img src={faviconUrl} width="16" height="16" alt="" className="homepage-favicon" />
                      )}
                      <div className="ms-2">
                        <a href={bookmark.url}>{bookmark.name}</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <li className="list-group-item list-group-item-secondary">
                <a className="ms-2" href={bookmarkCreateUrl}>
                  Add a bookmark
                </a>
              </li>
            )}
          </Card>

          {/* Default Collection Card */}
          {defaultCollection && (
            <Card
              className="backdrop-filter"
              titleSlot={
                <div className="card-title">
                  <a href={getCollectionDetailUrl(defaultCollection.uuid)}>
                    {defaultCollection.name}
                  </a>
                </div>
              }
            >
              <ul className="list-group list-group-horizontal text-center list-unstyled justify-content-between">
                {defaultCollection.blob_list.map((blob: CollectionBlob) => (
                  <li key={blob.uuid} className="mx-3">
                    <a href={blob.url}>
                      <img src={blob.cover_url} alt="" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Recently Played Music Card */}
          <Card title="Recently Played Music" className="backdrop-filter">
            <ul className="list-group interior-borders">
              {music.length > 0 ? (
                music.map((song, index) => (
                  <li key={index} className="list-group-item list-group-item-secondary">
                    {song.title}
                    <a
                      className="item-value ms-2"
                      href={getArtistDetailUrl(song.artist.uuid)}
                    >
                      {song.artist.name}
                    </a>
                  </li>
                ))
              ) : (
                <li className="list-group-item list-group-item-secondary">No music listened to.</li>
              )}
            </ul>
          </Card>

          {/* Quote Card */}
          <Card title="Quote" className="backdrop-filter flex-grow-1">
            {quote ? (
              <div>
                {quote.quote}
                <br />
                <strong>{quote.source}</strong>
              </div>
            ) : (
              <div>No quote available.</div>
            )}
          </Card>
        </div>

        {/* Third Column */}
        <div className="col-lg-4 d-flex flex-column">
          {/* Calendar Card */}
          <CalendarCard getCalendarEventsUrl={getCalendarEventsUrl} />

          {/* Random Image Card */}
          <Card
            className="backdrop-filter flex-grow-1"
            titleSlot={
              randomImageInfo ? (
                <div className="card-title">
                  <a href={getBlobDetailUrl(randomImageInfo.uuid)}>{randomImageInfo.name}</a>
                </div>
              ) : (
                <div className="card-title">Random Image</div>
              )
            }
          >
            {randomImageInfo ? (
              <img
                src={randomImageInfo.url}
                className="mw-100 cursor-pointer"
                onClick={() => setShowModal(true)}
                alt={randomImageInfo.name}
              />
            ) : (
              <a href={blobCreateUrl}>Add a blob</a>
            )}
          </Card>
        </div>
      </div>

      {/* Image Modal */}
      {showModal && randomImageInfo && (
        <div
          className="modal fade show d-block"
          className="homepage-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered w-75 mw-100">
            <div className="modal-content">
              <div className="modal-body">
                <div>
                  <img src={randomImageInfo.url} className="w-100" alt={randomImageInfo.name} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomepagePage;
