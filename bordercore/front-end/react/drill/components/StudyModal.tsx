import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faTimes } from "@fortawesome/free-solid-svg-icons";
import TagsInput, { TagsInputHandle } from "../../common/TagsInput";

interface Props {
  open: boolean;
  initialMethod: string;
  startStudySessionUrl: string;
  tagSearchUrl: string;
  onClose: () => void;
}

const METHODS = [
  { key: "all", label: "All questions", hint: "Every question in your library" },
  { key: "favorites", label: "Favorites", hint: "Just your starred questions" },
  { key: "recent", label: "Recent", hint: "Created in the last N days" },
  { key: "tag", label: "Tag", hint: "Pick one or more tags" },
  { key: "random", label: "Random", hint: "A small random sample" },
  { key: "keyword", label: "Keyword", hint: "Match question or answer text" },
];

export default function StudyModal({
  open,
  initialMethod,
  startStudySessionUrl,
  tagSearchUrl,
  onClose,
}: Props) {
  const [studyMethod, setStudyMethod] = useState(initialMethod);
  const formRef = useRef<HTMLFormElement>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  // Re-sync method when the modal re-opens with a new initial scope
  useEffect(() => {
    if (open) setStudyMethod(initialMethod);
  }, [open, initialMethod]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => formRef.current?.submit();

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        ref={formRef}
        action={startStudySessionUrl}
        className="refined-modal"
        role="dialog"
        aria-label="start study session"
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="refined-modal-eyebrow">
          <span>start study session</span>
          <span className="dot">·</span>
          <span className="mono">bordercore / drill</span>
        </div>

        <h2 className="refined-modal-title">Start a session</h2>
        <p className="refined-modal-lead">
          Pick a scope and a filter, then start. The scope can be a tag, a keyword, or one of the
          built-in selections.
        </p>

        <div className="refined-field">
          <label>method</label>
          <div className="study-method-grid">
            {METHODS.map(m => (
              <label
                key={m.key}
                className={`study-method-card ${studyMethod === m.key ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name="study_method"
                  value={m.key}
                  checked={studyMethod === m.key}
                  onChange={() => setStudyMethod(m.key)}
                />
                <span className="title">{m.label}</span>
                <span className="hint">{m.hint}</span>
              </label>
            ))}
          </div>
        </div>

        {studyMethod === "recent" && (
          <div className="refined-field">
            <label htmlFor="study-modal-interval">interval</label>
            <select id="study-modal-interval" name="interval" defaultValue="7">
              <option value="1">Past Day</option>
              <option value="3">Past 3 Days</option>
              <option value="7">Past Week</option>
              <option value="14">Past Two Weeks</option>
              <option value="21">Past Three Weeks</option>
              <option value="30">Past Month</option>
              <option value="60">Past Two Months</option>
              <option value="90">Past Three Months</option>
            </select>
          </div>
        )}

        {studyMethod === "tag" && (
          <div className="refined-field">
            <label htmlFor="study-modal-tags">tags</label>
            <TagsInput
              ref={tagsInputRef}
              searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
              name="tags"
              id="study-modal-tags"
              placeholder="Tag name"
            />
          </div>
        )}

        {studyMethod === "random" && (
          <div className="refined-field">
            <label htmlFor="study-modal-count">count</label>
            <select id="study-modal-count" name="count" defaultValue="10">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="100">100</option>
            </select>
          </div>
        )}

        {studyMethod === "keyword" && (
          <div className="refined-field">
            <label htmlFor="study-modal-keyword">keyword</label>
            <input
              id="study-modal-keyword"
              name="keyword"
              autoComplete="off"
              placeholder="word or phrase"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
        )}

        <div className="refined-field">
          <label htmlFor="study-modal-filter">filter</label>
          <select id="study-modal-filter" name="filter" defaultValue="review">
            <option value="review">Questions needing review</option>
            <option value="all">All questions</option>
          </select>
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="button" className="refined-btn primary" onClick={submit}>
            <FontAwesomeIcon icon={faBolt} className="refined-btn-icon" />
            start session <span className="kbd">⏎</span>
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
