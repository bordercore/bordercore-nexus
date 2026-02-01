import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MarkdownIt from "markdown-it";
import { Card } from "../common/Card";
import { Pagination } from "../search/Pagination";
import { doPost } from "../utils/reactUtils";
import type { NoteListPageProps, NoteResult, PinnedNote } from "./types";

// Should match CSS class "note-content"
const NOTE_MAX_HEIGHT = 500;

const markdown = new MarkdownIt();

interface SortablePinnedNoteItemProps {
  note: PinnedNote;
}

function SortablePinnedNoteItem({ note }: SortablePinnedNoteItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.uuid,
  });

  const localRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      localRef.current = el;
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    const node = localRef.current;
    if (!node) return;
    node.style.transform = CSS.Transform.toString(transform);
    node.style.transition = transition;
  }, [transform, transition]);

  return (
    <div
      ref={setRefs}
      className={`slicklist-item${isDragging ? " dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="slicklist-list-item-inner">
        <li className="list-group-item" data-uuid={note.uuid}>
          <a href={note.url}>{note.name}</a>
        </li>
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: NoteResult;
  index: number;
  isSearchResult: boolean;
  isSelected: boolean;
  urls: NoteListPageProps["urls"];
  onExpand: () => void;
  contentRef: (el: HTMLDivElement | null) => void;
}

function NoteCard({
  note,
  index,
  isSearchResult,
  isSelected,
  urls,
  onExpand,
  contentRef,
}: NoteCardProps) {
  const noteDetailUrl = urls.noteDetail.replace(
    "00000000-0000-0000-0000-000000000000",
    note.source.uuid
  );

  const getContent = (content: string, limit?: number): string => {
    if (!content) {
      return "";
    }
    let processedContent = content;
    if (limit) {
      processedContent = content.substring(0, limit) || "";
    }
    return markdown.render(processedContent);
  };

  const contentClasses = [
    "mt-3",
    !isSearchResult ? "note-content-truncated" : "",
    !note.isExpanded && !isSearchResult ? "fader" : "",
    note.isExpanded ? "expanded-note" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`position-relative ${isSearchResult && !isSelected ? "d-none" : ""}`}>
      <Card
        cardClassName="me-0"
        titleSlot={
          <>
            {index === 0 && (
              <div className="position-absolute end-0">
                <a className="btn btn-primary ms-2 me-4" href={urls.createNote}>
                  New note
                </a>
              </div>
            )}
            <h2>
              <a href={noteDetailUrl}>{note.source.name}</a>
            </h2>
          </>
        }
      >
        <div className="blob-content">
          <h6 className="text-primary">{note.source.date}</h6>

          <div>
            <div className="position-relative">
              {/* User-owned content rendered with markdown-it - safe to render */}
              <div
                ref={contentRef}
                className={contentClasses}
                dangerouslySetInnerHTML={{ __html: getContent(note.source.contents) }}
              />
            </div>
            {!note.isExpanded && !isSearchResult && (
              <div className="text-center">
                <a
                  className="text-primary"
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    onExpand();
                  }}
                >
                  —Expand—
                </a>
              </div>
            )}
          </div>
          {note.source.tags.map(tag => (
            <span key={tag} className="me-2">
              <a className="tag" href={`${urls.notesSearch}?tagsearch=${tag}`}>
                {tag}
              </a>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

interface SearchResultItemProps {
  note: NoteResult;
  isSelected: boolean;
  onClick: () => void;
  urls: NoteListPageProps["urls"];
}

function SearchResultItem({ note, isSelected, onClick, urls }: SearchResultItemProps) {
  const getContent = (content: string, limit?: number): string => {
    if (!content) {
      return "";
    }
    let processedContent = content;
    if (limit) {
      processedContent = content.substring(0, limit) || "";
    }
    return markdown.render(processedContent);
  };

  return (
    <li
      className={`px-2 py-3 d-flex flex-column ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <h4 className="text-primary fw-bold">{note.source.name || "Note"}</h4>
      <div className="search-result-date mb-1">{note.source.date}</div>
      <div className="position-relative">
        {/* User-owned content rendered with markdown-it - safe to render */}
        <div
          className="fader note-content"
          dangerouslySetInnerHTML={{ __html: getContent(note.source.contents, 400) }}
        />
      </div>
      <div className="mt-2">
        {note.source.tags.map(tag => (
          <span key={tag} className="me-2">
            <a className="tag" href={`${urls.notesSearch}?tagsearch=${tag}`}>
              {tag}
            </a>
          </span>
        ))}
      </div>
    </li>
  );
}

