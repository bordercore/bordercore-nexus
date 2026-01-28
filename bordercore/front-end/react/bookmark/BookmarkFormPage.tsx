import React, { useState, useRef, useCallback } from "react";
import { Card } from "../common/Card";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";
import RelatedTags, { RelatedTagsHandle } from "../common/RelatedTags";
import BackReferences from "../common/BackReferences";
import ToggleSwitch from "../common/ToggleSwitch";
import { doGet } from "../utils/reactUtils";
import type { BackReference, RelatedNode } from "./types";

interface FormField {
  name: string;
  label: string;
  value: string;
  type: "text" | "url" | "textarea" | "hidden";
  required?: boolean;
  errors?: string[];
}

interface BookmarkFormPageProps {
  uuid?: string;
  action: "Create" | "Update";
  formAction: string;
  csrfToken: string;
  thumbnailUrl?: string;
  faviconHtml?: string;
  bookmarkName?: string;
  fields: FormField[];
  initialTags: string[];
  initialImportance: boolean;
  initialIsPinned: boolean;
  initialDaily: number;
  backReferences: BackReference[];
  relatedNodes: RelatedNode[];
  urls: {
    tagSearch: string;
    relatedTags: string;
    getTitleFromUrl: string;
    deleteBookmark: string;
    bookmarkOverview: string;
  };
}

