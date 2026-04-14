"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CreateTaskInput, Task } from "@todobile/contracts";

import {
  captureVoice,
  captureText,
  createTask,
  getMe,
  getTasks,
  updateTask,
  type CaptureDebugInfo
} from "@/lib/client/api";
import {
  getAccessToken,
  signInWithEmailPassword,
  signOut,
  subscribeToAuthStateChanges
} from "@/lib/client/auth";
import { subscribeToTaskChanges } from "@/lib/client/realtime";

type ViewKey = "today" | "backlog" | "upcoming" | "archived";

function prettyStatus(task: Task) {
  if (task.status === "completed") return "Completed";
  if (task.status === "deleted") return "Deleted";
  if (task.deadlineDate) return `Due ${task.deadlineDate}`;
  if (task.scheduledDate) return `Scheduled ${task.scheduledDate}`;
  return "Open";
}

export function TaskDashboardApp() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState<ViewKey>("today");
  const [includePartner, setIncludePartner] = useState(false);
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<{ user: { displayName: string; familyId?: string } } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<CreateTaskInput>({
    details: "",
    category: "do",
    assignee: "Someone",
    deadlineDate: null,
    scheduledDate: null,
    urls: [],
    source: "web_manual"
  });
  const [captureInput, setCaptureInput] = useState("");
  const [captureDebug, setCaptureDebug] = useState<{
    prompt: string;
    debug: CaptureDebugInfo;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const [recordingStatus, setRecordingStatus] = useState("Hold to record");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setRecordingSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices !== "undefined" &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window !== "undefined" &&
        "MediaRecorder" in window
    );
  }, []);

  useEffect(() => {
    void getAccessToken()
      .then((nextToken) => {
        if (nextToken) {
          setToken(nextToken);
        }
      })
      .catch(() => undefined);

    return subscribeToAuthStateChanges((nextToken) => {
      setToken(nextToken ?? "");
    });
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toastMessage]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getMe(token),
      getTasks({ view, includePartner, search: search || undefined }, token)
    ])
      .then(([meResult, taskResult]) => {
        if (cancelled) return;
        setMe(meResult);
        setTasks(taskResult.items);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, view, includePartner, search]);

  useEffect(() => {
    if (!token || !me?.user.familyId) {
      return;
    }

    try {
      return subscribeToTaskChanges({
        token,
        familyId: me.user.familyId,
        onChange: () => {
          void refresh();
        }
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to subscribe to task updates"
      );
      return;
    }
  }, [token, me?.user.familyId, view, includePartner, search]);

  const grouped = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((accumulator, task) => {
      const key = task.assignee;
      accumulator[key] ??= [];
      accumulator[key].push(task);
      return accumulator;
    }, {});
  }, [tasks]);

  async function refresh() {
    const result = await getTasks({ view, includePartner, search: search || undefined }, token);
    setTasks(result.items);
  }

  async function handleCreateTask() {
    setError(null);
    await createTask(newTask, token);
    setToastMessage("Task added");
    setNewTask({
      details: "",
      category: "do",
      assignee: "Someone",
      deadlineDate: null,
      scheduledDate: null,
      urls: [],
      source: "web_manual"
    });
    await refresh();
  }

  async function handleCapture() {
    setError(null);
    const prompt = captureInput;
    const result = await captureText(prompt, token);
    setCaptureDebug({
      prompt,
      debug: result.debug
    });
    setToastMessage("Task added");
    setCaptureInput("");
    await refresh();
  }

  async function handleVoiceCaptureStart() {
    if (!recordingSupported || recording) {
      return;
    }

    try {
      setError(null);
      setRecordingStatus("Recording… release to send");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        try {
          setRecordingStatus("Transcribing…");
          const mimeType = recorder.mimeType || "audio/webm";
          const audio = new Blob(chunks, { type: mimeType });
          const result = await captureVoice(audio, mimeType, token);
          setCaptureDebug({
            prompt: "[voice input]",
            debug: result.debug
          });
          setToastMessage("Task added");
          await refresh();
          setRecordingStatus("Hold to record");
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : "Voice capture failed");
          setRecordingStatus("Hold to record");
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          setRecording(false);
          (window as Window & { __todobileRecorder?: MediaRecorder }).__todobileRecorder =
            undefined;
        }
      });

      recorder.start();
      (window as Window & { __todobileRecorder?: MediaRecorder }).__todobileRecorder = recorder;
      setRecording(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to access the microphone"
      );
      setRecordingStatus("Hold to record");
      setRecording(false);
    }
  }

  function handleVoiceCaptureStop() {
    const recorder = (window as Window & { __todobileRecorder?: MediaRecorder }).__todobileRecorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function handleStatus(taskId: string, status: Task["status"]) {
    setError(null);
    await updateTask(taskId, { status }, token);
    await refresh();
  }

  async function handleSignIn() {
    try {
      setAuthLoading(true);
      setError(null);
      const accessToken = await signInWithEmailPassword(email, password);
      setToken(accessToken);
      setPassword("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to sign in");
    } finally {
      setAuthLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="page-shell">
        <section className="hero">
          <p className="eyebrow">ToDobile</p>
          <h1>Shared household task capture without the sticky-note sprawl.</h1>
          <p className="lede">
            Sign in with your household account to enter the production app against the hosted backend.
          </p>
          <label className="field">
            <span>Email</span>
            <input
              aria-label="Email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              aria-label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button onClick={() => void handleSignIn()} disabled={authLoading}>
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
          {error ? <p className="error-banner">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {toastMessage ? (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
      <section className="hero compact">
        <div>
          <p className="eyebrow">Household console</p>
          <h1>{me ? `${me.user.displayName}'s task board` : "Task board"}</h1>
        </div>
        <button
          className="ghost"
          onClick={() => {
            setError(null);
            setMe(null);

            void signOut()
              .then(() => {
                setToken("");
              })
              .catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : "Failed to sign out");
              });
          }}
        >
          Sign out
        </button>
      </section>

      <section className="toolbar">
        <div className="button-row">
          {(["today", "backlog", "upcoming", "archived"] as const).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : "ghost"}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={includePartner}
            onChange={(event) => setIncludePartner(event.target.checked)}
          />
          <span>Include partner tasks</span>
        </label>
        <input
          className="search"
          placeholder="Search task details"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="muted">Loading household context…</p> : null}

      <section className="section-lede">
        <p className="eyebrow">Everyone's To Do</p>
        <h2>Shared household view</h2>
      </section>

      <section className="task-columns">
        {Object.entries(grouped).map(([assignee, assigneeTasks]) => (
          <article key={assignee} className="task-column">
            <div className="panel-header">
              <h2>{assignee}</h2>
              <span>{assigneeTasks.length} tasks</span>
            </div>
            <div className="task-list">
              {assigneeTasks.map((task) => (
                <div key={task.id} className="task-card">
                  <div className="task-meta">
                    <span className={`pill category-${task.category}`}>{task.category}</span>
                    <span>{prettyStatus(task)}</span>
                  </div>
                  <h3>{task.details}</h3>
                  {task.urls.length > 0 ? (
                    <a href={task.urls[0]} target="_blank" rel="noreferrer">
                      {task.urls[0]}
                    </a>
                  ) : null}
                  <div className="button-row">
                    <button onClick={() => handleStatus(task.id, "completed")}>Complete</button>
                    <button className="ghost" onClick={() => handleStatus(task.id, "active")}>
                      Reopen
                    </button>
                    <button className="ghost" onClick={() => handleStatus(task.id, "deleted")}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {assigneeTasks.length === 0 ? <p className="muted">No tasks in this slice.</p> : null}
            </div>
          </article>
        ))}
      </section>

      <section className="panel-grid composer-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Capture</h2>
            <span>Text-to-task</span>
          </div>
          <textarea
            rows={4}
            placeholder="renew tabs by 2026-04-20"
            value={captureInput}
            onChange={(event) => setCaptureInput(event.target.value)}
          />
          <div className="button-row">
            <button disabled={!captureInput.trim()} onClick={handleCapture}>
              Create from text
            </button>
            <button
              type="button"
              className={recording ? "active mic-button" : "ghost mic-button"}
              disabled={!recordingSupported}
              onMouseDown={handleVoiceCaptureStart}
              onMouseUp={handleVoiceCaptureStop}
              onMouseLeave={() => {
                if (recording) {
                  handleVoiceCaptureStop();
                }
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                void handleVoiceCaptureStart();
              }}
              onTouchEnd={(event) => {
                event.preventDefault();
                handleVoiceCaptureStop();
              }}
            >
              <span aria-hidden="true">🎙</span>
              <span>{recordingStatus}</span>
            </button>
          </div>
          {!recordingSupported ? (
            <p className="muted">This browser does not support microphone capture.</p>
          ) : null}
          {captureDebug ? (
            <details className="debug-panel">
              <summary>OpenAI Debug</summary>
              <div className="debug-grid">
                <div>
                  <h3>Prompt</h3>
                  <pre>{captureDebug.prompt}</pre>
                </div>
                <div>
                  <h3>Provider</h3>
                  <pre>{captureDebug.debug.provider}</pre>
                </div>
                <div>
                  <h3>Request Sent</h3>
                  <pre>{JSON.stringify(captureDebug.debug.request, null, 2)}</pre>
                </div>
                <div>
                  <h3>Raw Response</h3>
                  <pre>{JSON.stringify(captureDebug.debug.rawResponse, null, 2)}</pre>
                </div>
              </div>
            </details>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Manual task</h2>
            <span>For web management flows</span>
          </div>
          <label className="field">
            <span>Details</span>
            <input
              value={newTask.details}
              onChange={(event) => setNewTask({ ...newTask, details: event.target.value })}
            />
          </label>
          <div className="split">
            <label className="field">
              <span>Category</span>
              <select
                value={newTask.category}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    category: event.target.value as CreateTaskInput["category"]
                  })
                }
              >
                <option value="buy">Buy</option>
                <option value="do">Do</option>
                <option value="remember">Remember</option>
                <option value="blocker">Blocker</option>
              </select>
            </label>
            <label className="field">
              <span>Assignee</span>
              <select
                value={newTask.assignee}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    assignee: event.target.value as CreateTaskInput["assignee"]
                  })
                }
              >
                <option value="Zac">Zac</option>
                <option value="Lauryl">Lauryl</option>
                <option value="Someone">Someone</option>
              </select>
            </label>
          </div>
          <div className="split">
            <label className="field">
              <span>Deadline</span>
              <input
                type="date"
                value={newTask.deadlineDate ?? ""}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    deadlineDate: event.target.value || null
                  })
                }
              />
            </label>
            <label className="field">
              <span>Scheduled</span>
              <input
                type="date"
                value={newTask.scheduledDate ?? ""}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    scheduledDate: event.target.value || null
                  })
                }
              />
            </label>
          </div>
          <button disabled={!newTask.details.trim()} onClick={handleCreateTask}>
            Save task
          </button>
        </section>
      </section>
    </main>
  );
}
