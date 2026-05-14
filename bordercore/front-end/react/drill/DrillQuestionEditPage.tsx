import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes, faTrashCan } from "@fortawesome/free-solid-svg-icons";

import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { MarkdownEditor, MarkdownEditorHandle } from "../blob/MarkdownEditor";
import RelatedObjects, { RelatedObjectsHandle } from "../common/RelatedObjects";
import ObjectSelectModal from "../common/ObjectSelectModal";
import { doPost, getCsrfToken } from "../utils/reactUtils";

interface RecentTag {
  name: string;
}

interface DrillQuestionEditPageProps {
  // Form data
  initialQuestion: string;
  initialAnswer: string;
  initialTags: string[];
  initialIsReversible: boolean;
  // Object being edited (if any)
  objectUuid?: string;
  // Action type
  action: "Add" | "Edit";
  // Recent tags
  recentTags: RecentTag[];
  // Form errors
  errors: {
    question?: string[];
    answer?: string[];
    tags?: string[];
  };
  // URLs
  urls: {
    submit: string;
    delete?: string;
    cancel: string;
    tagSearch: string;
    relatedObjects: string;
    newObject: string;
    removeObject: string;
    sortRelatedObjects: string;
    editRelatedObjectNote: string;
    searchNames: string;
  };
  returnUrl: string;
}

