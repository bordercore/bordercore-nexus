import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faList,
  faCalendarAlt,
  faTrashAlt,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { tagStyle } from "../utils/tagColors";

interface Task {
  uuid: string;
  name: string;
  tags: string[];
}

interface OverdueTasksProps {
  open: boolean;
  onClose: () => void;
  taskListInitial: Task[];
  rescheduleTaskUrl: string;
  deleteTodoUrl: string;
}

export function OverdueTasks({
  open,
  onClose,
  taskListInitial,
  rescheduleTaskUrl,
  deleteTodoUrl,
}: OverdueTasksProps) {
  const [taskList, setTaskList] = useState<Task[]>(taskListInitial);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTaskList(taskListInitial);
  }, [taskListInitial]);

  // Clear status message every time the modal opens.
  useEffect(() => {
    if (open) setMessage("");
  }, [open]);

  // Escape-to-close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const removeTaskFromList = (uuid: string) => {
    setTaskList(prev => prev.filter(task => task.uuid !== uuid));
  };

  const handleTaskDelete = (uuid: string) => {
    axios
      .delete(deleteTodoUrl.replace("00000000-0000-0000-0000-000000000000", uuid))
      .then(() => {
        setMessage("Task deleted.");
        removeTaskFromList(uuid);
      })
      .catch(error => {
        console.log(error);
        setMessage("Error deleting task. Please try again.");
      });
  };

  const rescheduleTask = (uuid: string) => {
    const formData = new URLSearchParams();
    formData.append("todo_uuid", uuid);

    axios
      .post(rescheduleTaskUrl, formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .then(() => {
        setMessage("Task rescheduled.");
        removeTaskFromList(uuid);
      })
      .catch(error => {
        console.log(error);
        setMessage("Error rescheduling task. Please try again.");
      });
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label="overdue tasks">
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">Overdue tasks</h2>

        <div className="refined-overdue-list">
          {taskList.map(task => (
            <div key={task.uuid} className="refined-overdue-item">
              <div className="refined-overdue-name">
                <FontAwesomeIcon icon={faList} className="refined-overdue-icon" />
                <span>
                  {task.name}
                  {task.tags.map(tag => (
                    <span
                      key={tag}
                      className="tag ms-2"
                      style={tagStyle(tag)} // must remain inline
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
              <div className="refined-overdue-actions">
                <button
                  type="button"
                  className="refined-overdue-action"
                  onClick={() => rescheduleTask(task.uuid)}
                  title="Reschedule task"
                  aria-label="reschedule task"
                >
                  <FontAwesomeIcon icon={faCalendarAlt} />
                </button>
                <button
                  type="button"
                  className="refined-overdue-action"
                  onClick={() => handleTaskDelete(task.uuid)}
                  title="Delete task"
                  aria-label="delete task"
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="refined-overdue-status">
          {taskList.length === 0 ? (
            <div className="refined-overdue-empty">
              <FontAwesomeIcon icon={faCheck} />
              <span>All tasks done!</span>
            </div>
          ) : (
            <div className="refined-overdue-message">{message}</div>
          )}
        </div>

        <div className="refined-modal-actions compact">
          <button type="button" className="refined-btn primary" onClick={onClose}>
            dismiss
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default OverdueTasks;
