import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMeMock, getTasksMock, subscribeToTaskChangesMock } = vi.hoisted(() => ({
  getMeMock: vi.fn(),
  getTasksMock: vi.fn(),
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
    getTasks: getTasksMock
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

describe("TaskDashboardApp", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders demo auth entrypoints", async () => {
    const TaskDashboardApp = await loadTaskDashboardApp();

    render(<TaskDashboardApp demoAuthEnabledOverride />);
    expect(screen.getByText("Use Zac demo")).toBeInTheDocument();
    expect(screen.getByText(/sticky-note sprawl/i)).toBeInTheDocument();
    expect(screen.queryByText("Task added")).not.toBeInTheDocument();
  });

  it("hides demo auth entrypoints and clears stale demo tokens when demo auth is disabled", async () => {
    window.localStorage.setItem(
      "todobile.demoToken",
      "demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
    );

    const TaskDashboardApp = await loadTaskDashboardApp();

    render(<TaskDashboardApp demoAuthEnabledOverride={false} />);

    expect(screen.queryByText("Use Zac demo")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("todobile.demoToken")).toBeNull();
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it("signs in with email and password when demo auth is disabled", async () => {
    const TaskDashboardApp = await loadTaskDashboardApp();
    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1"
      }
    });
    getTasksMock.mockResolvedValue({
      items: [],
      nextCursor: null
    });

    render(<TaskDashboardApp demoAuthEnabledOverride={false} />);

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
      expect(getMeMock).toHaveBeenCalledWith("real-access-token");
      expect(getTasksMock).toHaveBeenCalledWith(
        { view: "today", includePartner: false, search: undefined },
        "real-access-token"
      );
    });
  });

  it("refreshes tasks when a realtime change arrives", async () => {
    getAccessTokenMock.mockResolvedValue("real-jwt-token");
    const TaskDashboardApp = await loadTaskDashboardApp();

    getMeMock.mockResolvedValue({
      user: {
        displayName: "Zac",
        familyId: "family-1"
      }
    });
    getTasksMock
      .mockResolvedValueOnce({
        items: [
          {
            id: "task-1",
            familyId: "family-1",
            details: "Book summer camp",
            category: "do",
            assignee: "Someone",
            status: "active",
            deadlineDate: null,
            scheduledDate: null,
            urls: [],
            createdAt: "2026-04-11T17:00:00.000Z",
            createdByUserId: "user-1",
            updatedAt: "2026-04-11T17:00:00.000Z",
            completedAt: null,
            deletedAt: null
          }
        ],
        nextCursor: null
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "task-2",
            familyId: "family-1",
            details: "Take Shadow to daycare",
            category: "do",
            assignee: "Zac",
            status: "active",
            deadlineDate: null,
            scheduledDate: "2026-04-14",
            urls: [],
            createdAt: "2026-04-11T17:05:00.000Z",
            createdByUserId: "user-2",
            updatedAt: "2026-04-11T17:05:00.000Z",
            completedAt: null,
            deletedAt: null
          }
        ],
        nextCursor: null
      });

    let onChange: (() => void) | undefined;
    subscribeToTaskChangesMock.mockImplementation(({ onChange: nextOnChange }) => {
      onChange = nextOnChange;
      return vi.fn();
    });

    render(<TaskDashboardApp demoAuthEnabledOverride={false} />);

    await waitFor(() => {
      expect(subscribeToTaskChangesMock).toHaveBeenCalledWith({
        token: "real-jwt-token",
        familyId: "family-1",
        onChange: expect.any(Function)
      });
    });

    onChange?.();

    await waitFor(() => {
      expect(getTasksMock).toHaveBeenCalledTimes(2);
    });
  });
});
