import React, { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";

import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { MarkdownEditor, MarkdownEditorHandle } from "../blob/MarkdownEditor";
import RelatedObjects, { RelatedObjectsHandle } from "../common/RelatedObjects";
import ObjectSelectModal, { ObjectSelectModalHandle } from "../common/ObjectSelectModal";
import { doPost } from "../utils/reactUtils";

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
  csrfToken: string;
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
  csrfToken,
  returnUrl,
}: DrillQuestionEditPageProps) {
  const [isReversible, setIsReversible] = useState(initialIsReversible);

  // Refs
  const questionEditorRef = useRef<MarkdownEditorHandle>(null);
  const answerEditorRef = useRef<MarkdownEditorHandle>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);
  const relatedObjectsRef = useRef<RelatedObjectsHandle>(null);
  const objectSelectModalRef = useRef<ObjectSelectModalHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    objectSelectModalRef.current?.open();
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

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    // Get values from editors
    const questionValue = questionEditorRef.current?.getValue() || "";
    const answerValue = answerEditorRef.current?.getValue() || "";
    const tagsValue = tagsInputRef.current?.getTags().join(",") || "";

    // Set hidden input values
    const questionInput = form.querySelector('input[name="question"]') as HTMLInputElement;
    const answerInput = form.querySelector('input[name="answer"]') as HTMLInputElement;
    const tagsInput = form.querySelector('input[name="tags"]') as HTMLInputElement;

    if (questionInput) questionInput.value = questionValue;
    if (answerInput) answerInput.value = answerValue;
    if (tagsInput) tagsInput.value = tagsValue;

    // Submit the form
    form.submit();
  }, []);

  // Handle delete
  const handleDelete = useCallback(() => {
    const form = formRef.current;
    if (!form || !urls.delete) return;

    form.action = urls.delete;
    form.submit();
  }, [urls.delete]);

  return (
    <>
      <div className="row g-0 h-100 mx-2">
        {/* Left Panel */}
        <div className="flex-grow-last col-lg-3 d-flex flex-column">
          {/* Related Objects */}
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

          {/* Recent Tags */}
          <div className="card">
            <div className="card-body backdrop-filter">
              <div className="card-title-large d-flex align-items-center">
                <FontAwesomeIcon icon={faTags} className="me-3" />
                Recent Tags
              </div>
              <hr className="divider" />
              <ul className="list-group interior-borders">
                {recentTags.map(tag => (
                  <li
                    key={tag.name}
                    className="list-with-counts ps-2 py-1 pe-1 d-flex cursor-pointer"
                    onClick={() => handleTagClick(tag.name)}
                  >
                    <div className="text-truncate">{tag.name}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="col-lg-9">
          <form
            ref={formRef}
            id="question-form"
            action={urls.submit}
            method="post"
            className="d-flex flex-column h-100"
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <input type="hidden" name="question" />
            <input type="hidden" name="answer" />
            <input type="hidden" name="tags" />
            <input type="hidden" name="return_url" value={returnUrl} />

            {/* Question */}
            <div className={`${errors.question ? "error " : ""}row flex-grow-1 mb-3`}>
              <label className="fw-bold col-lg-2 col-form-label text-end">Question</label>
              <div className="col-lg-9 h-100">
                <MarkdownEditor ref={questionEditorRef} initialContent="" className="h-100" />
                {errors.question?.map((error, i) => (
                  <span key={i} className="form-error">
                    {error}
                  </span>
                ))}
              </div>
            </div>

            {/* Answer */}
            <div className={`${errors.answer ? "error " : ""}row flex-grow-1 mb-3`}>
              <label className="fw-bold col-lg-2 col-form-label text-end">Answer</label>
              <div className="col-lg-9 h-100">
                <MarkdownEditor ref={answerEditorRef} initialContent="" className="h-100" />
                {errors.answer?.map((error, i) => (
                  <span key={i} className="form-error">
                    {error}
                  </span>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className={`${errors.tags ? "error " : ""}row mb-3`}>
              <label className="fw-bold col-lg-2 col-form-label text-end">Tags</label>
              <div className="col-lg-9">
                <TagsInput
                  ref={tagsInputRef}
                  searchUrl={urls.tagSearch}
                  initialTags={initialTags}
                />
                {errors.tags?.map((error, i) => (
                  <span key={i} className="form-error">
                    Error: {error}
                  </span>
                ))}
              </div>
            </div>

            {/* Reversible */}
            <div className="row mb-3">
              <label className="fw-bold col-lg-2 col-form-label text-end">Reversible</label>
              <div className="col-lg-9 d-flex align-items-center">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="is_reversible"
                    name="is_reversible"
                    checked={isReversible}
                    onChange={e => setIsReversible(e.target.checked)}
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div>
              <div className="col-lg-9 offset-lg-2 d-flex" id="button-wrapper">
                {objectUuid && urls.delete && (
                  <button
                    className="btn btn-outline-danger me-auto"
                    type="button"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                )}
                <div className="d-flex ms-auto align-items-center">
                  <a className="btn btn-secondary" href={urls.cancel}>
                    Cancel
                  </a>
                  <button className="btn btn-primary ms-2" type="button" onClick={handleSubmit}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Object Select Modal */}
      {objectUuid && (
        <ObjectSelectModal
          ref={objectSelectModalRef}
          title="Select Object"
          searchObjectUrl={urls.searchNames}
          onSelectObject={handleObjectSelected}
        />
      )}
    </>
  );
}

export default DrillQuestionEditPage;
