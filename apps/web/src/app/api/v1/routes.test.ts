import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeDependencies } from "@/lib/server/types";
import { AppError } from "@/lib/server/errors";

const {
  requireAuthMock,
  createRuntimeDependenciesMock,
  getCurrentUserMock,
  listTasksMock,
  createTaskMock,
  updateTaskMock,
  captureTextMock,
  captureVoiceMock
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  createRuntimeDependenciesMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  listTasksMock: vi.fn(),
  createTaskMock: vi.fn(),
  updateTaskMock: vi.fn(),
  captureTextMock: vi.fn(),
  captureVoiceMock: vi.fn()
}));

vi.mock("@/lib/server/auth", () => ({
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/server/supabase", () => ({
  createRuntimeDependencies: createRuntimeDependenciesMock
}));

vi.mock("@/lib/server/services", () => ({
  getCurrentUser: getCurrentUserMock,
  listTasks: listTasksMock,
  createTask: createTaskMock,
  updateTask: updateTaskMock,
  captureText: captureTextMock,
  captureVoice: captureVoiceMock
}));

import { GET as getHealth } from "./health/route";
import { GET as getMe } from "./me/route";
import { GET as getTasks, POST as postTask } from "./tasks/route";
import { PATCH as patchTask } from "./tasks/[taskId]/route";
import { POST as postTextCapture } from "./captures/text/route";
import { POST as postVoiceCapture } from "./captures/voice/route";

const auth = {
  userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  email: "zac@example.com",
  familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
  displayName: "Zac",
  assigneeKey: "Zac" as const,
  bearerToken: "jwt-token"
};

function createDependencies(): RuntimeDependencies {
  return {
    profiles: {
      getByUserId: vi.fn()
    },
    tasks: {
      listTasks: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn()
    },
    ai: {
      parseText: vi.fn(),
      parseVoice: vi.fn()
    }
  };
}

