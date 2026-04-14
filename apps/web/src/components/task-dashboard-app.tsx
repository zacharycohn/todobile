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

import {
  buildDefaultOwnerSelection,
  buildTaskSummary,
  getUrgencyState,
  getVisibleTasks,
  reorderTaskIds,
  type AssigneeValue,
  type DashboardTab
} from "./task-dashboard-view";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function prettyRowMeta(task: Task, today: string) {
  const bits: string[] = [task.assignee];

  if (task.status === "completed") {
    bits.push("Completed");
  } else if (task.status === "deleted") {
    bits.push("Deleted");
  } else if (task.deadlineDate && task.deadlineDate < today) {
    bits.push(`Late • Was due ${formatDateLabel(task.deadlineDate)}`);
  } else if (task.deadlineDate) {
    bits.push(
      task.deadlineDate === today
        ? "Due today"
        : `Due ${formatDateLabel(task.deadlineDate)}`
    );
  } else if (task.scheduledDate) {
    bits.push(
      task.scheduledDate === today
        ? "Scheduled today"
        : `Scheduled ${formatDateLabel(task.scheduledDate)}`
    );
  }

  return bits.join(" • ");
}

function ownerButtonLabel(assignee: AssigneeValue) {
  if (assignee === "Someone") return "Unassigned";
  return `${assignee}'s`;
}

function categoryLabel(category: Task["category"]) {
  return category[0].toUpperCase() + category.slice(1);
}

function taskCreationDefaults(): CreateTaskInput {
  return {
    details: "",
    category: "do",
    assignee: "Someone",
    deadlineDate: null,
    scheduledDate: null,
    urls: [],
    source: "web_manual"
  };
}

