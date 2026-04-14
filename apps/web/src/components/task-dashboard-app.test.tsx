import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as Vitest from "vitest";
import { vi } from "vitest";

const { afterEach, beforeEach, describe, expect, it } = Vitest;

const {
  getMeMock,
  getTasksMock,
  createTaskMock,
  updateTaskMock,
  captureTextMock,
  captureVoiceMock,
  subscribeToTaskChangesMock
} = vi.hoisted(() => ({
  getMeMock: vi.fn(),
  getTasksMock: vi.fn(),
  createTaskMock: vi.fn(),
  updateTaskMock: vi.fn(),
  captureTextMock: vi.fn(),
  captureVoiceMock: vi.fn(),
  subscribeToTaskChangesMock: vi.fn()
}));

const {
  getAccessTokenMock,
  signInWithEmailPasswordMock,
  signOutMock,
  subscribeToAuthStateChangesMock
} = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn<() => Promise<string | null>>(async () => null),
  signInWithEmailPasswordMock: vi.fn(async () => "real-access-token"),
  signOutMock: vi.fn(async () => undefined),
  subscribeToAuthStateChangesMock: vi.fn(() => vi.fn())
}));

vi.mock("@/lib/client/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/client/api")>("@/lib/client/api");
  return {
    ...actual,
    getMe: getMeMock,
    getTasks: getTasksMock,
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    captureText: captureTextMock,
    captureVoice: captureVoiceMock
  };
});

vi.mock("@/lib/client/realtime", () => ({
  subscribeToTaskChanges: subscribeToTaskChangesMock
}));

vi.mock("@/lib/client/auth", () => ({
  getAccessToken: getAccessTokenMock,
  signInWithEmailPassword: signInWithEmailPasswordMock,
  signOut: signOutMock,
  subscribeToAuthStateChanges: subscribeToAuthStateChangesMock
}));

async function loadTaskDashboardApp() {
  const module = await import("./task-dashboard-app");
  return module.TaskDashboardApp;
}

function buildTask(overrides: Record<string, unknown>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    familyId: "22222222-2222-4222-8222-222222222222",
    details: "Book summer camp",
    category: "do",
    assignee: "Someone",
    status: "active",
    deadlineDate: null,
    scheduledDate: null,
    urls: [],
    createdAt: "2026-04-11T17:00:00.000Z",
    createdByUserId: "33333333-3333-4333-8333-333333333333",
    updatedAt: "2026-04-11T17:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    ...overrides
  };
}