describe("API routes", () => {
  let dependencies: RuntimeDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    dependencies = createDependencies();
    createRuntimeDependenciesMock.mockReturnValue(dependencies);
    requireAuthMock.mockResolvedValue(auth);
  });

  it("returns health status", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { status: "ok" },
      error: null
    });
  });

  it("returns the current user", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: {
        id: auth.userId,
        email: auth.email,
        displayName: auth.displayName,
        assigneeKey: "Zac",
        familyId: auth.familyId,
        familyName: "Cohnobi"
      }
    });

    const response = await getMe(
      new Request("http://localhost:3000/api/v1/me", {
        headers: { Authorization: `Bearer ${auth.bearerToken}` }
      })
    );

    expect(response.status).toBe(200);
    expect(requireAuthMock).toHaveBeenCalledTimes(1);
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      data: {
        user: {
          id: auth.userId,
          email: auth.email,
          displayName: auth.displayName,
          assigneeKey: "Zac",
          familyId: auth.familyId,
          familyName: "Cohnobi"
        }
      },
      error: null
    });
  });

  it("returns route-formatted auth errors", async () => {
    requireAuthMock.mockRejectedValue(new AppError("unauthorized", "Missing bearer token", 401));

    const response = await getMe(new Request("http://localhost:3000/api/v1/me"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: {
        code: "unauthorized",
        message: "Missing bearer token",
        details: {}
      }
    });
  });

  it("lists tasks with URL search params", async () => {
    listTasksMock.mockResolvedValue({
      items: [{ id: "task-1", details: "Book summer camp" }],
      nextCursor: null
    });

    const response = await getTasks(
      new Request("http://localhost:3000/api/v1/tasks?view=backlog&includePartner=true", {
        headers: { Authorization: `Bearer ${auth.bearerToken}` }
      })
    );

    expect(response.status).toBe(200);
    expect(listTasksMock).toHaveBeenCalledTimes(1);
    expect(listTasksMock.mock.calls[0]?.[2]).toBeInstanceOf(URLSearchParams);
    await expect(response.json()).resolves.toEqual({
      data: {
        items: [{ id: "task-1", details: "Book summer camp" }],
        nextCursor: null
      },
      error: null
    });
  });

  it("creates a task from valid JSON", async () => {
    createTaskMock.mockResolvedValue({
      task: {
        id: "task-1",
        details: "Book summer camp"
      }
    });

    const response = await postTask(
      new Request("http://localhost:3000/api/v1/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          details: "Book summer camp",
          category: "do",
          assignee: "Someone",
          deadlineDate: null,
          scheduledDate: null,
          urls: [],
          source: "web_manual"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(createTaskMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      data: {
        task: {
          id: "task-1",
          details: "Book summer camp"
        }
      },
      error: null
    });
  });

  it("rejects invalid task creation payloads", async () => {
    const response = await postTask(
      new Request("http://localhost:3000/api/v1/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          details: "",
          category: "do"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(createTaskMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.code).toBe("validation_failed");
  });

  it("updates a task using the dynamic task id", async () => {
    updateTaskMock.mockResolvedValue({
      task: {
        id: "task-1",
        status: "completed"
      }
    });

    const response = await patchTask(
      new Request("http://localhost:3000/api/v1/tasks/task-1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${auth.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "completed"
        })
      }),
      { params: Promise.resolve({ taskId: "task-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateTaskMock).toHaveBeenCalledWith(dependencies, auth, "task-1", {
      status: "completed"
    });
    await expect(response.json()).resolves.toEqual({
      data: {
        task: {
          id: "task-1",
          status: "completed"
        }
      },
      error: null
    });
  });

  it("creates a task from text capture", async () => {
    captureTextMock.mockResolvedValue({
      task: { id: "task-1", details: "Pick up medicine" },
      debug: { provider: "openai", request: {}, rawResponse: {} }
    });

    const response = await postTextCapture(
      new Request("http://localhost:3000/api/v1/captures/text", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.bearerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: "Pick up my medicine next Tuesday",
          source: "android_widget_text"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(captureTextMock).toHaveBeenCalledWith(
      dependencies,
      auth,
      "Pick up my medicine next Tuesday"
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        task: { id: "task-1", details: "Pick up medicine" },
        debug: { provider: "openai", request: {}, rawResponse: {} }
      },
      error: null
    });
  });

  it("creates a task from voice capture", async () => {
    captureVoiceMock.mockResolvedValue({
      task: { id: "task-2", details: "Take Shadow to daycare" },
      debug: { provider: "openai", request: {}, rawResponse: {} }
    });

    const formData = new FormData();
    formData.append("audio", new File(["audio"], "capture.webm", { type: "audio/webm" }));
    formData.append("mimeType", "audio/webm");
    formData.append("source", "android_app_voice");

    const response = await postVoiceCapture({
      headers: new Headers({
        Authorization: `Bearer ${auth.bearerToken}`
      }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(201);
    expect(captureVoiceMock).toHaveBeenCalledTimes(1);
    expect(captureVoiceMock.mock.calls[0]?.[0]).toBe(dependencies);
    expect(captureVoiceMock.mock.calls[0]?.[1]).toBe(auth);
    expect(captureVoiceMock.mock.calls[0]?.[2]).toBeInstanceOf(File);
    expect(captureVoiceMock.mock.calls[0]?.[3]).toBe("audio/webm");
    expect(captureVoiceMock.mock.calls[0]?.[4]).toBe("android_app_voice");
  });

  it("rejects voice capture requests without audio", async () => {
    const formData = new FormData();
    formData.append("mimeType", "audio/webm");

    const response = await postVoiceCapture({
      headers: new Headers({
        Authorization: `Bearer ${auth.bearerToken}`
      }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(400);
    expect(captureVoiceMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: {
        code: "validation_failed",
        message: "Audio file is required",
        details: {}
      }
    });
  });

  it("rejects unsupported voice capture mime types", async () => {
    const formData = new FormData();
    formData.append("audio", new File(["audio"], "capture.wav", { type: "audio/wav" }));
    formData.append("mimeType", "audio/wav");

    const response = await postVoiceCapture({
      headers: new Headers({
        Authorization: `Bearer ${auth.bearerToken}`
      }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(400);
    expect(captureVoiceMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.code).toBe("validation_failed");
    expect(payload.error.message).toBe("Unsupported audio type");
  });

  it("rejects oversized voice capture uploads", async () => {
    const largeAudio = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "capture.m4a", {
      type: "audio/mp4"
    });
    const formData = new FormData();
    formData.append("audio", largeAudio);
    formData.append("mimeType", "audio/mp4");

    const response = await postVoiceCapture({
      headers: new Headers({
        Authorization: `Bearer ${auth.bearerToken}`
      }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(413);
    expect(captureVoiceMock).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error.code).toBe("validation_failed");
    expect(payload.error.message).toBe("Audio file is too large");
  });
});
