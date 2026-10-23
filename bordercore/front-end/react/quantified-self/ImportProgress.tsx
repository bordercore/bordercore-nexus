import React, { useEffect, useRef, useState } from "react";
import type { AxiosProgressEvent } from "axios";
import { api } from "./api";

interface Progress {
  stage: string;
  loaded?: number;
  total?: number;
  processed?: number;
  weight?: number;
  blood_pressure?: number;
  duplicates?: number;
  kind?: string;
}

function progressId() {
  // getRandomValues also works on development hosts served over plain HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useImportProgress(root: string) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const active = useRef<{
    controller: AbortController;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);

  function cancelPolling() {
    if (active.current) {
      clearTimeout(active.current.timer);
      active.current.controller.abort();
      active.current = null;
    }
  }
  useEffect(() => cancelPolling, []);
  useEffect(() => {
    if (started === null) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started]);

  function begin(stage: "uploading" | "checking") {
    cancelPolling();
    const id = progressId();
    const task = {
      controller: new AbortController(),
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    active.current = task;
    setProgress({ stage, loaded: stage === "uploading" ? 0 : undefined });
    setUnavailable(false);
    setStarted(Date.now());
    setElapsed(0);
    async function poll() {
      try {
        const update = await api<Progress>(`${root}imports/progress/${id}/`, "GET", undefined, {
          signal: task.controller.signal,
        });
        if (active.current !== task) return;
        setUnavailable(update.stage === "unavailable");
        // The original POST determines success/failure. A cache miss can mean
        // the browser is still uploading, so don't overwrite upload progress.
        if (!["waiting", "unavailable", "complete", "error"].includes(update.stage))
          setProgress(update);
      } catch {
        if (active.current === task) setUnavailable(true);
      }
      if (active.current === task) task.timer = setTimeout(poll, 750);
    }
    task.timer = setTimeout(poll, 750);
    return id;
  }

  function uploaded(event: AxiosProgressEvent) {
    if (!active.current) return;
    setProgress(current => {
      if (current?.stage !== "uploading") return current;
      if (event.total && event.loaded >= event.total) return { stage: "processing" };
      return { stage: "uploading", loaded: event.loaded, total: event.total };
    });
  }
  function finish() {
    cancelPolling();
    setStarted(null);
    setProgress(null);
  }
  return { progress, elapsed, unavailable, begin, uploaded, finish };
}

export default function ImportProgress({
  progress,
  elapsed,
  unavailable,
}: {
  progress: Progress;
  elapsed: number;
  unavailable: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);
  const titles: Record<string, string> = {
    uploading: "Uploading ZIP",
    processing: "Opening Apple Health export",
    scanning: "Scanning health records",
    pairing: "Pairing blood-pressure readings",
    checking: "Checking for existing readings",
    validating: "Validating readings",
    saving: `Saving ${progress.kind === "weight" ? "weight" : "blood-pressure"} readings`,
    finalizing: "Finalizing import",
  };
  const completed =
    progress.stage === "uploading" || progress.stage === "scanning"
      ? progress.loaded
      : progress.stage === "saving" || progress.stage === "validating"
        ? progress.processed
        : undefined;
  const percent =
    completed !== undefined && progress.total
      ? Math.min(100, Math.floor((completed / progress.total) * 100))
      : undefined;
  const title = titles[progress.stage] || "Processing Apple Health data";
  const duration = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;
  return (
    <div
      ref={panel}
      className="qs-import-progress"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="qs-section-head">
        <strong>
          {title}
          {percent !== undefined ? ` · ${percent}%` : "…"}
        </strong>
        <span className="qs-muted">{duration} elapsed</span>
      </div>
      <progress max={100} value={percent} aria-label={title} />
      {(progress.stage === "uploading" || progress.stage === "scanning") &&
        progress.loaded !== undefined && (
          <p>
            {(progress.loaded / 1024 / 1024).toFixed(1)} MB
            {progress.total ? ` of ${(progress.total / 1024 / 1024).toFixed(1)} MB` : ""}
            {progress.stage === "scanning" ? " scanned" : " uploaded"}
          </p>
        )}
      {progress.weight !== undefined && (
        <p>
          {progress.weight.toLocaleString()} weight readings ·{" "}
          {(progress.blood_pressure ?? 0).toLocaleString()} blood-pressure pairs found
          {progress.duplicates !== undefined
            ? ` · ${progress.duplicates.toLocaleString()} repeated entries detected`
            : ""}
        </p>
      )}
      {(progress.stage === "saving" || progress.stage === "validating") && (
        <p>
          {(progress.processed ?? 0).toLocaleString()} of {(progress.total ?? 0).toLocaleString()}{" "}
          readings
        </p>
      )}
      <p className="qs-muted">
        {unavailable
          ? "Live progress is temporarily unavailable. The request is still running. "
          : ""}
        Please keep this page open.
        {progress.stage === "saving" || progress.stage === "finalizing"
          ? " Changes are confirmed only when the import finishes."
          : ""}
      </p>
    </div>
  );
}
