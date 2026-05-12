import React, { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faTags, faCheck } from "@fortawesome/free-solid-svg-icons";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { doGet, getCsrfToken } from "../utils/reactUtils";
import { tagStyle } from "../utils/tagColors";
import { BookmarkMetaStrip } from "./BookmarkMetaStrip";
import type { BackReference, RelatedNode } from "./types";

interface FormField {
  name: string;
  label: string;
  value: string;
  type: "text" | "url" | "textarea" | "hidden";
  required?: boolean;
  errors?: string[];
}

interface BookmarkEditPageProps {
  uuid: string;
  formAction: string;
  thumbnailUrl?: string;
  faviconImgUrl?: string;
  bookmarkName: string;
  fields: FormField[];
  initialTags: string[];
  initialImportance: boolean;
  initialIsPinned: boolean;
  initialDaily: number;
  created: string;
  modified: string;
  lastCheck: string | null;
  lastResponseCode: number | null;
  backReferences: BackReference[];
  relatedNodes: RelatedNode[];
  urls: {
    tagSearch: string;
    relatedTags: string;
    deleteBookmark: string;
    bookmarkOverview: string;
  };
}

interface RelatedTagInfo {
  tag_name: string;
  count: number;
}

function getField(fields: FormField[], name: string): FormField | undefined {
  return fields.find(f => f.name === name);
}

