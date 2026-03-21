import React, { useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Modal } from "bootstrap";
import { doPost } from "../utils/reactUtils";

interface CreatedHabit {
  uuid: string;
  name: string;
  purpose: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tags: string[];
  total_logs: number;
  completed_logs: number;
  completed_today: boolean;
}

export interface CreateHabitModalHandle {
  openModal: () => void;
}

interface CreateHabitModalProps {
  createUrl: string;
  onCreated: (habit: CreatedHabit) => void;
}

export const CreateHabitModal = forwardRef<CreateHabitModalHandle, CreateHabitModalProps>(
  function CreateHabitModal({ createUrl, onCreated }, ref) {
    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstanceRef = useRef<Modal | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState("");
    const [purpose, setPurpose] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

    useImperativeHandle(ref, () => ({
      openModal: () => {
        setName("");
        setPurpose("");
        setStartDate(new Date().toISOString().split("T")[0]);
        if (modalRef.current) {
          modalInstanceRef.current = new Modal(modalRef.current);
          modalInstanceRef.current.show();
          setTimeout(() => nameInputRef.current?.focus(), 500);
        }
      },
    }));

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!name.trim()) return;

      doPost(
        createUrl,
        { name: name.trim(), purpose: purpose.trim(), start_date: startDate },
        response => {
          modalInstanceRef.current?.hide();
          onCreated(response.data.habit);
        },
        "Habit created"
      );
    }

    return (
      <div
        ref={modalRef}
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="createHabitModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h4 className="modal-title" id="createHabitModalLabel">
                  New Habit
                </h4>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Purpose</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="Why are you tracking this habit?"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <a href="#" data-bs-dismiss="modal">
                  Cancel
                </a>
                <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
);

export default CreateHabitModal;
