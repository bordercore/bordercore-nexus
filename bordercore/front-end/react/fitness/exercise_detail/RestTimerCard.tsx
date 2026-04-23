import React, { useEffect, useRef, useState } from "react";
import { doPost } from "../../utils/reactUtils";

interface RestTimerCardProps {
  exerciseUuid: string;
  defaultMinutes: number;
  updateRestPeriodUrl: string;
}

type TimerState = "idle" | "running" | "paused" | "done";

const RADIUS = 78;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(remaining: number): string {
  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

export function RestTimerCard({
  exerciseUuid,
  defaultMinutes,
  updateRestPeriodUrl,
}: RestTimerCardProps) {
  const [minutes, setMinutes] = useState<number>(Math.max(1, Math.round(defaultMinutes)));
  const [target, setTarget] = useState<number>(Math.max(15, Math.round(defaultMinutes * 60)));
  const [remaining, setRemaining] = useState<number>(Math.max(15, Math.round(defaultMinutes * 60)));
  const [state, setState] = useState<TimerState>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restart the ticker whenever we enter the "running" state.
  useEffect(() => {
    if (state !== "running") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setState("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state]);

  function handleStart() {
    if (state === "done" || remaining === 0) {
      setRemaining(target);
    }
    setState("running");
  }

  function handlePause() {
    setState("paused");
  }

  function handleReset() {
    setRemaining(target);
    setState("idle");
  }

  function commitMinutes(nextMinutes: number) {
    const clamped = Math.max(1, Math.min(15, nextMinutes));
    setMinutes(clamped);
    const secs = clamped * 60;
    setTarget(secs);
    if (state !== "running") {
      setRemaining(secs);
    }
    doPost(
      updateRestPeriodUrl,
      { uuid: exerciseUuid, rest_period: String(clamped) },
      () => {},
      "rest period saved"
    );
  }

  const progress = target > 0 ? remaining / target : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const stateLabel: Record<TimerState, string> = {
    idle: "idle",
    running: "resting",
    paused: "paused",
    done: "ready",
  };

  return (
    <div className="ex-card">
      <h3>
        <span>rest timer</span>
        <span className="ex-card-hint">between sets</span>
      </h3>
      <div
        className={`ex-timer-ring ${state === "running" ? "running" : ""} ${state === "done" ? "done" : ""}`}
      >
        <svg viewBox="0 0 170 170">
          <defs>
            <linearGradient id="ex-timer-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b36bff" />
              <stop offset="50%" stopColor="#7c7fff" />
              <stop offset="100%" stopColor="#4cc2ff" />
            </linearGradient>
          </defs>
          <circle className="track" cx="85" cy="85" r={RADIUS} />
          <circle
            className="prog"
            cx="85"
            cy="85"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="center">
          <div className="time">{formatTime(remaining)}</div>
          <div className="label">{stateLabel[state]}</div>
        </div>
      </div>
      <div className="ex-timer-actions">
        {state !== "running" ? (
          <button className="ex-btn primary" onClick={handleStart}>
            <span className="icon">▶</span>
            {remaining < target && state !== "done" ? "resume" : "start"}
          </button>
        ) : (
          <button className="ex-btn" onClick={handlePause}>
            <span className="icon">❚❚</span> pause
          </button>
        )}
        <button className="ex-btn ghost" onClick={handleReset}>
          reset
        </button>
      </div>
      <div className="ex-timer-set">
        <span>minutes</span>
        <input
          type="number"
          min={1}
          max={15}
          value={minutes}
          onChange={e => {
            const next = parseInt(e.target.value, 10);
            if (!Number.isNaN(next)) {
              commitMinutes(next);
            }
          }}
        />
        <div className="stepper">
          <button type="button" onClick={() => commitMinutes(minutes - 1)} aria-label="decrease">
            −
          </button>
          <button type="button" onClick={() => commitMinutes(minutes + 1)} aria-label="increase">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