export function TaskDashboardApp() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("open");
  const [selectedAssignees, setSelectedAssignees] = useState<Set<AssigneeValue>>(new Set());
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<{
    user: { displayName: string; familyId?: string; assigneeKey?: AssigneeValue };
  } | null>(null);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<CreateTaskInput>(taskCreationDefaults);
  const [captureInput, setCaptureInput] = useState("");
  const [captureDebug, setCaptureDebug] = useState<{
    prompt: string;
    debug: CaptureDebugInfo;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const [recordingStatus, setRecordingStatus] = useState("Hold to record");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([]);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const today = todayIso();

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
    if (!toastMessage) return;

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toastMessage]);

  async function refresh() {
    const [meResult, backlogResult, archivedResult] = await Promise.all([
      getMe(token),
      getTasks({ view: "backlog", includePartner: false }, token),
      getTasks({ view: "archived", includePartner: false }, token)
    ]);

    setMe(meResult);
    setBacklogTasks(backlogResult.items);
    setArchivedTasks(archivedResult.items);

    if (meResult.user.assigneeKey && selectedAssignees.size === 0) {
      setSelectedAssignees(buildDefaultOwnerSelection(meResult.user.assigneeKey));
    }
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    refresh()
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, search]);

  useEffect(() => {
    if (!token || !me?.user.familyId) return;

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
  }, [token, me?.user.familyId, search]);

  const summary = useMemo(
    () => buildTaskSummary([...backlogTasks, ...archivedTasks], today),
    [archivedTasks, backlogTasks, today]
  );

  const visibleTasks = useMemo(() => {
    const sourceTasks = activeTab === "closed" ? archivedTasks : backlogTasks;
    return getVisibleTasks({
      tasks: sourceTasks,
      tab: activeTab,
      selectedAssignees,
      search,
      today,
      orderedTaskIds
    });
  }, [activeTab, archivedTasks, backlogTasks, orderedTaskIds, search, selectedAssignees, today]);

  useEffect(() => {
    const validIds = new Set(
      [...backlogTasks, ...archivedTasks].map((task) => task.id)
    );

    setOrderedTaskIds((current) => current.filter((taskId) => validIds.has(taskId)));
  }, [backlogTasks, archivedTasks]);

  function toggleAssignee(assignee: AssigneeValue) {
    setSelectedAssignees((current) => {
      const next = new Set(current);
      if (next.has(assignee)) {
        next.delete(assignee);
      } else {
        next.add(assignee);
      }
      return next;
    });
  }

  async function handleCreateTask() {
    setError(null);
    await createTask(newTask, token);
    setToastMessage("Task added");
    setNewTask(taskCreationDefaults());
    setComposerOpen(false);
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
    if (!recordingSupported || recording) return;

    try {
      setError(null);
      setRecordingStatus("Recording… release to send");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
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
    setMenuTaskId(null);
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
      <main className="zeta-shell" data-testid="zeta-shell">
        <section className="zeta-phone">
          <div className="zeta-signin-panel">
            <p className="zeta-eyebrow">ToDobile</p>
            <h2>Sign in</h2>
            <p className="zeta-muted">
              A condensed queue built for quicker scanning and faster task clearing.
            </p>
            <label className="zeta-field">
              <span>Email</span>
              <input
                aria-label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="zeta-field">
              <span>Password</span>
              <input
                aria-label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="zeta-button zeta-button-primary zeta-full-width" onClick={() => void handleSignIn()} disabled={authLoading}>
              {authLoading ? "Signing in…" : "Sign in"}
            </button>
            {error ? <p className="zeta-error-banner">{error}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="zeta-shell" data-testid="zeta-shell">
      {toastMessage ? (
        <div className="zeta-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      <section className="zeta-phone">
        <header className="zeta-top">
          <div>
            <h1>
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric"
              }).format(new Date())}
            </h1>
          </div>
          <button
            className="zeta-button zeta-button-ghost zeta-small-button"
            onClick={() => {
              setError(null);
              setMe(null);
              void signOut()
                .then(() => setToken(""))
                .catch((nextError) => {
                  setError(nextError instanceof Error ? nextError.message : "Failed to sign out");
                });
            }}
          >
            Out
          </button>
        </header>

        <section className="zeta-sheet">
          <div className="zeta-summary-bar" aria-label="Task summary">
            <div className="zeta-summary-pill">
              <strong>{summary.open}</strong>
              <span className="zeta-muted">open</span>
            </div>
            <div className="zeta-summary-pill">
              <strong>{summary.scheduled}</strong>
              <span className="zeta-muted">scheduled</span>
            </div>
            <div className="zeta-summary-pill">
              <strong>{summary.soon}</strong>
              <span className="zeta-muted">soon</span>
            </div>
            <div className="zeta-summary-pill">
              <strong>{summary.late}</strong>
              <span className="zeta-muted">late</span>
            </div>
          </div>

          <div className="zeta-filters">
            {(["Someone", "Zac", "Lauryl"] as AssigneeValue[]).map((assignee) => (
              <button
                key={assignee}
                type="button"
                className={`zeta-filter zeta-filter-${assignee.toLowerCase()} ${
                  selectedAssignees.has(assignee) ? "is-active" : ""
                }`}
                aria-pressed={selectedAssignees.has(assignee)}
                onClick={() => toggleAssignee(assignee)}
              >
                {ownerButtonLabel(assignee)}
              </button>
            ))}
              <button
                type="button"
                className="zeta-button zeta-button-primary zeta-small-button"
                onClick={() => setComposerOpen(true)}
              >
              Add
            </button>
          </div>

          <label className="zeta-search-field">
            <span className="sr-only">Search tasks</span>
            <input
              aria-label="Search tasks"
              placeholder="Search task details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </section>

        {error ? <p className="zeta-error-banner">{error}</p> : null}
        {loading ? <p className="zeta-inline-state">Loading household context…</p> : null}

        <section className="zeta-list" aria-live="polite" data-testid="zeta-list">
          {visibleTasks.length === 0 && !loading ? (
            <p className="zeta-inline-state">No tasks in this slice right now.</p>
          ) : null}

          {visibleTasks.map((task) => {
            const urgency = getUrgencyState(task, today);
            return (
              <div
                key={task.id}
                className={`zeta-row owner-${task.assignee.toLowerCase()} urgency-${urgency} ${
                  draggingTaskId === task.id ? "is-dragging" : ""
                } ${dragOverTaskId === task.id ? "is-drag-target" : ""}`}
                draggable
                onDragStart={(event) => {
                  setDraggingTaskId(task.id);
                  setDragOverTaskId(task.id);
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!draggingTaskId || draggingTaskId === task.id) {
                    return;
                  }
                  setDragOverTaskId(task.id);
                  setOrderedTaskIds((current) =>
                    reorderTaskIds(
                      current.length > 0 ? current : visibleTasks.map((item) => item.id),
                      draggingTaskId,
                      task.id
                    )
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData("text/plain");
                  setOrderedTaskIds((current) =>
                    reorderTaskIds(
                      current.length > 0 ? current : visibleTasks.map((item) => item.id),
                      sourceId,
                      task.id
                    )
                  );
                  setDragOverTaskId(null);
                  setDraggingTaskId(null);
                }}
                onDragEnd={() => {
                  setDragOverTaskId(null);
                  setDraggingTaskId(null);
                }}
              >
                <button
                  type="button"
                  className="zeta-grabber"
                  aria-label={`Reorder ${task.details}`}
                >
                  <span />
                  <span />
                </button>
                <input
                  className="zeta-row-check"
                  type="checkbox"
                  aria-label={`Complete ${task.details}`}
                  checked={task.status === "completed"}
                  onChange={() => void handleStatus(task.id, task.status === "completed" ? "active" : "completed")}
                />
                <div className="zeta-row-main">
                  <div className="zeta-row-title">
                    <span className={`zeta-pill zeta-category-${task.category}`}>
                      {categoryLabel(task.category)}
                    </span>
                    <strong>{task.details}</strong>
                  </div>
                  <p>{prettyRowMeta(task, today)}</p>
                  {task.urls[0] ? (
                    <a href={task.urls[0]} target="_blank" rel="noreferrer">
                      {task.urls[0]}
                    </a>
                  ) : null}
                </div>
                <div className="zeta-row-actions">
                  <button
                    type="button"
                    className="zeta-icon-button"
                    aria-label="Task options"
                    onClick={() => setMenuTaskId((current) => (current === task.id ? null : task.id))}
                  >
                    &#8942;
                  </button>
                  {menuTaskId === task.id ? (
                    <div className="zeta-menu">
                      {task.status !== "completed" ? (
                        <button type="button" onClick={() => void handleStatus(task.id, "completed")}>
                          Complete
                        </button>
                      ) : (
                        <button type="button" onClick={() => void handleStatus(task.id, "active")}>
                          Reopen
                        </button>
                      )}
                      <button type="button" onClick={() => void handleStatus(task.id, "deleted")}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <nav className="zeta-bottom-nav" data-testid="zeta-bottom-nav">
          {([
            ["open", "Open"],
            ["scheduled", "Scheduled"],
            ["closed", "Closed"]
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={activeTab === value ? "is-active" : ""}
              onClick={() => setActiveTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
      </section>

      {composerOpen ? (
        <div className="zeta-overlay" role="presentation" onClick={() => setComposerOpen(false)}>
          <section
            className="zeta-composer"
            role="dialog"
            aria-modal="true"
            aria-label="New task"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="zeta-top">
              <div>
                <p className="zeta-eyebrow">New task</p>
                <h2>Capture</h2>
              </div>
              <button
                type="button"
                className="zeta-button zeta-button-ghost zeta-small-button"
                onClick={() => setComposerOpen(false)}
              >
                Close
              </button>
            </header>

            <label className="zeta-field">
              <span>Capture input</span>
              <textarea
                aria-label="Capture input"
                rows={4}
                value={captureInput}
                onChange={(event) => setCaptureInput(event.target.value)}
                placeholder="Pick up Zac's medicine next Tuesday"
              />
            </label>

            <div className="zeta-composer-actions">
              <button
                type="button"
                className="zeta-button zeta-button-primary zeta-small-button"
                disabled={!captureInput.trim()}
                onClick={() => void handleCapture()}
              >
                From text
              </button>
              <button
                type="button"
                className={`zeta-button ${recording ? "zeta-button-primary" : "zeta-button-ghost"} zeta-small-button`}
                disabled={!recordingSupported}
                onMouseDown={handleVoiceCaptureStart}
                onMouseUp={handleVoiceCaptureStop}
                onMouseLeave={() => {
                  if (recording) handleVoiceCaptureStop();
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
                Voice
              </button>
            </div>

            {!recordingSupported ? (
              <p className="zeta-inline-state">This browser does not support microphone capture.</p>
            ) : (
              <p className="zeta-inline-state">{recordingStatus}</p>
            )}

            <label className="zeta-field">
              <span>Details</span>
              <input
                aria-label="Details"
                value={newTask.details}
                onChange={(event) => setNewTask({ ...newTask, details: event.target.value })}
              />
            </label>

            <div className="zeta-split">
              <label className="zeta-field">
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
                  <option value="blocker">Blocker</option>
                </select>
              </label>
              <label className="zeta-field">
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

            <div className="zeta-split">
              <label className="zeta-field">
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
              <label className="zeta-field">
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
            </div>

            <button
              type="button"
              className="zeta-button zeta-button-primary zeta-full-width"
              disabled={!newTask.details.trim()}
              onClick={() => void handleCreateTask()}
            >
              Add task
            </button>

            {captureDebug ? (
              <details className="zeta-debug-panel">
                <summary>OpenAI Debug</summary>
                <div className="zeta-debug-grid">
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
        </div>
      ) : null}
    </main>
  );
}
