import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

interface SaveAsNoteFormProps {
  defaultTitle: string;
  onSave: (data: { title: string; tags: string }) => void;
  onCancel: () => void;
}

export function SaveAsNoteForm({ defaultTitle, onSave, onCancel }: SaveAsNoteFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [tags, setTags] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), tags });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    // Chat owns the keystroke — don't let underlying page shortcuts react.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="chatbot-save-as-note" onKeyDown={handleKey} onKeyUp={e => e.stopPropagation()}>
      <div className="chatbot-save-field">
        <label htmlFor="chatbot-save-title">title</label>
        <input
          ref={titleRef}
          id="chatbot-save-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div className="chatbot-save-field">
        <label htmlFor="chatbot-save-tags">
          tags <span className="optional">· optional</span>
        </label>
        <input
          id="chatbot-save-tags"
          type="text"
          placeholder="comma-separated"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />
      </div>
      <div className="chatbot-save-actions">
        <button type="button" className="chatbot-action-btn" onClick={onCancel}>
          cancel
        </button>
        <button
          type="button"
          className="chatbot-action-btn chatbot-action-btn--primary"
          onClick={submit}
        >
          <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
          save
        </button>
      </div>
    </div>
  );
}

export default SaveAsNoteForm;
