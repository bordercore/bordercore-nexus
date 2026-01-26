import React, { useState, useMemo } from "react";
import { Card } from "../common/Card";
import type { WorkoutDataItem } from "./types";

interface AddWorkoutFormProps {
  csrfToken: string;
  initialWeight: string;
  initialReps: string;
  initialDuration: string;
  addWorkoutUrl: string;
  hasWeight: boolean;
  hasDuration: boolean;
}

export function AddWorkoutForm({
  csrfToken,
  initialWeight,
  initialReps,
  initialDuration,
  addWorkoutUrl,
  hasWeight,
  hasDuration,
}: AddWorkoutFormProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [duration, setDuration] = useState(initialDuration);
  const [items, setItems] = useState<WorkoutDataItem[]>([]);
  const [editingCell, setEditingCell] = useState<{ index: number; field: string } | null>(null);
  const [setCount, setSetCount] = useState(0);

  const workoutDataJson = useMemo(() => JSON.stringify(items), [items]);
  const submitIsHidden = items.length === 0;
  const addIsDisabled = Number(weight) === 0 && Number(duration) === 0 && Number(reps) === 0;

  function handleSaveWorkoutData() {
    const newSetCount = setCount + 1;
    setSetCount(newSetCount);
    setItems([
      ...items,
      {
        index: newSetCount,
        weight: weight,
        duration: duration,
        reps: reps,
      },
    ]);
  }

  function editCellHandler(index: number, field: string) {
    setItems(items.map((item) => ({ ...item, isEdit: false })));
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, isEdit: true } : item)));
    setEditingCell({ index, field });
  }

  function onBlur(index: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, isEdit: false } : item)));
    setEditingCell(null);
  }

  function handleCellChange(index: number, field: string, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  return (
    <Card cardClassName="w-50 me-gutter backdrop-filter" title="">
      <div className="card-title text-primary">New Workout Data</div>
      <form id="form-workout" className="form-inline" action={addWorkoutUrl} method="post">
        <input type="hidden" name="workout-data" value={workoutDataJson} />
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
        <div className="d-flex">
          <div className="w-50">
            {hasWeight && (
              <div className="d-flex align-items-center my-2">
                <label className="fitness-col-new-workout-data flex-shrink-0">Weight</label>
                <input
                  className="form-control"
                  type="text"
                  name="weight"
                  size={3}
                  autoComplete="off"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            )}

            {hasDuration && (
              <div className="d-flex align-items-center my-2">
                <label className="fitness-col-new-workout-data flex-shrink-0">Duration</label>
                <input
                  className="form-control"
                  type="text"
                  name="duration"
                  size={3}
                  autoComplete="off"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            )}

            <div className="d-flex align-items-center my-2">
              <label className="fitness-col-new-workout-data flex-shrink-0">Reps</label>
              <input
                className="form-control"
                type="text"
                name="reps"
                size={3}
                autoComplete="off"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
          </div>
          <div className="my-2">
            <input
              className="btn btn-secondary ms-4"
              type="button"
              name="Go"
              value="Add"
              disabled={addIsDisabled}
              onClick={handleSaveWorkoutData}
            />
            <input
              id="btn-submit"
              className={`btn btn-primary ms-3 ${submitIsHidden ? "d-none" : ""}`}
              type="submit"
              name="Go"
              value="Save"
            />
          </div>
        </div>
        <div className="d-flex align-items-center mb-2">
          <label className="fitness-col-new-workout-data flex-shrink-0">Note</label>
          <input className="form-control" type="text" name="note" autoComplete="off" />
        </div>
      </form>
      <div className="row justify-content-center align-items-center">
        <div className="col-lg-12">
          <hr />
          <table className="table w-75 mx-auto">
            <thead>
              <tr>
                {hasWeight && <th className="text-center cursor-pointer ps-4">Weight</th>}
                {hasDuration && <th className="text-center cursor-pointer ps-4">Duration</th>}
                <th className="text-center cursor-pointer ps-4">Reps</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={(hasWeight ? 1 : 0) + (hasDuration ? 1 : 0) + 1} className="text-center">
                    No workout data
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.index}>
                    {hasWeight && (
                      <td className="text-center w-50">
                        {item.isEdit && editingCell?.field === "weight" ? (
                          <input
                            type="number"
                            className="form-control text-center"
                            size={3}
                            value={item.weight}
                            onChange={(e) => handleCellChange(index, "weight", e.target.value)}
                            onBlur={() => onBlur(index)}
                            autoFocus
                          />
                        ) : (
                          <span onClick={() => editCellHandler(index, "weight")}>{item.weight}</span>
                        )}
                      </td>
                    )}
                    {hasDuration && (
                      <td className="text-center w-50">
                        {item.isEdit && editingCell?.field === "duration" ? (
                          <input
                            type="number"
                            className="form-control text-center"
                            size={3}
                            value={item.duration}
                            onChange={(e) => handleCellChange(index, "duration", e.target.value)}
                            onBlur={() => onBlur(index)}
                            autoFocus
                          />
                        ) : (
                          <span onClick={() => editCellHandler(index, "duration")}>{item.duration}</span>
                        )}
                      </td>
                    )}
                    <td className="text-center w-50">
                      {item.isEdit && editingCell?.field === "reps" ? (
                        <input
                          type="number"
                          className="form-control text-center"
                          size={3}
                          value={item.reps}
                          onChange={(e) => handleCellChange(index, "reps", e.target.value)}
                          onBlur={() => onBlur(index)}
                          autoFocus
                        />
                      ) : (
                        <span onClick={() => editCellHandler(index, "reps")}>{item.reps}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

export default AddWorkoutForm;