describe("TaskDashboardApp", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dark production sign-in screen", async () => {
    const TaskDashboardApp = await loadTaskDashboardApp();

    render(<TaskDashboardApp />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText(/condensed queue/i)).toBeInTheDocument();
  });

  it("signs in and loads the open queue from backlog tasks", async () => {
    const TaskDashboardApp = await loadTaskDashboardApp();
    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [buildTask({ assignee: "Zac", details: "Pick up medicine" })],
      nextCursor: null
    });

    render(<TaskDashboardApp />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "zaccohn@gmail.com" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "todobile" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithEmailPasswordMock).toHaveBeenCalledWith(
        "zaccohn@gmail.com",
        "todobile"
      );
    });

    await waitFor(() => {
      expect(getTasksMock).toHaveBeenCalledWith(
        { view: "backlog", includePartner: false, search: undefined },
        "real-access-token"
      );
    });

    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scheduled" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tuesday, april 14/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zac" })).not.toBeInTheDocument();
    expect(screen.getByText("soon")).toBeInTheDocument();
    expect(screen.getByText("late")).toBeInTheDocument();
    expect(screen.queryByText("closed")).not.toBeInTheDocument();
    expect(screen.getByTestId("zeta-shell")).toBeInTheDocument();
    expect(screen.getByTestId("zeta-list")).toBeInTheDocument();
    expect(screen.getByTestId("zeta-bottom-nav")).toBeInTheDocument();
  });

  it("defaults owner chips to the current user and Somebody", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [
        buildTask({ id: "11111111-1111-4111-8111-111111111112", details: "Pick up medicine", assignee: "Zac" }),
        buildTask({ id: "11111111-1111-4111-8111-111111111113", details: "Buy paper towels", assignee: "Someone" }),
        buildTask({ id: "11111111-1111-4111-8111-111111111114", details: "Call daycare", assignee: "Lauryl" })
      ],
      nextCursor: null
    });

    render(<TaskDashboardApp />);

    await screen.findByText("Pick up medicine");

    expect(screen.getByRole("button", { name: "Zac's" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Unassigned" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Lauryl's" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.queryByText("Call daycare")).not.toBeInTheDocument();
  });

  it("filters the queue by category tag and assignee on the frontend", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [
        buildTask({
          id: "11111111-1111-4111-8111-111111111181",
          details: "Pick up medicine",
          category: "do",
          assignee: "Zac"
        }),
        buildTask({
          id: "11111111-1111-4111-8111-111111111182",
          details: "Book summer camp",
          category: "do",
          assignee: "Someone"
        }),
        buildTask({
          id: "11111111-1111-4111-8111-111111111183",
          details: "Paper towels",
          category: "buy",
          assignee: "Someone"
        })
      ],
      nextCursor: null
    });

    render(<TaskDashboardApp />);
    await screen.findByText("Pick up medicine");

    fireEvent.change(screen.getByLabelText("Search tasks"), {
      target: { value: "buy" }
    });

    expect(screen.getByText("Paper towels")).toBeInTheDocument();
    expect(screen.queryByText("Pick up medicine")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search tasks"), {
      target: { value: "zac" }
    });

    expect(screen.getByText("Pick up medicine")).toBeInTheDocument();
    expect(screen.queryByText("Paper towels")).not.toBeInTheDocument();
  });

  it("shows only future-dated active tasks in the Scheduled view", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [
        buildTask({
          id: "11111111-1111-4111-8111-111111111121",
          details: "Future scheduled",
          assignee: "Zac",
          scheduledDate: "2026-04-16"
        }),
        buildTask({
          id: "11111111-1111-4111-8111-111111111122",
          details: "Future deadline",
          assignee: "Someone",
          deadlineDate: "2026-04-20"
        }),
        buildTask({
          id: "11111111-1111-4111-8111-111111111123",
          details: "Due today",
          assignee: "Zac",
          deadlineDate: "2026-04-14"
        })
      ],
      nextCursor: null
    });

    render(<TaskDashboardApp />);
    await screen.findByText("Future scheduled");

    fireEvent.click(screen.getByRole("button", { name: "Scheduled" }));

    expect(screen.getByText("Future scheduled")).toBeInTheDocument();
    expect(screen.getByText("Future deadline")).toBeInTheDocument();
    expect(screen.queryByText("Due today")).not.toBeInTheDocument();
  });

  it("uses the archived endpoint for Closed and shows archived tasks", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Open task", assignee: "Zac" })],
        nextCursor: null
      })
      .mockResolvedValueOnce({
        items: [
          buildTask({
            id: "11111111-1111-4111-8111-111111111131",
            details: "Completed task",
            status: "completed",
            assignee: "Someone",
            completedAt: "2026-04-14T09:00:00.000Z"
          })
        ],
        nextCursor: null
      });

    render(<TaskDashboardApp />);
    await screen.findByText("Open task");

    fireEvent.click(screen.getByRole("button", { name: "Closed" }));

    await waitFor(() => {
      expect(getTasksMock).toHaveBeenLastCalledWith(
        { view: "archived", includePartner: false, search: undefined },
        "real-jwt-token"
      );
    });

    expect(await screen.findByText("Completed task")).toBeInTheDocument();
  });

  it("opens the add overlay and creates a manual task", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Book summer camp", assignee: "Someone" })],
        nextCursor: null
      });
    createTaskMock.mockResolvedValue({
      task: buildTask({ details: "Book summer camp", assignee: "Someone" })
    });

    render(<TaskDashboardApp />);
    await screen.findByRole("button", { name: "Add" });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).queryByRole("option", { name: "Remember" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Details"), {
      target: { value: "Book summer camp" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add task" }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: "Book summer camp",
          source: "web_manual"
        }),
        "real-jwt-token"
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Task added");
  });

  it("captures text from the overlay and keeps OpenAI debug available", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Pick up medicine", assignee: "Zac" })],
        nextCursor: null
      });
    captureTextMock.mockResolvedValue({
      task: buildTask({ details: "Pick up medicine", assignee: "Zac" }),
      debug: {
        provider: "openai",
        request: { input: "Pick up Zac's medicine next Tuesday" },
        rawResponse: { output: "ok" }
      }
    });

    render(<TaskDashboardApp />);
    await screen.findByRole("button", { name: "Add" });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const dialog = screen.getByRole("dialog", { name: "New task" });
    fireEvent.change(within(dialog).getByLabelText("Capture input"), {
      target: { value: "Pick up Zac's medicine next Tuesday" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "From text" }));

    await waitFor(() => {
      expect(captureTextMock).toHaveBeenCalledWith(
        "Pick up Zac's medicine next Tuesday",
        "real-jwt-token"
      );
    });

    const debug = await within(dialog).findByText("OpenAI Debug");
    expect(debug).toBeInTheDocument();
  });

  it("completes an active task from the queue checkbox", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Pick up medicine", assignee: "Zac" })],
        nextCursor: null
      })
      .mockResolvedValueOnce({
        items: [],
        nextCursor: null
      });
    updateTaskMock.mockResolvedValue({
      task: buildTask({
        details: "Pick up medicine",
        assignee: "Zac",
        status: "completed",
        completedAt: "2026-04-14T10:00:00.000Z"
      })
    });

    render(<TaskDashboardApp />);
    const checkbox = await screen.findByRole("checkbox", {
      name: "Complete Pick up medicine"
    });

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(updateTaskMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        { status: "completed" },
        "real-jwt-token"
      );
    });
  });

  it("opens overflow actions for secondary task controls", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [buildTask({ details: "Pick up medicine", assignee: "Zac" })],
      nextCursor: null
    });

    render(<TaskDashboardApp />);
    const actionButton = await screen.findByRole("button", { name: "Task options" });
    fireEvent.click(actionButton);

    expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("refreshes tasks when a realtime change arrives", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1",
        assigneeKey: "Zac"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Book summer camp", assignee: "Someone" })],
        nextCursor: null
      })
      .mockResolvedValueOnce({
        items: [buildTask({ details: "Take Shadow to daycare", assignee: "Zac" })],
        nextCursor: null
      });

    let onChange: (() => void) | undefined;
    subscribeToTaskChangesMock.mockImplementation(({ onChange: nextOnChange }) => {
      onChange = nextOnChange;
      return vi.fn();
    });

    render(<TaskDashboardApp />);

    await waitFor(() => {
      expect(subscribeToTaskChangesMock).toHaveBeenCalledWith({
        token: "real-jwt-token",
        familyId: "family-1",
        onChange: expect.any(Function)
      });
    });

    onChange?.();

    await waitFor(() => {
      expect(getTasksMock).toHaveBeenCalledTimes(4);
    });
  });
});
