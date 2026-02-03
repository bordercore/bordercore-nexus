import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStickyNote, faPencilAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doGet, doPost, doPut } from "../utils/reactUtils";
import type { NoteLayoutItem, Note, NodeColor } from "./types";

interface NodeNoteProps {
  nodeUuid: string;
  noteInitial: NoteLayoutItem;
  noteUrl: string;
  setNoteColorUrl: string;
  deleteNoteUrl: string;
  colorPreview?: NodeColor;
  onOpenNoteMetadataModal: (
    callback: (data: { name: string; color: NodeColor }) => void,
    data: { name: string; color: NodeColor; uuid: string }
  ) => void;
  onEditLayout: (layout: string) => void;
}

export default function NodeNote({
  nodeUuid,
  noteInitial,
  noteUrl,
  setNoteColorUrl,
  deleteNoteUrl,
  colorPreview,
  onOpenNoteMetadataModal,
  onEditLayout,
}: NodeNoteProps) {
  const [nodeNote, setNodeNote] = useState<NoteLayoutItem>(noteInitial);
  const [note, setNote] = useState<Note | null>(null);
  const [noteContents, setNoteContents] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const nameCacheRef = useRef<string | null>(null);

  useEffect(() => {
    getNote();
  }, []);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingContent && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [isEditingContent]);

  const getNote = () => {
    doGet(
      noteUrl,
      response => {
        setNote(response.data);
        setNoteContents(response.data.content || "");
      },
      "Error getting note"
    );
  };

  const editNoteContents = () => {
    doPut(
      noteUrl,
      {
        uuid: nodeNote.uuid,
        name: nodeNote.name,
        content: noteContents,
        is_note: "true",
      },
      () => {},
      ""
    );
  };

  const editNoteMetadata = (data: { name: string; color: NodeColor }) => {
    doPost(
      setNoteColorUrl,
      {
        node_uuid: nodeUuid,
        note_uuid: nodeNote.uuid,
        color: data.color.toString(),
      },
      () => {
        setNodeNote(prev => ({ ...prev, color: data.color, name: data.name }));
      },
      "",
      ""
    );
    editNoteContents();
  };

  const handleNoteEdit = () => {
    setIsEditingContent(true);
  };

  const handleNameDoubleClick = () => {
    nameCacheRef.current = nodeNote.name;
    setIsEditingName(true);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (nameCacheRef.current === nodeNote.name) {
      return;
    }
    editNoteMetadata({ name: nodeNote.name, color: nodeNote.color });
  };

  const handleContentBlur = () => {
    setIsEditingContent(false);
    editNoteContents();
  };

  const handleNoteDelete = () => {
    doPost(
      deleteNoteUrl,
      {
        node_uuid: nodeUuid,
        note_uuid: note?.uuid || nodeNote.uuid,
      },
      response => {
        onEditLayout(response.data.layout);
      },
      "Note deleted"
    );
  };

  const handleOpenNoteMetadataModal = () => {
    onOpenNoteMetadataModal(editNoteMetadata, {
      name: nodeNote.name,
      color: nodeNote.color,
      uuid: nodeNote.uuid,
    });
  };

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleNoteEdit();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit note</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleOpenNoteMetadataModal();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit note metadata</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleNoteDelete();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faTimes} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Delete note</span>
        </a>
      </li>
    </ul>
  );

  const titleSlot = (
    <div className="card-title d-flex">
      <div className="dropdown-height d-flex">
        <div>
          <FontAwesomeIcon icon={faStickyNote} className="text-primary me-3" />
        </div>
        <div className="w-100">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="form-control w-100"
              value={nodeNote.name}
              onChange={e => setNodeNote(prev => ({ ...prev, name: e.target.value }))}
              onBlur={handleNameBlur}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleNameBlur();
                }
              }}
            />
          ) : (
            <span onDoubleClick={handleNameDoubleClick} className="cursor-pointer">
              {nodeNote.name}
            </span>
          )}
        </div>
      </div>
      {note && (
        <div className="dropdown-menu-container ms-auto">
          <DropDownMenu dropdownSlot={dropdownContent} />
        </div>
      )}
    </div>
  );

  const displayColor = colorPreview ?? nodeNote.color;
  const cardClass = `backdrop-filter node-color-${displayColor}`;

  return (
    <div className="hover-target">
      <Card cardClassName={cardClass} titleSlot={titleSlot}>
        <hr className="divider" />
        <div className="node-note">
          {isEditingContent ? (
            <textarea
              ref={contentTextareaRef}
              className="form-control"
              value={noteContents}
              onChange={e => setNoteContents(e.target.value)}
              onBlur={handleContentBlur}
              rows={5}
            />
          ) : (
            <div onClick={() => setIsEditingContent(true)} className="cursor-pointer">
              {noteContents || <span className="text-muted">No content</span>}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
