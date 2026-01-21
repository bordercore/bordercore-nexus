import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { Modal } from "bootstrap";
import { TagsInput, TagsInputHandle } from "../common/TagsInput";
import { doPost, doPut } from "../utils/reactUtils";

interface TodoInfo {
  uuid?: string;
  name?: string;
  priority?: number;
  note?: string;
  tags?: string[];
  url?: string;
  due_date?: Date | string | null;
}

interface TodoEditorProps {
  priorityList: [number, string][];
  editTodoUrl: string;
  createTodoUrl: string;
  tagSearchUrl: string;
  onAdd?: (uuid: string) => void;
  onDelete?: (todoInfo: TodoInfo) => void;
  onEdit?: (uuid: string) => void;
}

export interface TodoEditorHandle {
  openModal: (action: "Edit" | "Create", todoInfo?: TodoInfo) => void;
  setAction: (action: "Edit" | "Create") => void;
  setTags: (tagList: string[]) => void;
  todoInfo: TodoInfo;
}

export const TodoEditor = forwardRef<TodoEditorHandle, TodoEditorProps>(
  function TodoEditor(
    {
      priorityList,
      editTodoUrl,
      createTodoUrl,
      tagSearchUrl,
      onAdd,
      onDelete,
      onEdit,
    },
    ref
  ) {
    const [action, setAction] = useState<"Edit" | "Create">("Edit");
    const [isDragOver, setIsDragOver] = useState(false);
    const [todoInfo, setTodoInfo] = useState<TodoInfo>({
      priority: 2,
      tags: [],
    });

    const modalRef = useRef<Modal | null>(null);
    const tagsInputRef = useRef<TagsInputHandle>(null);
    const dueDateInputRef = useRef<HTMLInputElement>(null);
    const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize modal on mount
    useEffect(() => {
      const modalElement = document.getElementById("modalEditTodo");
      if (modalElement) {
        modalRef.current = new Modal(modalElement);
      }
      return () => {
        modalRef.current?.dispose();
      };
    }, []);

    const handleLinkDrop = useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);

        const link = `[link](${event.dataTransfer.getData("URL")})`;
        const textarea = noteTextareaRef.current;
        if (textarea) {
          const newValue = `${textarea.value}${link}`;
          textarea.value = newValue;
          const index = newValue.indexOf(link);
          textarea.setSelectionRange(index + 1, index + 5);
          setTodoInfo((prev) => ({ ...prev, note: newValue }));
        }
      },
      []
    );

    const handleSubmit = useCallback(() => {
      const dueDate = dueDateInputRef.current?.value || "";

      if (action === "Edit" && todoInfo.uuid) {
        doPut(
          editTodoUrl.replace(
            /00000000-0000-0000-0000-000000000000/,
            todoInfo.uuid
          ),
          {
            todo_uuid: todoInfo.uuid,
            name: todoInfo.name || "",
            priority: todoInfo.priority || 2,
            note: todoInfo.note || "",
            tags: JSON.stringify(todoInfo.tags || []),
            url: todoInfo.url || "",
            due_date: dueDate,
          },
          (response) => {
            onEdit?.(response.data.uuid);
            modalRef.current?.hide();
          },
          "Todo edited"
        );
      } else {
        doPost(
          createTodoUrl,
          {
            name: todoInfo.name || "",
            priority: todoInfo.priority || 2,
            note: todoInfo.note || "",
            tags: JSON.stringify(todoInfo.tags || []),
            url: todoInfo.url || "",
            due_date: dueDate,
          },
          (response) => {
            onAdd?.(response.data.uuid);
            modalRef.current?.hide();
          },
          "Todo task created."
        );
      }
    }, [action, todoInfo, editTodoUrl, createTodoUrl, onAdd, onEdit]);

    const handleCancel = useCallback(() => {
      modalRef.current?.hide();
    }, []);

    const handleDelete = useCallback(() => {
      onDelete?.(todoInfo);
      modalRef.current?.hide();
    }, [todoInfo, onDelete]);

    const handleTagsChanged = useCallback((newTags: string[]) => {
      setTodoInfo((prev) => ({ ...prev, tags: newTags }));
    }, []);

    const openModal = useCallback(
      (actionParam: "Edit" | "Create", todoInfoParam?: TodoInfo) => {
        setAction(actionParam);
        if (todoInfoParam) {
          setTodoInfo(todoInfoParam);
        }
        modalRef.current?.show();
        setTimeout(() => {
          const input = document.querySelector(
            "#modalEditTodo input"
          ) as HTMLInputElement;
          input?.focus();
        }, 500);
      },
      []
    );

    const setTags = useCallback((tagList: string[]) => {
      tagsInputRef.current?.setTagList(tagList);
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        openModal,
        setAction,
        setTags,
        get todoInfo() {
          return todoInfo;
        },
        set todoInfo(value: TodoInfo) {
          setTodoInfo(value);
        },
      }),
      [openModal, setTags, todoInfo]
    );

    // Format date for input[type="date"]
    const formatDateForInput = (date: Date | string | null | undefined): string => {
      if (!date) return "";
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0];
    };

    // Sync due date input when todoInfo changes
    useEffect(() => {
      if (dueDateInputRef.current) {
        dueDateInputRef.current.value = formatDateForInput(todoInfo.due_date);
      }
    }, [todoInfo.due_date]);

    // Auto-resize textarea
    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      target.style.height = "";
      target.style.height = target.scrollHeight + 3 + "px";
    };

    return (
      <div
        id="modalEditTodo"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Save Todo Task
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    {/* Name field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="id_name"
                      >
                        Name
                      </label>
                      <div className="col-lg-9">
                        <input
                          id="id_name"
                          type="text"
                          name="name"
                          className="form-control"
                          autoComplete="off"
                          maxLength={200}
                          required
                          value={todoInfo.name || ""}
                          onChange={(e) =>
                            setTodoInfo((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Priority field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="id_priority"
                      >
                        Priority
                      </label>
                      <div className="col-lg-9">
                        <select
                          id="id_priority"
                          name="priority"
                          className="form-control form-select"
                          value={todoInfo.priority || 2}
                          onChange={(e) =>
                            setTodoInfo((prev) => ({
                              ...prev,
                              priority: parseInt(e.target.value, 10),
                            }))
                          }
                        >
                          {priorityList.map((priority) => (
                            <option key={priority[0]} value={priority[0]}>
                              {priority[1]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Note field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="id_note"
                      >
                        Note
                      </label>
                      <div
                        className={`col-lg-9${isDragOver ? " over" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDragOver(false);
                        }}
                        onDrop={handleLinkDrop}
                      >
                        <textarea
                          ref={noteTextareaRef}
                          id="id_note"
                          name="note"
                          cols={40}
                          rows={3}
                          className="form-control"
                          value={todoInfo.note || ""}
                          onChange={(e) =>
                            setTodoInfo((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                          onInput={handleTextareaInput}
                        />
                      </div>
                    </div>

                    {/* Tags field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="inputTags"
                      >
                        Tags
                      </label>
                      <div className="col-lg-9">
                        <TagsInput
                          ref={tagsInputRef}
                          searchUrl={tagSearchUrl}
                          initialTags={todoInfo.tags || []}
                          onTagsChanged={handleTagsChanged}
                        />
                      </div>
                    </div>

                    {/* URL field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="id_url"
                      >
                        Url
                      </label>
                      <div className="col-lg-9">
                        <input
                          id="id_url"
                          type="text"
                          name="url"
                          className="form-control"
                          autoComplete="off"
                          value={todoInfo.url || ""}
                          onChange={(e) =>
                            setTodoInfo((prev) => ({
                              ...prev,
                              url: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Due Date field */}
                    <div className="row mb-3">
                      <label
                        className="fw-bold col-lg-3 col-form-label text-end"
                        htmlFor="id_due_date"
                      >
                        Due Date
                      </label>
                      <div className="col-lg-9">
                        <div className="input-group">
                          <input
                            ref={dueDateInputRef}
                            id="id_due_date"
                            type="date"
                            name="due_date"
                            className="form-control"
                            defaultValue={formatDateForInput(todoInfo.due_date)}
                          />
                          <span className="input-group-text">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="row mb-3">
                      <div className="col-lg-9 offset-lg-3 d-flex">
                        <button
                          type="button"
                          className="btn btn-outline-danger me-auto"
                          onClick={handleDelete}
                        >
                          <FontAwesomeIcon icon={faTrashAlt} /> Delete
                        </button>
                        <div className="d-flex ms-auto">
                          <input
                            className="btn btn-secondary ms-4"
                            type="button"
                            value="Cancel"
                            onClick={handleCancel}
                          />
                          <input
                            className="btn btn-primary ms-2"
                            type="button"
                            value="Save"
                            onClick={handleSubmit}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default TodoEditor;