export function BookmarkEditPage({
  uuid,
  formAction,
  thumbnailUrl,
  faviconImgUrl,
  bookmarkName,
  fields,
  initialTags,
  initialImportance,
  initialIsPinned,
  initialDaily,
  created,
  modified,
  lastCheck,
  lastResponseCode,
  backReferences,
  relatedNodes,
  urls,
}: BookmarkEditPageProps) {
  const urlField = getField(fields, "url");
  const nameField = getField(fields, "name");
  const noteField = getField(fields, "note");

  const [url, setUrl] = useState(urlField?.value || "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [relatedTagInfo, setRelatedTagInfo] = useState<RelatedTagInfo[]>([]);
  const [importance, setImportance] = useState(initialImportance);
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [daily, setDaily] = useState(initialDaily === 1);

  const formRef = useRef<HTMLFormElement>(null);
  const tagsRef = useRef<TagsInputHandle>(null);

  const fetchRelatedTags = useCallback(
    (currentTags: string[]) => {
      setRelatedTagInfo([]);
      if (currentTags.length === 0) return;
      const currentSet = new Set(currentTags);
      for (const tag of currentTags) {
        const params = new URLSearchParams({
          tag_name: tag,
          doc_type: "bookmark",
        });
        doGet(
          `${urls.relatedTags}?${params.toString()}`,
          response => {
            const info: RelatedTagInfo[] = response.data?.info ?? [];
            setRelatedTagInfo(prev => {
              const byName = new Map(prev.map(r => [r.tag_name, r.count]));
              for (const item of info) {
                if (currentSet.has(item.tag_name)) continue;
                byName.set(item.tag_name, (byName.get(item.tag_name) ?? 0) + item.count);
              }
              return Array.from(byName, ([tag_name, count]) => ({ tag_name, count }));
            });
          },
          "Error fetching related tags"
        );
      }
    },
    [urls.relatedTags]
  );

  useEffect(() => {
    fetchRelatedTags(initialTags);
  }, [fetchRelatedTags, initialTags]);

  const handleTagsChanged = useCallback(
    (next: string[]) => {
      setTags(next);
      fetchRelatedTags(next);
    },
    [fetchRelatedTags]
  );

  const handleAddRelatedTag = useCallback((tag: string) => {
    tagsRef.current?.addTag(tag);
  }, []);

  const handleDelete = useCallback(() => {
    if (!formRef.current) return;
    formRef.current.setAttribute(
      "action",
      urls.deleteBookmark.replace("00000000-0000-0000-0000-000000000000", uuid)
    );
    formRef.current.submit();
  }, [uuid, urls.deleteBookmark]);

  const openInNewTab = useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  const renderError = (field: FormField | undefined) => {
    if (!field?.errors || field.errors.length === 0) return null;
    return (
      <div className="form-error-bookmarks" role="alert">
        {field.errors.join(", ")}
      </div>
    );
  };

  return (
    <div className="refined-page-shell" id="bookmark-edit-page">
      <div className="refined-page-header">
        <h1 className="refined-breadcrumb-h1">
          <span className="current">
            {faviconImgUrl && (
              <img
                src={faviconImgUrl}
                width={20}
                height={20}
                alt=""
                className="me-2 align-middle"
              />
            )}
            {bookmarkName}
          </span>
        </h1>
        <BookmarkMetaStrip
          created={created}
          modified={modified}
          lastCheck={lastCheck}
          lastResponseCode={lastResponseCode}
        />
      </div>

      <div className="refined-page-grid">
        <aside className="refined-page-sidebar">
          {thumbnailUrl && (
            <section className="refined-section">
              <h3 className="refined-section-title">thumbnail</h3>
              <img src={thumbnailUrl} className="max-w-full" alt="" />
            </section>
          )}

          {relatedTagInfo.length > 0 && (
            <section className="refined-section">
              <h3 className="refined-section-title">
                <FontAwesomeIcon icon={faTags} className="me-2" />
                related tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {relatedTagInfo.map(rt => (
                  <button
                    key={rt.tag_name}
                    type="button"
                    className="refined-tag"
                    style={tagStyle(rt.tag_name)} // must remain inline
                    onClick={() => handleAddRelatedTag(rt.tag_name)}
                  >
                    {rt.tag_name} <span className="ms-1 opacity-75">{rt.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {backReferences.length > 0 && (
            <section className="refined-section">
              <h3 className="refined-section-title">back references</h3>
              <ul className="list-unstyled m-0">
                {backReferences.map(ref => (
                  <li key={ref.uuid} className="mb-2">
                    <a href={ref.url} className="no-underline">
                      {ref.type === "question" ? ref.question : ref.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {relatedNodes.length > 0 && (
            <section className="refined-section">
              <h3 className="refined-section-title">related nodes</h3>
              <ul className="list-unstyled m-0">
                {relatedNodes.map(node => (
                  <li key={node.uuid} className="mb-2">
                    <a href={node.url} className="no-underline">
                      {node.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <main className="refined-page-main">
          <section className="refined-section">
            <form
              ref={formRef}
              id="bookmark-form"
              action={formAction}
              method="post"
              aria-label="edit bookmark"
              onSubmit={e => {
                const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
                  'input[name="csrfmiddlewaretoken"]'
                );
                if (tokenInput) tokenInput.value = getCsrfToken();
              }}
            >
              <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />

              <div className="refined-field">
                <label htmlFor="id_url">url</label>
                <div className="refined-input-group">
                  <input
                    id="id_url"
                    type="url"
                    name="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    required={urlField?.required}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="refined-icon-btn"
                    onClick={openInNewTab}
                    disabled={!url}
                    aria-label="open in new tab"
                    title="Open in new tab"
                  >
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  </button>
                </div>
                {renderError(urlField)}
              </div>

              <div className="refined-field">
                <label htmlFor="id_name">name</label>
                <input
                  id="id_name"
                  type="text"
                  name="name"
                  defaultValue={nameField?.value || ""}
                  required={nameField?.required}
                  maxLength={200}
                  autoComplete="off"
                />
                {renderError(nameField)}
              </div>

              <div className="refined-field">
                <label htmlFor="id_note">
                  note <span className="optional">· optional</span>
                </label>
                <textarea
                  id="id_note"
                  name="note"
                  className="form-control"
                  defaultValue={noteField?.value || ""}
                />
                {renderError(noteField)}
              </div>

              <div className="refined-field">
                <label htmlFor="id_tags">
                  tags <span className="optional">· optional</span>
                </label>
                <TagsInput
                  ref={tagsRef}
                  id="id_tags"
                  searchUrl={`${urls.tagSearch}?query=`}
                  initialTags={initialTags}
                  onTagsChanged={handleTagsChanged}
                />
              </div>

              <div className="refined-toggle-row">
                <label className="refined-toggle">
                  <ToggleSwitch name="importance" checked={importance} onChange={setImportance} />
                  <span>important</span>
                </label>
                <label className="refined-toggle">
                  <ToggleSwitch name="is_pinned" checked={isPinned} onChange={setIsPinned} />
                  <span>pinned</span>
                </label>
                <label className="refined-toggle">
                  <ToggleSwitch name="daily" checked={daily} onChange={setDaily} />
                  <span>daily</span>
                </label>
              </div>

              <div className="refined-page-actions">
                <button type="button" className="refined-btn danger" onClick={handleDelete}>
                  delete
                </button>
                <a href={urls.bookmarkOverview} className="refined-btn ghost">
                  cancel
                </a>
                <button type="submit" className="refined-btn primary">
                  <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
                  save
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

export default BookmarkEditPage;
