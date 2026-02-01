import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faList, faCalendarAlt, faTrashAlt, faCheck } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

interface Task {
  uuid: string;
  name: string;
  tags: string[];
}

interface OverdueTasksProps {
  taskListInitial: Task[];
  rescheduleTaskUrl: string;
  deleteTodoUrl: string;
}

export function OverdueTasks({
  taskListInitial,
  rescheduleTaskUrl,
  deleteTodoUrl,
}: OverdueTasksProps) {
  const [taskList, setTaskList] = useState<Task[]>(taskListInitial);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTaskList(taskListInitial);
  }, [taskListInitial]);

  useEffect(() => {
    const modalElement = document.getElementById("modalOverdueTasks");
    if (modalElement) {
      const handleHidden = () => {
        setMessage("");
      };
      modalElement.addEventListener("hidden.bs.modal", handleHidden);
      return () => {
        modalElement.removeEventListener("hidden.bs.modal", handleHidden);
      };
    }
  }, []);

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

  const removeTaskFromList = (uuid: string) => {
    setTaskList(prev => prev.filter(task => task.uuid !== uuid));
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

  return (
    <div
      id="modalOverdueTasks"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 id="myModalLabel" className="modal-title">
              Overdue Tasks
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
              {taskList.map(task => (
                <div key={task.uuid} className="hoverable row m-2">
                  <div className="col-lg-9 d-flex my-2">
                    <div>
                      <FontAwesomeIcon icon={faList} className="text-secondary me-3" />
                    </div>
                    <div>
                      {task.name}
                      {task.tags.map(tag => (
                        <span key={tag} className="tag ms-2">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="col-lg-3 my-2 d-flex justify-content-center">
                    <a
                      className="glow"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        rescheduleTask(task.uuid);
                      }}
                    >
                      <FontAwesomeIcon
                        icon={faCalendarAlt}
                        className="text-secondary me-3"
                        data-bs-toggle="tooltip"
                        title="Reschedule Task"
                      />
                    </a>
                    <a
                      className="glow"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        handleTaskDelete(task.uuid);
                      }}
                    >
                      <FontAwesomeIcon
                        icon={faTrashAlt}
                        className="text-secondary ms-3"
                        data-bs-toggle="tooltip"
                        title="Delete Task"
                      />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {taskList.length !== 0 && (
              <div className="row">
                <div className="col-lg-12">
                  <hr />
                </div>
              </div>
            )}
            <div className="row m-2">
              <div className="col-lg-9 d-flex align-items-center text-success">
                {taskList.length === 0 ? (
                  <h4>
                    <FontAwesomeIcon icon={faCheck} className="text-success me-3" />
                    <span className="ms-3">All tasks done!</span>
                  </h4>
                ) : (
                  <div>{message}</div>
                )}
              </div>
              <div className="col-lg-3">
                <div className="ms-auto">
                  <button type="button" className="btn btn-primary" data-bs-dismiss="modal">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverdueTasks;