export function DrillQuestionEditPage({
  initialQuestion,
  initialAnswer,
  initialTags,
  initialIsReversible,
  objectUuid,
  action,
  recentTags,
  errors,
  urls,
  returnUrl,
}: DrillQuestionEditPageProps) {
  const [isReversible, setIsReversible] = useState(initialIsReversible);
  const [objectSelectOpen, setObjectSelectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Refs
  const questionEditorRef = useRef<MarkdownEditorHandle>(null);
  const answerEditorRef = useRef<MarkdownEditorHandle>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const relatedObjectsRef = useRef<RelatedObjectsHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // Initialize editors with content
  useEffect(() => {
    if (initialQuestion && questionEditorRef.current) {
      questionEditorRef.current.insert(() => ({
        text: initialQuestion,
        selected: "",
      }));
    }
    if (initialAnswer && answerEditorRef.current) {
      answerEditorRef.current.insert(() => ({
        text: initialAnswer,
        selected: "",
      }));
    }
  }, []);

  // Handle tag click from recent tags
  const handleTagClick = useCallback((tagName: string) => {
    const currentTags = tagsInputRef.current?.getTags() || [];
    if (!currentTags.includes(tagName)) {
      tagsInputRef.current?.addTag(tagName);
    }
  }, []);

  // Handle opening object select modal
  const handleOpenObjectSelectModal = useCallback(() => {
    setObjectSelectOpen(true);
  }, []);

  // Handle object selection from modal
  const handleObjectSelected = useCallback(
    (selectedObject: { uuid: string; name: string }) => {
      if (!objectUuid) return;

      doPost(
        urls.newObject,
        {
          node_uuid: objectUuid,
          object_uuid: selectedObject.uuid,
          node_type: "drill",
        },
        () => {
          relatedObjectsRef.current?.refresh();
        }
      );
    },
    [urls.newObject, objectUuid]
  );

  // Sync the React-controlled editor/tag values into the hidden form fields,
  // refresh the CSRF token (the cookie may have rotated since page load),
  // then submit.
  const handleSubmit = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const questionValue = questionEditorRef.current?.getValue() || "";
    const answerValue = answerEditorRef.current?.getValue() || "";
    const tagsValue = tagsInputRef.current?.getTags().join(",") || "";

    const questionInput = form.querySelector('input[name="question"]') as HTMLInputElement;
    const answerInput = form.querySelector('input[name="answer"]') as HTMLInputElement;
    const tagsInput = form.querySelector('input[name="tags"]') as HTMLInputElement;
    const tokenInput = form.querySelector('input[name="csrfmiddlewaretoken"]') as HTMLInputElement;

    if (questionInput) questionInput.value = questionValue;
    if (answerInput) answerInput.value = answerValue;
    if (tagsInput) tagsInput.value = tagsValue;
    if (tokenInput) tokenInput.value = getCsrfToken();

    form.action = urls.submit;
    form.submit();
  }, [urls.submit]);

  // ⌘S / Ctrl-S submit (parity with blob update page)
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

  // Delete-confirm modal lifecycle: focus cancel, close on Escape
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

  const confirmDelete = useCallback(() => {
    const form = formRef.current;
    if (!form || !urls.delete) return;

    const tokenInput = form.querySelector('input[name="csrfmiddlewaretoken"]') as HTMLInputElement;
    if (tokenInput) tokenInput.value = getCsrfToken();

    form.action = urls.delete;
    form.submit();
  }, [urls.delete]);

  return (
    <div className="be-page">
      <div className="be-workspace">
        {/* Left rail */}
        <aside className="be-col-left">
          {objectUuid && (
            <RelatedObjects
              ref={relatedObjectsRef}
              objectUuid={objectUuid}
              nodeType="drill"
              relatedObjectsUrl={urls.relatedObjects}
              newObjectUrl={urls.newObject}
              removeObjectUrl={urls.removeObject}
              sortRelatedObjectsUrl={urls.sortRelatedObjects}
              editRelatedObjectNoteUrl={urls.editRelatedObjectNote}
              searchNamesUrl={urls.searchNames}
              showEmptyList={true}
              onOpenObjectSelectModal={handleOpenObjectSelectModal}
            />
          )}

          <section className="be-section">
            <div className="be-section-title">Recent Tags</div>
            <ul className="dq-recent-tags">
              {recentTags.map(tag => (
                <li
                  key={tag.name}
                  className="dq-recent-tag"
                  onClick={() => handleTagClick(tag.name)}
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* Right column — form */}
        <section className="be-col-right">
          <form
            ref={formRef}
            id="question-form"
            action={urls.submit}
            method="post"
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />
            <input type="hidden" name="question" />
            <input type="hidden" name="answer" />
            <input type="hidden" name="tags" />
            <input type="hidden" name="return_url" value={returnUrl} />

            <div>
              <div className="be-label">question</div>
              <div className="be-content-card">
                <MarkdownEditor ref={questionEditorRef} initialContent="" />
              </div>
              {errors.question?.map((error, i) => (
                <span key={i} className="form-error">
                  {error}
                </span>
              ))}
            </div>

            <div>
              <div className="be-label">answer</div>
              <div className="be-content-card">
                <MarkdownEditor ref={answerEditorRef} initialContent="" />
              </div>
              {errors.answer?.map((error, i) => (
                <span key={i} className="form-error">
                  {error}
                </span>
              ))}
            </div>

            <div>
              <div className="be-label">tags</div>
              <TagsInput ref={tagsInputRef} searchUrl={urls.tagSearch} initialTags={initialTags} />
              {errors.tags?.map((error, i) => (
                <span key={i} className="form-error">
                  Error: {error}
                </span>
              ))}
            </div>

            <div>
              <div className="be-label">reversible</div>
              <ToggleSwitch
                id="is_reversible"
                name="is_reversible"
                checked={isReversible}
                onChange={setIsReversible}
              />
            </div>

            <div className="be-save-bar">
              {objectUuid && urls.delete && (
                <button type="button" className="be-btn danger" onClick={() => setDeleteOpen(true)}>
                  <FontAwesomeIcon icon={faTrashCan} /> delete question
                </button>
              )}
              <a href={urls.cancel} className="refined-btn ghost be-save-spacer">
                cancel
              </a>
              <button type="button" className="refined-btn primary" onClick={handleSubmit}>
                <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
                save
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Object select modal (related-objects flow) */}
      {objectUuid && (
        <ObjectSelectModal
          open={objectSelectOpen}
          onClose={() => setObjectSelectOpen(false)}
          title="Select object"
          searchObjectUrl={urls.searchNames}
          onSelectObject={handleObjectSelected}
        />
      )}

      {/* Delete-confirm modal */}
      {deleteOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={() => setDeleteOpen(false)} />
            <div className="refined-modal" role="dialog" aria-label="confirm delete question">
              <button
                type="button"
                className="refined-modal-close"
                onClick={() => setDeleteOpen(false)}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Delete this question?</h2>

              <p className="refined-modal-lead">
                This question will be permanently removed. This cannot be undone.
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
                  delete
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export default DrillQuestionEditPage;