export function NoteListPage({
  initialResults,
  pinnedNotes: initialPinnedNotes,
  paginator,
  count,
  isSearchResult,
  urls,
}: NoteListPageProps) {
  const [results, setResults] = useState<NoteResult[]>(initialResults);
  const [pinnedNotes, setPinnedNotes] = useState<PinnedNote[]>(initialPinnedNotes);
  const [selectedNoteUuid, setSelectedNoteUuid] = useState<string>(
    initialResults.length > 0 ? initialResults[0].source.uuid : ""
  );

  // Store refs for each note element for height detection
  const noteElementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasCheckedHeights = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Height detection for expand/collapse - runs synchronously after DOM update
  useLayoutEffect(() => {
    if (hasCheckedHeights.current) return;

    const updates: number[] = [];
    results.forEach((note, index) => {
      const element = noteElementRefs.current[index];
      if (element) {
        // Auto-expand short notes or all search results
        if (element.scrollHeight < NOTE_MAX_HEIGHT || isSearchResult) {
          if (!note.isExpanded) {
            updates.push(index);
          }
        }
      }
    });

    if (updates.length > 0) {
      hasCheckedHeights.current = true;
      setResults(prev => {
        const newResults = [...prev];
        updates.forEach(index => {
          newResults[index] = { ...newResults[index], isExpanded: true };
        });
        return newResults;
      });
    } else if (noteElementRefs.current.filter(Boolean).length === results.length) {
      // All refs are set, mark as checked even if no updates needed
      hasCheckedHeights.current = true;
    }
  }, [results, isSearchResult]);

  // MathJax integration - typeset when results change
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).MathJax?.typesetPromise) {
      (window as any).MathJax.typesetPromise().catch((err: Error) => {
        console.error("MathJax typeset error:", err);
      });
    }
  }, [results, selectedNoteUuid]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = pinnedNotes.findIndex(item => item.uuid === active.id);
        const newIndex = pinnedNotes.findIndex(item => item.uuid === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newList = arrayMove(pinnedNotes, oldIndex, newIndex);
          setPinnedNotes(newList);

          const noteUuid = pinnedNotes[oldIndex].uuid;
          // The backend expects the ordering to begin with 1, not 0, so add 1.
          const newPosition = newIndex + 1;

          doPost(
            urls.sortPinnedNotes,
            {
              note_uuid: noteUuid,
              new_position: newPosition.toString(),
            },
            () => {},
            "",
            "Error sorting pinned notes"
          );
        }
      }
    },
    [pinnedNotes, urls.sortPinnedNotes]
  );

  const handleExpand = useCallback((uuid: string) => {
    setResults(prev =>
      prev.map(note => (note.source.uuid === uuid ? { ...note, isExpanded: true } : note))
    );
  }, []);

  const setContentRef = useCallback((index: number) => {
    return (el: HTMLDivElement | null) => {
      noteElementRefs.current[index] = el;
    };
  }, []);

  return (
    <div className="note-list-page scrollable-panel-container row g-0 mx-2">
      <div className="col-lg-3 h-100">
        {/* Pinned Notes - show when not searching */}
        {pinnedNotes.length > 0 && !isSearchResult && (
          <div className="d-flex flex-column h-100">
            <Card cardClassName="flex-grow-1" titleSlot={<div className="h3">Pinned Notes</div>}>
              <ul className="list-group list-group-flush interior-borders">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={pinnedNotes.map(n => n.uuid)}
                    strategy={verticalListSortingStrategy}
                  >
                    {pinnedNotes.map(note => (
                      <SortablePinnedNoteItem key={note.uuid} note={note} />
                    ))}
                  </SortableContext>
                </DndContext>
              </ul>
              {pinnedNotes.length === 0 && <div>No notes found to pin.</div>}
            </Card>
          </div>
        )}

        {/* Search Results List - show when searching */}
        {isSearchResult && (
          <div className="scrollable-panel-scrollbar-hover card-body d-flex flex-column h-100">
            <div className="h3">
              {count} Note{count !== 1 ? "s" : ""} Found
            </div>
            <div className="d-flex flex-column">
              <ul className="note-search-result list-unstyled">
                {results.map(note => (
                  <SearchResultItem
                    key={note.source.uuid}
                    note={note}
                    isSelected={note.source.uuid === selectedNoteUuid}
                    onClick={() => setSelectedNoteUuid(note.source.uuid)}
                    urls={urls}
                  />
                ))}
              </ul>
              {paginator && (
                <div className="d-flex justify-content-center">
                  <Pagination paginator={paginator} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="col-lg-9 h-100 scrollable-panel d-flex flex-column">
        {results.map((note, index) => (
          <NoteCard
            key={note.source.uuid}
            note={note}
            index={index}
            isSearchResult={isSearchResult}
            isSelected={note.source.uuid === selectedNoteUuid}
            urls={urls}
            onExpand={() => handleExpand(note.source.uuid)}
            contentRef={setContentRef(index)}
          />
        ))}

        {results.length === 0 && (
          <div className="card-grid">
            <div className="card-body">
              <p>No notes found matching search criteria.</p>
            </div>

            <a className="btn btn-primary ms-2 me-4 float-end me-3" href={urls.createNote}>
              Add note
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default NoteListPage;
