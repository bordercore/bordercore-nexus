import React, { useCallback, useEffect, useState } from "react";
import Select from "../prefs/components/Select";

interface Lesson {
  id: string;
  question_uuid: string;
  title: string;
  summary: string;
  created_at: string;
  provider: string;
  model: string;
}
interface Accuracy {
  status: "accurate" | "issues" | "uncertain";
  explanation: string;
  question: string | null;
  answer: string | null;
}
interface Detail extends Lesson {
  accuracy: Accuracy | null;
  correction_applied: boolean;
  source: { question: string; answer: string };
  can_regenerate: boolean;
  source_changed: boolean;
  html_url: string;
}
interface Config {
  settings: { provider: string; model: string; style: string };
  enabled: boolean;
  providers: Record<string, { label: string; configured: boolean }>;
}
interface Job {
  id: string;
  question_uuid: string;
  status: string;
  message: string;
  lesson_id: string | null;
}
interface Library {
  lessons: Lesson[];
  count: number;
  has_next: boolean;
}
class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

interface Props {
  api: string;
  prefsUrl: string;
  storageKey: string;
}

export default function LumenPage({ api, prefsUrl, storageKey }: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [catalogWarning, setCatalogWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [uuid, setUuid] = useState(new URLSearchParams(location.search).get("question") || "");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [library, setLibrary] = useState<Library>({ lessons: [], count: 0, has_next: false });
  const [selectedId, setSelectedId] = useState(location.hash.slice(1));
  const [lesson, setLesson] = useState<Detail | null>(null);
  const [versions, setVersions] = useState<Lesson[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobIds, setJobIds] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const [refresh, setRefresh] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accuracyBusy, setAccuracyBusy] = useState(false);

  const request = useCallback(
    async <T,>(path: string, body?: unknown, method = "POST"): Promise<T> => {
      const csrf =
        document.cookie
          .split("; ")
          .find(c => c.startsWith("csrftoken="))
          ?.split("=")[1] || "";
      const response = await fetch(api + path, {
        credentials: "same-origin",
        ...(body === undefined
          ? {}
          : {
              method,
              body: JSON.stringify(body),
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": decodeURIComponent(csrf),
              },
            }),
      });
      const data = await response.json().catch(() => ({
        detail: "Unable to read the response. Check your connection or sign in again.",
      }));
      if (!response.ok)
        throw new RequestError(data.detail || "The request failed.", response.status);
      return data as T;
    },
    [api]
  );

  useEffect(() => {
    const route = () => setSelectedId(location.hash.slice(1));
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);

  useEffect(() => {
    let alive = true;
    request<Config>("preferences/")
      .then(value => {
        if (!alive) return;
        setConfig(value);
        setProvider(value.settings.provider);
        setModel(value.settings.model);
      })
      .catch(e => {
        if (alive) setNotice(e.message);
      });
    request<{ jobs: Job[] }>("jobs/")
      .then(value => {
        if (!alive) return;
        setJobIds(ids => [...new Set([...ids, ...value.jobs.map(j => j.id)])]);
      })
      .catch(e => {
        if (alive) setNotice(e.message);
      });
    const question = new URLSearchParams(location.search).get("question");
    if (question && !location.hash) {
      request<{ versions: Lesson[] }>(`questions/${encodeURIComponent(question)}/versions/`)
        .then(value => {
          if (alive && !location.hash && value.versions[0]) location.hash = value.versions[0].id;
        })
        .catch(e => {
          if (alive) setNotice(e.message);
        });
    }
    return () => {
      alive = false;
    };
  }, [request, storageKey]);

  // A theme saved in Bordercore Preferences updates an already-open reader too.
  useEffect(() => {
    let alive = true;
    const refreshPreferences = () =>
      request<Config>("preferences/")
        .then(value => {
          if (alive) setConfig(value);
        })
        .catch(() => {
          /* Retry on focus or next tick. */
        });
    const timer = window.setInterval(refreshPreferences, 5000);
    window.addEventListener("focus", refreshPreferences);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshPreferences);
    };
  }, [request]);

  useEffect(() => {
    let alive = true;
    setModels([]);
    setCatalogWarning("");
    request<{ models: { id: string; name: string }[]; warning?: string }>(`models/${provider}/`)
      .then(value => {
        if (alive) {
          setModels(value.models);
          setCatalogWarning(value.warning || "");
        }
      })
      .catch(e => {
        if (alive) setCatalogWarning(e.message);
      });
    return () => {
      alive = false;
    };
  }, [provider, request]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      request<Library>(`lessons/?q=${encodeURIComponent(query)}&page=${page}`)
        .then(value => {
          if (alive) setLibrary(value);
        })
        .catch(e => {
          if (alive) setNotice(e.message);
        });
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, page, refresh, request]);

  useEffect(() => {
    let alive = true;
    setLesson(null);
    setVersions([]);
    if (selectedId)
      request<Detail>(`lessons/${encodeURIComponent(selectedId)}/`)
        .then(async value => {
          if (!alive) return;
          setLesson(value);
          const result = await request<{ versions: Lesson[] }>(
            `questions/${value.question_uuid}/versions/`
          );
          if (alive) setVersions(result.versions);
        })
        .catch(e => {
          if (alive) setNotice(e.message);
        });
    return () => {
      alive = false;
    };
  }, [selectedId, request, refresh]);

  useEffect(() => {
    let alive = true;
    let timer: number;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(jobIds));
    } catch {
      /* server also tracks active jobs */
    }
    if (!jobIds.length) {
      setJobs([]);
      return;
    }
    const poll = async () => {
      try {
        const responses = await Promise.all(
          jobIds.map(async id => {
            try {
              return await request<Job>(`jobs/${encodeURIComponent(id)}/`);
            } catch (error) {
              if (error instanceof RequestError && error.status === 404) {
                return {
                  id,
                  question_uuid: "",
                  status: "error",
                  message: "A saved generation job is no longer available.",
                  lesson_id: null,
                };
              }
              throw error;
            }
          })
        );
        if (!alive) return;
        const result = responses;
        setJobs(result);
        const finished = result.filter(j => ["complete", "error"].includes(j.status));
        if (finished.length) {
          const completed = finished.find(j => j.lesson_id);
          if (completed?.lesson_id) {
            location.hash = completed.lesson_id;
            setRefresh(n => n + 1);
          }
          const failed = finished.find(j => j.status === "error");
          if (failed) setNotice(failed.message);
          setJobIds(ids => ids.filter(id => !finished.some(j => j.id === id)));
          return;
        }
      } catch (e) {
        if (alive)
          setNotice(e instanceof Error ? e.message : "Unable to check generation progress.");
      }
      if (alive) timer = window.setTimeout(poll, 2500);
    };
    void poll();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [jobIds, request, storageKey]);

  const generate = async (question: string) => {
    setSubmitting(true);
    setNotice("");
    try {
      const value = await request<{ job_id: string }>("generate/", { uuid: question });
      setJobIds(ids => [...new Set([...ids, value.job_id])]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to start generation.");
    } finally {
      setSubmitting(false);
    }
  };
  const saveProvider = async () => {
    setSaving(true);
    setNotice("");
    try {
      setConfig(await request<Config>("preferences/", { provider, model }, "PUT"));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  };
  const handleAccuracy = async (apply: boolean) => {
    if (!lesson || accuracyBusy) return;
    const id = lesson.id;
    setAccuracyBusy(true);
    setNotice("");
    try {
      if (apply) {
        await request(`lessons/${id}/correct-source/`, {});
        setNotice("Original question and answer corrected.");
        setRefresh(n => n + 1);
      } else {
        const result = await request<{ job_id: string }>(`lessons/${id}/check-accuracy/`, {});
        setJobIds(ids => [...new Set([...ids, result.job_id])]);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to update the accuracy check.");
      if (e instanceof RequestError && e.status === 409) setRefresh(n => n + 1);
    } finally {
      setAccuracyBusy(false);
    }
  };
  const ready = Boolean(config?.enabled && config.providers[config.settings.provider]?.configured);
  const preferencesDirty =
    config && (provider !== config.settings.provider || model !== config.settings.model);
  const busy = submitting || jobIds.length > 0;

  return (
    <main className="lumen-app">
      <header className="lumen-header">
        <div>
          <span className="lumen-eyebrow">A small question. A whole new perspective.</span>
          <h1>Lumen</h1>
          <p>Interactive lessons from your drill questions.</p>
        </div>
        <a href={prefsUrl} target="_blank" rel="noopener noreferrer">
          Lesson theme ↗
        </a>
      </header>
      {notice && (
        <div className="lumen-notice" role="alert">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}
      {!config?.enabled && config && (
        <p>Generation is currently disabled. Your saved lessons remain available.</p>
      )}
      <details className="lumen-settings">
        <summary>
          Generation settings · {config?.settings.provider} / {config?.settings.model}
        </summary>
        <div className="lumen-controls">
          <label>
            Provider
            <Select
              value={provider}
              onChange={value => {
                setProvider(value);
                setModel("");
                setCustomModel(false);
              }}
              options={Object.entries(config?.providers || {}).map(([value, item]) => ({
                value,
                label: item.label + (item.configured ? "" : " (key not configured)"),
              }))}
            />
          </label>
          <label>
            Model
            <Select
              value={customModel ? "__custom__" : model}
              placeholder="Select a model"
              onChange={value => {
                const custom = value === "__custom__";
                setCustomModel(custom);
                if (!custom) setModel(value);
              }}
              options={[
                ...(model && !models.some(m => m.id === model)
                  ? [{ value: model, label: model }]
                  : []),
                ...models.map(m => ({
                  value: m.id,
                  label: m.name === m.id ? m.id : `${m.name} (${m.id})`,
                })),
                { value: "__custom__", label: "Custom model ID…" },
              ]}
            />
          </label>
          {customModel && (
            <label>
              Custom model ID
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Enter a model ID"
              />
            </label>
          )}
          <button disabled={saving || !model || !preferencesDirty} onClick={saveProvider}>
            {saving ? "Saving…" : "Save generation settings"}
          </button>
        </div>
        {catalogWarning && <p>{catalogWarning}</p>}
        <p>
          Creating a lesson sends its question and answer to the selected provider and uses its paid
          API.
        </p>
      </details>
      {jobs.map(job => (
        <p className="lumen-progress" role="status" key={job.id}>
          {job.message} <small>{job.question_uuid}</small>
        </p>
      ))}
      {selectedId ? (
        <>
          <a href="#">← Lesson library</a>
          {!lesson ? (
            <p role="status">Loading lesson…</p>
          ) : (
            <article>
              <h2>{lesson.title}</h2>
              <p>{lesson.summary}</p>
              <label htmlFor="lumen-version">Version</label>
              <div className="lumen-controls lumen-reader-controls">
                <Select
                  id="lumen-version"
                  value={lesson.id}
                  onChange={value => {
                    location.hash = value;
                  }}
                  options={versions.map((v, i) => ({
                    value: v.id,
                    label: `v${versions.length - i} · ${new Date(v.created_at).toLocaleString()} · ${v.model}`,
                  }))}
                />
                <a href={`${lesson.html_url}?download=1`}>Download HTML ↓</a>
                <button
                  disabled={!ready || busy || !lesson.can_regenerate || Boolean(preferencesDirty)}
                  onClick={() => generate(lesson.question_uuid)}
                >
                  Regenerate
                </button>
              </div>
              {lesson.source_changed && (
                <p className="lumen-notice">
                  This lesson uses an earlier question or answer. Regenerate to use the current
                  source.
                </p>
              )}
              {!lesson.can_regenerate && (
                <p>The original question is no longer available. This saved lesson is preserved.</p>
              )}
              <details className="lumen-source">
                <summary>Original question and answer</summary>
                <h3>Question</h3>
                <p>{lesson.source.question}</p>
                <h3>Answer</h3>
                <p>{lesson.source.answer}</p>
                <small>{lesson.question_uuid}</small>
              </details>
              <section className="lumen-accuracy" aria-labelledby="lumen-accuracy-title">
                <h3 id="lumen-accuracy-title">Accuracy check</h3>
                <p className="lumen-footnote">
                  Model assessment of the original question and answer.
                </p>
                {lesson.accuracy ? (
                  <>
                    <p>
                      <strong>
                        {lesson.accuracy.status === "issues"
                          ? "Accuracy issue found"
                          : lesson.accuracy.status === "accurate"
                            ? "No accuracy issues found"
                            : "Accuracy is uncertain"}
                      </strong>
                    </p>
                    <p>{lesson.accuracy.explanation}</p>
                    {lesson.accuracy.status === "issues" && (
                      <>
                        <h4>Corrected question</h4>
                        <p className="lumen-correction-text">{lesson.accuracy.question}</p>
                        <h4>Corrected answer</h4>
                        <p className="lumen-correction-text">{lesson.accuracy.answer}</p>
                        {lesson.correction_applied ? (
                          <p role="status">Correction applied to the original drill.</p>
                        ) : (
                          <>
                            <button
                              disabled={
                                accuracyBusy || !lesson.can_regenerate || lesson.source_changed
                              }
                              onClick={() => handleAccuracy(true)}
                            >
                              {accuracyBusy
                                ? "Applying correction…"
                                : "Correct original question and answer"}
                            </button>
                            {lesson.source_changed && (
                              <p>
                                The original drill has changed. Regenerate the lesson before
                                applying this correction.
                              </p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      This older lesson has no saved accuracy assessment. Check its source to
                      prepare a correction.
                    </p>
                    <button
                      disabled={
                        !ready ||
                        busy ||
                        accuracyBusy ||
                        !lesson.can_regenerate ||
                        lesson.source_changed ||
                        Boolean(preferencesDirty)
                      }
                      onClick={() => handleAccuracy(false)}
                    >
                      {accuracyBusy || busy ? "Checking accuracy…" : "Check accuracy"}
                    </button>
                    <p className="lumen-footnote">
                      Uses the selected provider's paid API. Your drill changes only when you apply
                      a proposed correction.
                    </p>
                  </>
                )}
              </section>
              <iframe
                key={`${lesson.id}:${config?.settings.style}`}
                src={lesson.html_url}
                title="Interactive lesson"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
              />
              <p className="lumen-footnote">
                AI-generated teaching material · Regeneration preserves every earlier version.
              </p>
            </article>
          )}
        </>
      ) : (
        <>
          <form
            className="lumen-create"
            onSubmit={e => {
              e.preventDefault();
              void generate(uuid);
            }}
          >
            <label htmlFor="lumen-uuid">Drill question UUID</label>
            <div className="lumen-controls">
              <input
                id="lumen-uuid"
                value={uuid}
                onChange={e => setUuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
                pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
              />
              <button disabled={!ready || busy || Boolean(preferencesDirty)}>
                Create lesson ↗
              </button>
            </div>
            {preferencesDirty && <p>Save your generation settings before creating a lesson.</p>}
            {config?.enabled && !ready && (
              <p>Choose a provider with a configured server API key in Generation settings.</p>
            )}
          </form>
          <div className="lumen-library-heading">
            <h2>
              Your library <small>{library.count}</small>
            </h2>
            <input
              type="search"
              aria-label="Search lessons"
              placeholder="Search title, concept, or UUID"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="lumen-grid">
            {library.lessons.map((item, i) => (
              <a className="lumen-card" href={`#${item.id}`} key={item.id}>
                <span className="lumen-eyebrow">
                  LESSON {String((page - 1) * 24 + i + 1).padStart(2, "0")} / ✧
                </span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <small>{new Date(item.created_at).toLocaleDateString()} · Explore ↗</small>
              </a>
            ))}
          </div>
          {!library.lessons.length && (
            <p className="lumen-empty">
              {query
                ? "No matching lessons."
                : "Paste a drill-question UUID to create your first interactive lesson."}
            </p>
          )}
          <nav className="lumen-controls" aria-label="Library pages">
            <button disabled={page === 1} onClick={() => setPage(n => n - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button disabled={!library.has_next} onClick={() => setPage(n => n + 1)}>
              Next
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