export function BookmarkFormPage({
  uuid,
  action,
  formAction,
  csrfToken,
  thumbnailUrl,
  faviconHtml,
  bookmarkName,
  fields,
  initialTags,
  initialImportance,
  initialIsPinned,
  initialDaily,
  backReferences,
  relatedNodes,
  urls,
}: BookmarkFormPageProps) {
  const [importance, setImportance] = useState(initialImportance);
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [daily, setDaily] = useState(initialDaily);

  const tagsInputRef = useRef<TagsInputHandle>(null);
  const relatedTagsRef = useRef<RelatedTagsHandle>(null);

  const handleClickTag = useCallback((tag: string) => {
    tagsInputRef.current?.addTag(tag);
  }, []);

  const handleTagsChanged = useCallback((tags: string[]) => {
    relatedTagsRef.current?.setTags(tags);
  }, []);

  const handleUrlBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Only auto-fetch title in create mode
      if (action !== "Create") return;

      // If the name has already been filled-in, abort
      const nameInput = document.getElementById("id_name") as HTMLInputElement;
      if (nameInput?.value) {
        return;
      }

      const url = e.target.value;
      if (!url) return;

      const encodedUrl = encodeURIComponent(url).replace(/%/g, "%25");

      doGet(
        `${urls.getTitleFromUrl}?url=${encodedUrl}`,
        (response) => {
          if (nameInput && response.data.title) {
            nameInput.value = response.data.title;
          }
        },
        "Error getting title from url"
      );
    },
    [action, urls.getTitleFromUrl]
  );

  const handleDelete = useCallback(() => {
    if (!uuid) return;

    const formEl = document.getElementById("bookmark-form") as HTMLFormElement;
    if (formEl) {
      formEl.setAttribute(
        "action",
        urls.deleteBookmark.replace("00000000-0000-0000-0000-000000000000", uuid)
      );
      formEl.submit();
    }
  }, [uuid, urls.deleteBookmark]);

  const renderField = (field: FormField) => {
    if (field.name === "tags") {
      return (
        <TagsInput
          ref={tagsInputRef}
          searchUrl={`${urls.tagSearch}?query=`}
          initialTags={initialTags}
          onTagsChanged={handleTagsChanged}
        />
      );
    }

    if (field.name === "url") {
      return (
        <input
          type="url"
          name="url"
          defaultValue={field.value}
          className="form-control"
          required={field.required}
          id="id_url"
          onBlur={action === "Create" ? handleUrlBlur : undefined}
          autoComplete="off"
        />
      );
    }

    if (field.name === "importance") {
      return (
        <ToggleSwitch
          name="importance"
          checked={importance}
          onChange={setImportance}
        />
      );
    }

    if (field.name === "is_pinned") {
      return (
        <ToggleSwitch
          name="is_pinned"
          checked={isPinned}
          onChange={setIsPinned}
        />
      );
    }

    if (field.name === "daily") {
      return (
        <ToggleSwitch
          name="daily"
          checked={daily === 1}
          onChange={(checked) => setDaily(checked ? 1 : 0)}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          name={field.name}
          defaultValue={field.value}
          className="form-control"
          id={`id_${field.name}`}
          rows={4}
        />
      );
    }

    return (
      <input
        type={field.type}
        name={field.name}
        defaultValue={field.value}
        className="form-control"
        required={field.required}
        id={`id_${field.name}`}
        autoComplete="off"
      />
    );
  };

  return (
    <div className="row g-0 h-100" id="bookmark-form-page">
      {/* Left sidebar */}
      <div className="flex-grow-last col-lg-3 d-flex flex-column ps-2">
        {/* Thumbnail preview */}
        {thumbnailUrl && (
          <div className="card-body p-3">
            <div className="d-flex justify-content-center">
              <img src={`${thumbnailUrl}?foo=bar`} className="mw-100" alt="" />
            </div>
          </div>
        )}

        {/* Related Tags */}
        <RelatedTags
          ref={relatedTagsRef}
          relatedTagsUrl={urls.relatedTags}
          initialTags={initialTags}
          onClickTag={handleClickTag}
        />

        {/* Back References */}
        {backReferences.length > 0 && (
          <BackReferences backReferences={backReferences} />
        )}

        {/* Related Nodes */}
        {relatedNodes.length > 0 && (
          <div className="d-flex">
            <Card title="Related Nodes" className="backdrop-filter w-100">
              <ul className="list-group interior-borders cursor-pointer">
                {relatedNodes.map((node) => (
                  <li
                    key={node.uuid}
                    className="hoverable px-0 list-group-item list-group-item-secondary text-primary"
                  >
                    <div className="d-flex align-items-center ps-3">
                      <div className="d-flex w-100">
                        <a href={node.url}>{node.name}</a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {/* Main form */}
      <div className="col-lg-9 d-flex flex-grow-last">
        <div className="card-body">
          <p className="lead offset-lg-2">
            {/* faviconHtml is trusted server-rendered HTML from the app's own database */}
            {faviconHtml && (
              <span dangerouslySetInnerHTML={{ __html: faviconHtml }} />
            )}{" "}
            {bookmarkName || "New Bookmark"}
          </p>

          <form id="bookmark-form" action={formAction} method="post">
            <input
              type="hidden"
              name="csrfmiddlewaretoken"
              value={csrfToken}
            />

            {fields.map((field) => (
              <React.Fragment key={field.name}>
                <div
                  className={`${
                    field.errors && field.errors.length > 0
                      ? "message-error "
                      : ""
                  }row mb-3`}
                >
                  <label className="fw-bold col-lg-2 col-form-label text-end">
                    {field.label}
                  </label>
                  <div className="col-lg-7 d-flex align-items-center">
                    {renderField(field)}
                  </div>
                </div>
                {field.errors && field.errors.length > 0 && (
                  <div className="row">
                    {field.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="form-error-bookmarks col-lg-7 offset-lg-2 mb-3"
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}

            <div>
              <div className="col-lg-7 offset-lg-2">
                <input
                  className="btn btn-primary"
                  type="submit"
                  name="Go"
                  value="Save"
                />
                {uuid && (
                  <input
                    className="btn btn-secondary ms-3"
                    type="button"
                    name="Go"
                    value="Delete"
                    onClick={handleDelete}
                  />
                )}
                <a href={urls.bookmarkOverview} className="ms-3">
                  Cancel
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BookmarkFormPage;
