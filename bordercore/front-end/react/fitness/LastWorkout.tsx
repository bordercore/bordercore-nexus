import React, { useRef, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilAlt, faTrashAlt, faComment } from "@fortawesome/free-solid-svg-icons";
import Chart from "chart.js/auto";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doPost, EventBus } from "../utils/reactUtils";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt();

interface LastWorkoutProps {
  date: string;
  description: string;
  exerciseUuid: string;
  initialNote: string;
  duration: number[];
  weight: number[];
  reps: number[];
  interval: number;
  editNoteUrl: string;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export function LastWorkout({
  date,
  description,
  exerciseUuid,
  initialNote,
  duration,
  weight,
  reps,
  interval,
  editNoteUrl,
}: LastWorkoutProps) {
  const [note, setNote] = useState(initialNote);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteCache, setNoteCache] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  const weightChartRef = useRef<HTMLCanvasElement>(null);
  const durationChartRef = useRef<HTMLCanvasElement>(null);
  const repsChartRef = useRef<HTMLCanvasElement>(null);

  const sets = Array.from({ length: weight.length }, (_, i) => i + 1);
  const labels = sets.map((x) => `Set ${x}`);

  function getGraphOptions(label: string) {
    const styles = getComputedStyle(document.body);

    return {
      events: [] as const,
      elements: {
        bar: {
          borderRadius: 10,
        },
      },
      animation: {
        onComplete: function (this: Chart, chartInstance: { chart: Chart }) {
          const ctx = this.ctx;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = styles.getPropertyValue("--chart-fill-color");
          ctx.font = "bold 24px Arial";
          this.data.datasets.forEach(function (dataset, i) {
            const meta = chartInstance.chart.getDatasetMeta(i);
            meta.data.forEach(function (bar, index) {
              const data = dataset.data[index] as number;
              ctx.fillText(String(data), bar.x, bar.y + 40);
            });
          });
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: label,
          color: styles.getPropertyValue("--chart-title-color"),
          font: { size: 16 },
        },
      },
      scales: {
        x: { ticks: { color: styles.getPropertyValue("--chart-tick-color") } },
        y: { ticks: { color: styles.getPropertyValue("--chart-tick-color") } },
      },
    };
  }

  function createChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, data: number[], label: string) {
    if (!canvasRef.current) return;
    const styles = getComputedStyle(document.body);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            backgroundColor: styles.getPropertyValue("--chart-bg"),
            data: data,
            label: label,
          },
        ],
      },
      options: getGraphOptions(label) as any,
    });
  }

  function handleNoteAdd() {
    setNoteCache(note);
    setIsEditingNote(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleNoteDelete() {
    setNote("");
    doPost(editNoteUrl, { uuid: exerciseUuid, note: "" }, () => {});
  }

  function handleNoteBlur() {
    setIsEditingNote(false);
    if (noteCache === note) return;
    doPost(editNoteUrl, { uuid: exerciseUuid, note: note }, () => {});
  }

  function handleAskChatbot() {
    EventBus.$emit("chat", { exerciseUuid: exerciseUuid });
  }

  useEffect(() => {
    if (weight[0] > 0) createChart(weightChartRef, weight, "Weight");
    if (duration[0] > 0) createChart(durationChartRef, duration, "Duration");
    createChart(repsChartRef, reps, "Reps");

    if (initialNote && descriptionRef.current) {
      descriptionRef.current.classList.add("animate__animated", "animate__wobble", "animate__delay-1s");
    }
  }, []);

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleNoteAdd(); }}>
          <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" />
          {note ? "Edit" : "Add"} note
        </a>
      </li>
      {note && (
        <li>
          <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleNoteDelete(); }}>
            <FontAwesomeIcon icon={faTrashAlt} className="text-primary me-3" />
            Delete note
          </a>
        </li>
      )}
      <li>
        <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleAskChatbot(); }}>
          <FontAwesomeIcon icon={faComment} className="text-primary me-3" />
          Ask AI
        </a>
      </li>
    </ul>
  );

  // Note: description and note content come from authenticated user's own input
  // stored in the database, matching the Vue implementation's v-html usage
  return (
    <div className="d-flex flex-column h-100">
      <Card cardClassName="flex-grow-0 backdrop-filter mb-gutter" title="">
        <div className="card-title text-primary">Last Workout</div>
        <div className="mb-4">
          {date ? (
            <div>
              <strong>
                {date} - {interval} {pluralize("day", interval)} ago
              </strong>
            </div>
          ) : (
            <div>No previous workout found.</div>
          )}
          {weight[0] > 0 && <canvas ref={weightChartRef} id="last_workout_weights" className="mt-3" />}
          {duration[0] > 0 && <canvas ref={durationChartRef} id="last_workout_duration" className="mt-3" />}
          <canvas ref={repsChartRef} id="last_workout_reps" className="mt-3" />
        </div>
      </Card>

      <div className="hover-target h-100 mb-3">
        <Card
          cardClassName="z-index-positive position-relative h-100 backdrop-filter"
          title=""
        >
          <div className="d-flex flex-column" ref={descriptionRef} id="description">
            <div className="d-flex flex-column">
              <div className="d-flex">
                <div className="card-title text-primary">Description</div>
                <div className="ms-auto">
                  <DropDownMenu showOnHover={true} dropdownSlot={dropdownContent} />
                </div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: md.render(description || "No description") }} />
            </div>

            {description && note && <hr className="m-2" />}

            {(note || isEditingNote) && (
              <div className="editable-textarea position-relative">
                {isEditingNote && <div className="card-title text-primary mt-3">Note</div>}
                {isEditingNote ? (
                  <textarea
                    ref={textareaRef}
                    className="px-3 w-100"
                    placeholder="Note text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={handleNoteBlur}
                    rows={10}
                  />
                ) : (
                  <label
                    className="w-100 text-break"
                    data-bs-toggle="tooltip"
                    data-placement="bottom"
                    title="Doubleclick to edit note"
                    onDoubleClick={handleNoteAdd}
                    dangerouslySetInnerHTML={{ __html: md.render(note) }}
                  />
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default LastWorkout;
