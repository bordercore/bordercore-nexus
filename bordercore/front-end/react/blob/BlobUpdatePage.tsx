import React, { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { Modal } from "bootstrap";

import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { RelatedTags, RelatedTagsHandle } from "../common/RelatedTags";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { DropDownMenu } from "../common/DropDownMenu";
import { IconButton, IconButtonHandle } from "./IconButton";
import { MarkdownEditor, MarkdownEditorHandle } from "./MarkdownEditor";
import { EventBus, doGet, doPost } from "../utils/reactUtils";

interface MetadataItem {
  name: string;
  value: string;
}

interface Template {
  uuid: string;
  name: string;
}

interface LinkedBlob {
  uuid: string;
  name: string;
  thumbnail_url?: string;
}

interface CollectionInfo {
  uuid: string;
  name: string;
}

interface LinkedCollection {
  uuid: string;
  blobs: Array<{ uuid: string; name: string }>;
}

interface BlobUpdatePageProps {
  // Form data
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
  templateList: Template[];
  // Object being edited (if any)
  blobUuid?: string;
  blobSha1sum?: string;
  isPdf?: boolean;
  pdfPageNumber?: number;
  coverUrl?: string;
  // Context
  linkedBlob?: LinkedBlob;
  linkedCollection?: LinkedCollection;
  collectionInfo?: CollectionInfo;
  // URLs
  urls: {
    submit: string;
    tagSearch: string;
    relatedTags: string;
    metadataNameSearch: string;
    getTemplate: string;
    updateCoverImage: string;
    updatePageNumber: string;
    parseDate: string;
    blobDetail: string;
  };
  csrfToken: string;
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
  isPdf,
  pdfPageNumber = 1,
  coverUrl,
  linkedBlob,
  linkedCollection,
  collectionInfo,
  urls,
  csrfToken,
}: BlobUpdatePageProps) {
  // Form state
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate);
  const [dateFormat, setDateFormat] = useState<"standard" | "year">(initialDateFormat);
  const [note, setNote] = useState(initialNote);
  const [importance, setImportance] = useState(initialImportance);
  const [isNoteState, setIsNoteState] = useState(initialIsNote);
  const [isBook, setIsBook] = useState(initialIsBook);
  const [mathSupport, setMathSupport] = useState(initialMathSupport);
  const [fileName, setFileName] = useState(initialFileName);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<MetadataItem[]>(initialMetadata);
  const [pageNumber, setPageNumber] = useState(pdfPageNumber);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(coverUrl || "");
  const [selectedTemplate, setSelectedTemplate] = useState("-1");

  // Drag state
  const [isDragOver, setIsDragOver] = useState({
    coverImage: false,
    contentFile: false,
    fileFile: false,
  });

  // UI state
  const [showRelatedTags, setShowRelatedTags] = useState(false);
  const [activeTab, setActiveTab] = useState("main");

  // Refs
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const relatedTagsRef = useRef<RelatedTagsHandle>(null);
  const mdEditorRef = useRef<MarkdownEditorHandle>(null);
  const selectValueRef = useRef<SelectValueHandle>(null);
  const bookButtonRef = useRef<IconButtonHandle>(null);
  const metadataValueRef = useRef<HTMLInputElement>(null);

  // Date format menu items
  const dateFormatMenuItems = [
    {
      id: "standard",
      title: "Date Format: Standard",
      icon: dateFormat === "standard" ? faCheck : undefined,
      url: "#",
      clickHandler: () => setDateFormat("standard"),
    },
    {
      id: "year",
      title: "Date Format: Year",
      icon: dateFormat === "year" ? faCheck : undefined,
      url: "#",
      clickHandler: () => setDateFormat("year"),
    },
  ];

  // Handle icon button changes
  const handleEnableOption = useCallback((formName: string, value: boolean) => {
    switch (formName) {
      case "importance":
        setImportance(value);
        break;
      case "is_note":
        setIsNoteState(value);
        break;
      case "is_book":
        setIsBook(value);
        break;
      case "math_support":
        setMathSupport(value);
        break;
    }
  }, []);

  // Handle tags changed
  const handleTagsChanged = useCallback((tags: string[]) => {
    relatedTagsRef.current?.setTags(tags);
  }, []);

  // Handle related tag click
  const handleRelatedTagClick = useCallback((tag: string) => {
    tagsInputRef.current?.addTag(tag);
  }, []);

  // Cleanup filename
  const handleCleanupFilename = useCallback(() => {
    if (name && fileName) {
      const match = /(.*)(\..*?)$/.test(fileName) ? fileName.match(/(.*)(\..*?)$/) : null;
      if (match) {
        setFileName(name + match[2]);
      }
    }
  }, [name, fileName]);

  // Uppercase first letter
  const handleUppercaseFirst = useCallback(() => {
    if (metadataValueRef.current) {
      const value = metadataValueRef.current.value;
      metadataValueRef.current.value = value
        .toLowerCase()
        .replace(/(\s+)(.)|^(.)/g, (match, capture1, capture2) =>
          capture2 ? capture1 + capture2.toUpperCase() : match.toUpperCase()
        );
    }
  }, []);

  // Get template
  const handleGetTemplate = useCallback(() => {
    if (selectedTemplate === "-1") return;

    doGet(
      `${urls.getTemplate}?uuid=${selectedTemplate}`,
      response => {
        setSelectedTemplate("-1");

        // Reset everything first
        tagsInputRef.current?.clearOptions();
        mdEditorRef.current?.clear();
        bookButtonRef.current?.setValue(false);

        if (response.data.template.tags) {
          for (const tag of response.data.template.tags) {
            tagsInputRef.current?.addTag(tag);
          }
        }
        if (response.data.template.content) {
          mdEditorRef.current?.insert(() => ({
            text: response.data.template.content,
            selected: "",
          }));
        }
        if (response.data.template.is_book) {
          bookButtonRef.current?.setValue(true);
        }
      },
      "Error getting template"
    );
  }, [selectedTemplate, urls.getTemplate]);

  // Handle file drop
  const handleFileDrop = useCallback((file: File | null) => {
    if (file) {
      setFileObject(file);
      setFileName(file.name);
    }
  }, []);

  // Handle image drop for cover
  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(prev => ({ ...prev, coverImage: false }));

      const image = e.dataTransfer.files[0];
      if (image && image.type.indexOf("image/") >= 0 && blobUuid) {
        const formData = new FormData();
        formData.append("blob_uuid", blobUuid);
        formData.append("image", image);

        axios
          .post(urls.updateCoverImage, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then(() => {
            setCurrentCoverUrl(currentCoverUrl + "?" + new Date().getTime());
          });
      }
    },
    [blobUuid, urls.updateCoverImage, currentCoverUrl]
  );

  // Handle link drop on content
  const handleLinkDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("URL");
    if (url) {
      mdEditorRef.current?.insert(() => ({
        text: `[link](${url})`,
        selected: "link",
      }));
    }
  }, []);

  // Handle date paste
  const handleDatePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const clipText = encodeURIComponent(e.clipboardData.getData("Text").trim());

      axios.get(urls.parseDate.replace("666", clipText)).then(response => {
        if (response.data.output_date === "") {
          EventBus.$emit("toast", {
            title: "Error",
            body: "Invalid date format",
            variant: "danger",
          });
        } else {
          setDate(response.data.output_date);
        }
      });
    },
    [urls.parseDate]
  );

  // Add metadata
  const handleAddMetadata = useCallback(() => {
    const nameEl = document.getElementById("metadata_name") as HTMLInputElement;
    const valueEl = document.getElementById("id_value") as HTMLInputElement;

    if (!nameEl?.value || !valueEl?.value) {
      selectValueRef.current?.focus();
      return;
    }

    setMetadata(prev => [{ name: nameEl.value, value: valueEl.value }, ...prev]);

    selectValueRef.current?.clear();
    valueEl.value = "";

    setTimeout(() => {
      selectValueRef.current?.focus();
    }, 300);
  }, []);

  // Delete metadata
  const handleDeleteMetadata = useCallback((index: number) => {
    setMetadata(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update metadata value
  const handleMetadataValueChange = useCallback((index: number, value: string) => {
    setMetadata(prev => prev.map((m, i) => (i === index ? { ...m, value } : m)));
  }, []);

  // Handle edit page number
  const handleEditPageNumber = useCallback(() => {
    if (!blobUuid) return;

    doPost(urls.updatePageNumber, { blob_uuid: blobUuid, page_number: pageNumber }, () => {
      // Try to refresh cover image multiple times
      for (const timeout of [1000, 3000, 6000, 9000]) {
        setTimeout(() => {
          setCurrentCoverUrl(currentCoverUrl + "?" + new Date().getTime());
        }, timeout);
      }
    });
  }, [blobUuid, pageNumber, urls.updatePageNumber, currentCoverUrl]);

  // Submit form
  const handleSubmit = useCallback(() => {
    // Show processing modal
    const modalEl = document.getElementById("modalProcessing");
    if (modalEl) {
      const modal = new Modal(modalEl);
      modal.show();
    }

    const formData = new FormData();
    formData.append("csrfmiddlewaretoken", csrfToken);
    formData.append("name", name);
    formData.append("date", date);
    formData.append("content", mdEditorRef.current?.getValue() || "");
    formData.append("note", note);
    formData.append("tags", tagsInputRef.current?.getTags().join(",") || "");
    formData.append("importance", importance ? "on" : "");
    formData.append("is_note", isNoteState ? "on" : "");
    formData.append("is_book", isBook ? "on" : "");
    formData.append("math_support", mathSupport ? "on" : "");
    formData.append("metadata", JSON.stringify(metadata));
    formData.append("filename", fileName);

    if (fileObject) {
      formData.append("file", fileObject);
      formData.append("file_modified", String(Math.round(fileObject.lastModified / 1000)));
    }

    if (linkedBlob) {
      formData.append("linked_blob_uuid", linkedBlob.uuid);
    }
    if (linkedCollection) {
      formData.append("linked_collection", linkedCollection.uuid);
    }
    if (collectionInfo) {
      formData.append("collection_uuid", collectionInfo.uuid);
    }

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
        // Hide modal
        const modalEl = document.getElementById("modalProcessing");
        if (modalEl) {
          const modal = Modal.getInstance(modalEl);
          setTimeout(() => modal?.hide(), 500);
        }

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
    csrfToken,
    name,
    date,
    note,
    importance,
    isNoteState,
    isBook,
    mathSupport,
    metadata,
    fileObject,
    fileName,
    linkedBlob,
    linkedCollection,
    collectionInfo,
    urls,
  ]);

  // Initialize content
  useEffect(() => {
    if (initialContent && mdEditorRef.current) {
      mdEditorRef.current.insert(() => ({
        text: initialContent,
        selected: "",
      }));
    }
  }, []);

  return (
    <div className="row g-0 mx-2">
      {/* Left Panel */}
      <div className="col-lg-3">
        <div className="card-body backdrop-filter flex-grow-1">
          {/* Cover Image */}
          {blobSha1sum && currentCoverUrl && (
            <div
              className={`drag-target ${isDragOver.coverImage ? "drag-over" : ""}`}
              onDrop={handleImageDrop}
              onDragOver={e => {
                e.preventDefault();
                setIsDragOver(prev => ({ ...prev, coverImage: true }));
              }}
              onDragEnter={e => e.preventDefault()}
              onDragLeave={e => {
                e.preventDefault();
                setIsDragOver(prev => ({ ...prev, coverImage: false }));
              }}
            >
              <img
                id="coverImage"
                src={currentCoverUrl}
                width="400"
                className="mw-100 mb-3"
                alt="Cover"
              />
            </div>
          )}

          {/* Icon Buttons */}
          <div id="blob-options" className="d-flex mt-2">
            <IconButton
              label="Important"
              icon="heart"
              initialEnabled={initialImportance}
              formName="importance"
              onEnableOption={handleEnableOption}
            />
            <IconButton
              label="Note"
              icon="sticky-note"
              initialEnabled={initialIsNote}
              formName="is_note"
              onEnableOption={handleEnableOption}
            />
            <IconButton
              ref={bookButtonRef}
              label="Book"
              icon="book"
              initialEnabled={initialIsBook}
              formName="is_book"
              onEnableOption={handleEnableOption}
            />
            <IconButton
              label="Math"
              icon="square-root-alt"
              initialEnabled={initialMathSupport}
              formName="math_support"
              onEnableOption={handleEnableOption}
            />
          </div>

          <hr className="divider w-100" />

          {/* Utility Buttons */}
          <div className="d-flex flex-column">
            <div>
              <input
                type="button"
                className="btn btn-secondary"
                value="Cleanup Filename"
                onClick={handleCleanupFilename}
              />
            </div>
            <div className="mt-3">
              <input
                type="button"
                className="btn btn-secondary"
                value="Upper Case First"
                onClick={handleUppercaseFirst}
              />
            </div>
            {/* Template selector (only for new blobs) */}
            {!blobUuid && templateList.length > 0 && (
              <div className="mt-3">
                <select
                  className="form-control"
                  value={selectedTemplate}
                  onChange={e => {
                    setSelectedTemplate(e.target.value);
                    if (e.target.value !== "-1") {
                      handleGetTemplate();
                    }
                  }}
                >
                  <option value="-1">Use Template</option>
                  {templateList.map(t => (
                    <option key={t.uuid} value={t.uuid}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Collection Info */}
          {collectionInfo && (
            <div className="mt-4">
              Adding to collection{" "}
              <strong>
                <a href={`/collection/${collectionInfo.uuid}/`}>{collectionInfo.name}</a>
              </strong>
            </div>
          )}

          {/* Linked Blob */}
          {linkedBlob && (
            <div id="linked-blob" className="highlight-box d-flex align-items-center mt-5">
              {linkedBlob.thumbnail_url && <img src={linkedBlob.thumbnail_url} alt="" />}
              <h5 className="d-flex justify-content-center ms-2 w-100">
                <div>
                  Linking to <a href={`/blob/${linkedBlob.uuid}/`}>{linkedBlob.name || "Blob"}</a>
                </div>
              </h5>
            </div>
          )}

          {/* Linked Collection */}
          {linkedCollection && (
            <>
              <h6 className="my-3">Linking to a collection with these blobs:</h6>
              <ul className="list-group">
                {linkedCollection.blobs.map(blob => (
                  <li key={blob.uuid} className="list-group-item">
                    <a href={`/blob/${blob.uuid}/`}>{blob.name || "No Name"}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Related Tags */}
        {showRelatedTags && (
          <RelatedTags
            ref={relatedTagsRef}
            relatedTagsUrl={urls.relatedTags}
            onClickTag={handleRelatedTagClick}
          />
        )}
      </div>

      {/* Right Panel */}
      <div className="col-lg-9">
        <div className="card-grid ms-2">
          {/* Tabs */}
          <ul className="nav nav-tabs justify-content-center mb-2" role="tablist">
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === "main" ? "active" : ""}`}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setActiveTab("main");
                }}
              >
                Main
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === "file" ? "active" : ""}`}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setActiveTab("file");
                }}
              >
                File
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === "metadata" ? "active" : ""}`}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setActiveTab("metadata");
                }}
              >
                Metadata
              </a>
            </li>
            {isPdf && (
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === "cover" ? "active" : ""}`}
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    setActiveTab("cover");
                  }}
                >
                  Cover Image
                </a>
              </li>
            )}
          </ul>

          {/* Tab Content */}
          <div className="tab-content row pt-4">
            {/* Main Tab */}
            <div className={`tab-pane col-lg-12 ${activeTab === "main" ? "show active" : "fade"}`}>
              {/* Name */}
              <div className="row mb-3">
                <label className="fw-bold col-lg-2 col-form-label text-end">Name</label>
                <div className="col-lg-10">
                  <input
                    type="text"
                    id="id_name"
                    name="name"
                    className="form-control"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="row mb-3">
                <label className="fw-bold col-lg-2 col-form-label text-end">Date</label>
                <div className="col-lg-3">
                  <div className="input-group">
                    <input
                      type={dateFormat === "standard" ? "date" : "number"}
                      id="id_date"
                      name="date"
                      className="form-control date-input"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      onPaste={dateFormat === "standard" ? handleDatePaste : undefined}
                      placeholder={dateFormat === "year" ? "Year" : undefined}
                      autoComplete="off"
                    />
                    <div className="ms-1">
                      <DropDownMenu
                        links={dateFormatMenuItems}
                        initialHide={false}
                        className="calendar-date-format-menu d-flex align-items-center justify-content-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="row mb-3">
                <label className="fw-bold col-lg-2 col-form-label text-end">Content</label>
                <div className={`col-lg-10 ${isDragOver.contentFile ? "drag-over" : ""}`}>
                  <MarkdownEditor
                    ref={mdEditorRef}
                    initialContent=""
                    onDrop={handleLinkDrop}
                    onDragOver={e => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, contentFile: true }));
                    }}
                    onDragLeave={e => {
                      e.preventDefault();
                      setIsDragOver(prev => ({ ...prev, contentFile: false }));
                    }}
                    isDragOver={isDragOver.contentFile}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="row mb-3">
                <label className="fw-bold col-lg-2 col-form-label text-end">Tags</label>
                <div className="col-lg-10">
                  <TagsInput
                    ref={tagsInputRef}
                    searchUrl={urls.tagSearch}
                    initialTags={initialTags}
                    onTagsChanged={handleTagsChanged}
                    onBlur={() => setShowRelatedTags(false)}
                  />
                </div>
              </div>

              {/* Note */}
              <div className="row mb-3">
                <label className="fw-bold col-lg-2 col-form-label text-end">Note</label>
                <div className="col-lg-10">
                  <textarea
                    id="id_note"
                    name="note"
                    className="form-control"
                    rows={3}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="col-lg-10 offset-lg-2 d-flex">
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                  Save
                </button>
              </div>
            </div>

            {/* File Tab */}
            <div className={`tab-pane col-lg-12 ${activeTab === "file" ? "show active" : "fade"}`}>
              <div
                className={`drag-target d-flex flex-column align-items-center ${
                  isDragOver.fileFile ? "drag-over" : ""
                }`}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragOver(prev => ({ ...prev, fileFile: false }));
                  handleFileDrop(e.dataTransfer.files[0]);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragOver(prev => ({ ...prev, fileFile: true }));
                }}
                onDragEnter={e => e.preventDefault()}
                onDragLeave={e => {
                  e.preventDefault();
                  setIsDragOver(prev => ({ ...prev, fileFile: false }));
                }}
              >
                <h3 id="file-upload" className="d-flex flex-column align-items-center">
                  <div>Drag and Drop your file here</div>
                  <div id="text-divider" className="mt-3">
                    OR
                  </div>
                  <label className="btn btn-primary mt-3">
                    Choose file
                    <input
                      type="file"
                      name="file"
                      id="id_file"
                      hidden
                      onChange={e => handleFileDrop(e.target.files?.[0] || null)}
                    />
                  </label>
                  {fileName && (
                    <div id="filename" className="d-flex align-items-center mt-3">
                      <div>File:</div>
                      <div className="ms-2">
                        <input
                          type="text"
                          name="filename"
                          value={fileName}
                          onChange={e => setFileName(e.target.value)}
                          className="form-control"
                          id="id_filename"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  )}
                </h3>
              </div>
            </div>

            {/* Metadata Tab */}
            <div
              className={`tab-pane col-lg-12 ${activeTab === "metadata" ? "show active" : "fade"}`}
            >
              {/* Add Metadata */}
              <div className="row mb-3">
                <div className="col-lg-2">
                  <SelectValue
                    id="metadata_name"
                    ref={selectValueRef}
                    searchUrl={urls.metadataNameSearch}
                    placeHolder="Name"
                    onSelect={() => {
                      setTimeout(() => {
                        metadataValueRef.current?.focus();
                      }, 0);
                    }}
                  />
                </div>
                <div className="col-lg-10">
                  <div className="input-group">
                    <input
                      type="text"
                      id="id_value"
                      ref={metadataValueRef}
                      className="form-control"
                      placeholder="Value"
                      autoComplete="off"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMetadata();
                        }
                      }}
                    />
                    <button
                      id="blob-metadata-button"
                      className="btn btn-success"
                      type="button"
                      onClick={handleAddMetadata}
                    >
                      <FontAwesomeIcon icon={faPlus} className="metadata-icon" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Metadata List */}
              {metadata.map((m, index) => (
                <div key={index} className="row mb-3">
                  <label className="fw-bold col-lg-2 col-form-label text-end">{m.name}</label>
                  <div className="col-lg-10">
                    <div className="input-group">
                      <input
                        type="text"
                        value={m.value}
                        onChange={e => handleMetadataValueChange(index, e.target.value)}
                        className="form-control"
                        autoComplete="off"
                      />
                      <button
                        className="btn btn-danger btn-remove"
                        type="button"
                        onClick={() => handleDeleteMetadata(index)}
                      >
                        <FontAwesomeIcon icon={faTimes} className="metadata-icon" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Save Button */}
              <div className="col-lg-10 offset-lg-2 d-flex">
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                  Save
                </button>
              </div>
            </div>

            {/* Cover Image Tab (PDF only) */}
            {isPdf && (
              <div
                className={`tab-pane col-lg-12 ${activeTab === "cover" ? "show active" : "fade"}`}
              >
                <div className="d-flex align-items-center">
                  <div className="w-50">
                    Specify the PDF page number from which to extract the cover image. This usually
                    takes a few seconds to refresh.
                  </div>
                  <div className="mb-3 d-flex">
                    <label className="fw-bold col-form-label text-end">Page Number</label>
                    <div className="d-flex ms-3">
                      <input
                        type="number"
                        min="1"
                        value={pageNumber}
                        onChange={e => setPageNumber(Number(e.target.value))}
                        size={3}
                        className="form-control"
                        autoComplete="off"
                        id="id_page_number"
                      />
                      <button
                        type="button"
                        className="btn btn-primary ms-3"
                        onClick={handleEditPageNumber}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlobUpdatePage;
