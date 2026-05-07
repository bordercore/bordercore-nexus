import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faTrashCan,
  faExpand,
  faCompress,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

import { MarkdownEditor, MarkdownEditorHandle } from "./MarkdownEditor";
import { RefinedDatePicker } from "../common/RefinedDatePicker";
import { TagsInput } from "../common/TagsInput";
import { EventBus, doGet, doPost } from "../utils/reactUtils";
import { PreviewHero } from "./update/PreviewHero";
import { FilePane } from "./update/FilePane";
import { FlagsCard, FlagsState } from "./update/FlagsCard";
import { QuickActionsCard } from "./update/QuickActionsCard";
import { CollectionsCard, CollectionItem, BackrefItem } from "./update/CollectionsCard";
import {
  LinkedBannerCard,
  LinkedBlobInfo,
  LinkedCollectionInfo,
  CollectionInfo,
} from "./update/LinkedBannerCard";
import { TemplateSelector, TemplateOption } from "./update/TemplateSelector";
import { NameField } from "./update/NameField";
import { MetadataCard, MetadataItem } from "./update/MetadataCard";

type DocType = "video" | "book" | "image" | "note" | "audio" | "blob" | undefined;

function formatFileSize(bytes?: number): string | undefined {
  if (!bytes && bytes !== 0) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function doctypeFromMime(mime?: string): DocType {
  if (!mime) return undefined;
  if (mime === "application/pdf") return "book";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return undefined;
}

interface BlobUpdatePageProps {
  initialName: string;
  initialDate: string;
  initialDateFormat: "standard" | "year";
  initialContent: string;
  initialTags: string[];
  initialNote: string;
  initialImportance: boolean;
  initialIsNote: boolean;
  initialIsBook: boolean;
  initialMathSupport: boolean;
  initialFileName: string;
  initialMetadata: MetadataItem[];
  templateList: TemplateOption[];

  // Object being edited (if any)
  blobUuid?: string;
  blobSha1sum?: string;
  doctype?: DocType;
  isPdf?: boolean;
  pdfPageNumber?: number;
  pdfNumPages?: number;
  coverUrl?: string;
  fileSize?: string;
  durationLabel?: string;

  // Edit-mode lists
  collections?: CollectionItem[];
  backrefs?: BackrefItem[];

  // Create-mode context
  linkedBlob?: LinkedBlobInfo;
  linkedCollection?: LinkedCollectionInfo;
  collectionInfo?: CollectionInfo;

  // URLs
  urls: {
    submit: string;
    tagSearch: string;
    metadataNameSearch: string;
    getTemplate: string;
    updateCoverImage: string;
    updatePageNumber: string;
    parseDate: string;
    blobDetail: string;
    list: string;
    detail: string;
    clone?: string;
    delete?: string;
    download?: string;
  };
}

export function BlobUpdatePage({
  initialName,
  initialDate,
  initialDateFormat,
  initialContent,
  initialTags,
  initialNote,
  initialImportance,
  initialIsNote,
  initialIsBook,
  initialMathSupport,
  initialFileName,
  initialMetadata,
  templateList,
  blobUuid,
  blobSha1sum,
  doctype,
  isPdf,
  pdfPageNumber = 1,
  pdfNumPages,
  coverUrl,
  fileSize,
  durationLabel,
  collections = [],
  backrefs = [],
  linkedBlob,
  linkedCollection,
  collectionInfo,
  urls,
}: BlobUpdatePageProps) {
  const mode: "edit" | "create" = blobUuid ? "edit" : "create";

  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate);
  const [dateFormat, setDateFormat] = useState<"standard" | "year">(initialDateFormat);
  const [note, setNote] = useState(initialNote);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [metadata, setMetadata] = useState<MetadataItem[]>(initialMetadata);
  const [fileName, setFileName] = useState(initialFileName);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [pageNumber, setPageNumber] = useState(pdfPageNumber);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(coverUrl || "");
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("-1");

  const [contentExpanded, setContentExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [flags, setFlags] = useState<FlagsState>({
    importance: initialImportance,
    is_note: initialIsNote,
    is_book: initialIsBook,
    math_support: initialMathSupport,
  });

  const mdEditorRef = useRef<MarkdownEditorHandle>(null);

  // Initialize markdown editor with initial content
  useEffect(() => {
    if (initialContent && mdEditorRef.current) {
      mdEditorRef.current.insert(() => ({ text: initialContent, selected: "" }));
    }
  }, []);

  // ⌘S / Ctrl-S submit
  const handleSubmit = useCallback(() => {
    setSubmitting(true);

    // axios automatically injects X-CSRFToken from the csrftoken cookie.
    const formData = new FormData();
    formData.append("name", name);
    formData.append("date", date);
    formData.append("content", mdEditorRef.current?.getValue() || "");
    formData.append("note", note);
    formData.append("tags", tags.join(","));
    formData.append("importance", flags.importance ? "on" : "");
    formData.append("is_note", flags.is_note ? "on" : "");
    formData.append("is_book", flags.is_book ? "on" : "");
    formData.append("math_support", flags.math_support ? "on" : "");
    formData.append("metadata", JSON.stringify(metadata));
    formData.append("filename", fileName);

    if (fileObject) {
      formData.append("file", fileObject);
      formData.append("file_modified", String(Math.round(fileObject.lastModified / 1000)));
    }
    if (linkedBlob) formData.append("linked_blob_uuid", linkedBlob.uuid);
    if (linkedCollection) formData.append("linked_collection", linkedCollection.uuid);
    if (collectionInfo) formData.append("collection_uuid", collectionInfo.uuid);

    axios
      .post(urls.submit, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(response => {
        window.location.href = urls.blobDetail.replace(
          "00000000-0000-0000-0000-000000000000",
          response.data.uuid
        );
      })
      .catch(error => {
        setTimeout(() => setSubmitting(false), 500);
        const errors: string[] = [];
        if (error.response?.data) {
          for (const key in error.response.data) {
            errors.push(error.response.data[key][0]);
          }
        }
        EventBus.$emit("toast", {
          body: errors.join("<br />"),
          variant: "danger",
          autoHide: false,
        });
      });
  }, [
    name,
    date,
    note,
    tags,
    flags,
    metadata,
    fileName,
    fileObject,
    linkedBlob,
    linkedCollection,
    collectionInfo,
    urls,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  useEffect(() => {
    if (!contentExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setContentExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [contentExpanded]);

  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!deleteOpen) return;
    const t = window.setTimeout(() => cancelDeleteRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [deleteOpen]);

  // Quick action: cleanup filename — strip extension off existing filename, replace with name
  const handleCleanupFilename = useCallback(() => {
    if (!name || !fileName) return;
    const match = fileName.match(/(.*)(\.[^.]+)$/);
    if (match) setFileName(name + match[2]);
  }, [name, fileName]);

  // Quick action: upper case first letter of name
  const handleUppercaseFirst = useCallback(() => {
    setName(prev =>
      prev
        .toLowerCase()
        .replace(/(\s+)(.)|^(.)/g, (m, capture1, capture2) =>
          capture2 ? capture1 + capture2.toUpperCase() : m.toUpperCase()
        )
    );
  }, []);

  const handleDelete = useCallback(() => {
    if (!urls.delete) return;
    setDeleteOpen(true);
  }, [urls.delete]);

  const confirmDelete = useCallback(() => {
    if (!urls.delete) return;
    axios
      .delete(urls.delete)
      .then(() => {
        window.location.href = urls.list;
      })
      .catch(error => {
        setDeleteOpen(false);
        EventBus.$emit("toast", {
          title: "Error",
          body: `Error deleting blob: ${error}`,
          variant: "danger",
        });
      });
  }, [urls.delete, urls.list]);

  // Cover extract for PDF
  const handleExtractCover = useCallback(() => {
    if (!blobUuid) return;
    doPost(urls.updatePageNumber, { blob_uuid: blobUuid, page_number: pageNumber }, () => {
      // Refresh cover image multiple times since extraction is async
      for (const timeout of [1000, 3000, 6000, 9000]) {
        setTimeout(() => {
          setCurrentCoverUrl(prev => {
            const base = prev.split("?")[0];
            return `${base}?${new Date().getTime()}`;
          });
        }, timeout);
      }
    });
  }, [blobUuid, pageNumber, urls.updatePageNumber]);

  const handleToggleDateFormat = useCallback(() => {
    setDateFormat(prev => {
      const next = prev === "year" ? "standard" : "year";
      setDate(current => {
        if (next === "year") {
          // Going year-only: keep just the year if value is an ISO date
          const m = current.match(/^(\d{4})/);
          return m ? m[1] : "";
        }
        // Going full-date: drop a bare year (picker can't display it)
        return /^\d{4}$/.test(current) ? "" : current;
      });
      return next;
    });
  }, []);

  const handleFileReplace = useCallback((file: File) => {
    setFileObject(file);
    setFileName(file.name);
    setPreviewObjectUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
  }, []);

  // Revoke the preview object URL when it changes or on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  const handleTemplateChange = useCallback(
    (uuid: string) => {
      setSelectedTemplate(uuid);
      if (uuid === "-1") return;
      doGet(
        `${urls.getTemplate}?uuid=${uuid}`,
        response => {
          setSelectedTemplate("-1");
          setTags([]);
          mdEditorRef.current?.clear();
          setFlags(prev => ({ ...prev, is_book: false }));

          const tpl = response.data.template;
          if (tpl?.tags) setTags(tpl.tags);
          if (tpl?.content) {
            mdEditorRef.current?.insert(() => ({ text: tpl.content, selected: "" }));
          }
          if (tpl?.is_book) setFlags(prev => ({ ...prev, is_book: true }));
        },
        "Error getting template"
      );
    },
    [urls.getTemplate]
  );

  const handleSetFlag = useCallback((key: keyof FlagsState, value: boolean) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  }, []);

  // --- Determine preview mode ---
  const previewMode = useMemo<"video" | "book" | "image" | "note" | "create">(() => {
    if (mode === "create") return "create";
    if (flags.is_note) return "note";
    if (isPdf || flags.is_book || doctype === "book") return "book";
    if (doctype === "video") return "video";
    return "image";
  }, [mode, flags.is_note, flags.is_book, isPdf, doctype]);

  const noteContentPreview = flags.is_note
    ? mdEditorRef.current?.getValue()?.slice(0, 200) || initialContent?.slice(0, 200)
    : undefined;

  return (
    <div className={`be-page ${flags.is_note ? "is-note" : ""}`}>
      {/* Header */}
      <header className="be-header">
        {blobUuid ? (
          <a className="be-back" href={urls.detail} aria-label="Back to blob detail">
            <FontAwesomeIcon icon={faArrowLeft} />
          </a>
        ) : (
          <a className="be-back" href={urls.list} aria-label="Back to blobs list">
            <FontAwesomeIcon icon={faArrowLeft} />
          </a>
        )}
      </header>

      <div className="be-workspace">
        {/* Left column */}
        <aside className="be-col-left">
          <PreviewHero
            mode={previewMode}
            coverUrl={previewObjectUrl || currentCoverUrl}
            selectedFileUrl={previewObjectUrl}
            durationLabel={durationLabel}
            noteContentPreview={noteContentPreview}
            videoUrl={urls.download}
            pageNumber={pageNumber}
            totalPages={pdfNumPages}
            onPageNumberChange={setPageNumber}
            onExtractCover={handleExtractCover}
            onFileSelected={handleFileReplace}
          />
          {(mode === "edit" || fileObject) && (
            <FilePane
              filename={fileName}
              fileSize={mode === "edit" ? fileSize : formatFileSize(fileObject?.size)}
              doctype={mode === "edit" ? doctype : doctypeFromMime(fileObject?.type)}
              isNote={flags.is_note}
              downloadUrl={mode === "edit" ? urls.download : undefined}
              onFilenameChange={setFileName}
              onFileReplace={handleFileReplace}
            />
          )}
          <FlagsCard flags={flags} onChange={handleSetFlag} />
          <QuickActionsCard
            onCleanupFilename={handleCleanupFilename}
            onUppercaseFirst={handleUppercaseFirst}
            cloneUrl={mode === "edit" ? urls.clone : undefined}
            downloadUrl={mode === "edit" && !flags.is_note ? urls.download : undefined}
          />
          {mode === "edit" && <CollectionsCard collections={collections} backrefs={backrefs} />}
          {mode === "create" && (
            <>
              <TemplateSelector
                templates={templateList}
                value={selectedTemplate}
                onChange={handleTemplateChange}
              />
              <LinkedBannerCard
                linkedBlob={linkedBlob}
                linkedCollection={linkedCollection}
                collectionInfo={collectionInfo}
              />
            </>
          )}
        </aside>

        {/* Right column */}
        <section className="be-col-right">
          <NameField value={name} onChange={setName} />

          <div className="be-row-2">
            <div>
              <div className="be-label">
                date
                <button
                  type="button"
                  className={`be-format-toggle ${dateFormat === "year" ? "active" : ""}`}
                  onClick={handleToggleDateFormat}
                  aria-pressed={dateFormat === "year"}
                >
                  year only
                </button>
              </div>
              {dateFormat === "year" ? (
                <input
                  id="be-date"
                  type="text"
                  className="be-input mono"
                  value={date}
                  onChange={e => setDate(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="YYYY"
                  inputMode="numeric"
                  autoComplete="off"
                />
              ) : (
                <RefinedDatePicker
                  id="be-date"
                  value={date}
                  onChange={setDate}
                  placeholder="select a date"
                />
              )}
            </div>
            <div>
              <div className="be-label">tags</div>
              <TagsInput
                id="be-tags"
                searchUrl={urls.tagSearch}
                initialTags={tags}
                onTagsChanged={setTags}
              />
            </div>
          </div>

          <div>
            <div className="be-label">
              content
              <button
                type="button"
                className="be-expand-btn"
                onClick={() => setContentExpanded(prev => !prev)}
                aria-pressed={contentExpanded}
                aria-label={contentExpanded ? "Collapse editor" : "Expand editor"}
                title={contentExpanded ? "Collapse (Esc)" : "Expand"}
              >
                <FontAwesomeIcon icon={contentExpanded ? faCompress : faExpand} />
              </button>
            </div>
            {contentExpanded && (
              <div className="be-content-backdrop" onClick={() => setContentExpanded(false)} />
            )}
            <div className={`be-content-card ${contentExpanded ? "expanded" : ""}`}>
              <MarkdownEditor ref={mdEditorRef} initialContent="" />
            </div>
          </div>

          <MetadataCard
            metadata={metadata}
            onChange={setMetadata}
            nameSearchUrl={urls.metadataNameSearch}
          />

          <div>
            <div className="be-label">note</div>
            <textarea
              className="be-textarea"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="be-save-bar">
            {urls.delete && (
              <button type="button" className="be-btn danger" onClick={handleDelete}>
                <FontAwesomeIcon icon={faTrashCan} /> delete blob
              </button>
            )}
            <button type="button" className="be-btn primary be-save-confirm" onClick={handleSubmit}>
              Save changes
            </button>
          </div>
        </section>
      </div>

      {submitting &&
        createPortal(
          <>
            <div className="refined-modal-scrim" />
            <div
              className="refined-modal refined-modal-processing"
              role="dialog"
              aria-label="processing"
              aria-live="polite"
            >
              <div className="refined-modal-processing-body">
                <div className="spinner-border text-secondary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span className="refined-modal-processing-text">Processing…</span>
              </div>
            </div>
          </>,
          document.body
        )}

      {deleteOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={() => setDeleteOpen(false)} />
            <div className="refined-modal" role="dialog" aria-label="confirm delete blob">
              <button
                type="button"
                className="refined-modal-close"
                onClick={() => setDeleteOpen(false)}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Delete this blob?</h2>

              <p className="refined-modal-lead">
                <strong>{name || "This blob"}</strong> will be permanently removed. This cannot be
                undone.
              </p>

              <div className="refined-modal-actions compact">
                <button
                  ref={cancelDeleteRef}
                  type="button"
                  className="refined-btn ghost"
                  onClick={() => setDeleteOpen(false)}
                >
                  cancel
                </button>
                <button type="button" className="refined-btn danger" onClick={confirmDelete}>
                  <FontAwesomeIcon icon={faTrashCan} className="refined-btn-icon" />
                  delete blob
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export default BlobUpdatePage;
