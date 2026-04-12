import { describe, expect, it, vi } from "vitest";
import type { Task } from "@todobile/contracts";
import type { AiParseResult } from "./types";

import { captureText, captureVoice, createTask, listTasks, updateTask } from "./services";
import type { RuntimeDependencies } from "./types";

const auth = {
  userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  email: "zac@example.com",
  familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
  displayName: "Zac",
  assigneeKey: "Zac" as const,
  bearerToken: "test-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
};

function createDependencies(): RuntimeDependencies {
  const now = new Date().toISOString();

  return {
    profiles: {
      getByUserId: vi.fn(async () => ({
        id: auth.userId,
        email: auth.email,
        displayName: auth.displayName,
        assigneeKey: "Zac" as const,
        familyId: auth.familyId,
        familyName: "Cohnobi"
      }))
    },
    tasks: {
      listTasks: vi.fn(async () => ({ items: [], nextCursor: null })),
      createTask: vi.fn(async (_auth, input): Promise<Task> => ({
        id: "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
        familyId: auth.familyId,
        details: input.details,
        category: input.category,
        assignee: input.assignee,
        status: "active" as const,
        deadlineDate: input.deadlineDate ?? null,
        scheduledDate: input.scheduledDate ?? null,
        urls: input.urls,
        createdAt: now,
        createdByUserId: auth.userId,
        updatedAt: now,
        completedAt: null,
        deletedAt: null
      })),
      updateTask: vi.fn(async (_auth, taskId, input): Promise<Task> => ({
        id: taskId,
        familyId: auth.familyId,
        details: input.details ?? "Book summer camp",
        category: input.category ?? "do",
        assignee: input.assignee ?? "Someone",
        status: input.status ?? "active",
        deadlineDate: input.deadlineDate ?? null,
        scheduledDate: input.scheduledDate ?? null,
        urls: input.urls ?? [],
        createdAt: now,
        createdByUserId: auth.userId,
        updatedAt: now,
        completedAt: input.status === "completed" ? now : null,
        deletedAt: input.status === "deleted" ? now : null
      }))
    },
    devices: {
      registerPushToken: vi.fn(async () => ({ registered: true as const }))
    },
    ai: {
      parseText: vi.fn(async (): Promise<AiParseResult> => ({
        task: {
          details: "Renew tabs",
          category: "do",
          assignee: "Zac",
          deadlineDate: "2026-04-20",
          scheduledDate: null,
          urls: []
        },
        debug: {
          provider: "openai",
          request: { input: "renew tabs by 2026-04-20" },
          rawResponse: { output_text: "{\"details\":\"Renew tabs\"}" }
        }
      })),
      parseVoice: vi.fn(async (): Promise<AiParseResult> => ({
        task: {
          details: "Audio follow up",
          category: "do",
          assignee: "Someone",
          deadlineDate: null,
          scheduledDate: null,
          urls: []
        },
        debug: {
          provider: "fallback",
          request: { filename: "voice.m4a" },
          rawResponse: { details: "Audio follow up" }
        }
      }))
    },
    notifications: {
      notifyTaskCreated: vi.fn(async () => undefined),
      notifyCaptureFailed: vi.fn(async () => undefined)
    }
  };
}

describe("server services", () => {
  it("creates manual tasks", async () => {
    const dependencies = createDependencies();
    const result = await createTask(dependencies, auth, {
      details: "Book summer camp",
      category: "do",
      assignee: "Someone",
      deadlineDate: null,
      scheduledDate: null,
      urls: [],
      source: "web_manual"
    });

    expect(result.task.details).toBe("Book summer camp");
    expect(dependencies.notifications.notifyTaskCreated).toHaveBeenCalledTimes(1);
  });

  it("lists tasks with normalized query params", async () => {
    const dependencies = createDependencies();
    await listTasks(
      dependencies,
      auth,
      new URLSearchParams({ view: "today", includePartner: "true", limit: "10" })
    );
    expect(dependencies.tasks.listTasks).toHaveBeenCalledTimes(1);
  });

  it("updates task status", async () => {
    const dependencies = createDependencies();
    const result = await updateTask(dependencies, auth, "task-1", {
      status: "completed"
    });

    expect(result.task.status).toBe("completed");
  });

  it("creates exactly one task from text capture", async () => {
    const dependencies = createDependencies();
    const result = await captureText(dependencies, auth, "renew tabs by 2026-04-20");

    expect(result.task.details).toBe("Renew tabs");
    expect(result.debug.provider).toBe("openai");
    expect(dependencies.ai.parseText).toHaveBeenCalledTimes(1);
    expect(dependencies.ai.parseText).toHaveBeenCalledWith("renew tabs by 2026-04-20", {
      currentUserName: "Zac"
    });
  });

  it("creates exactly one task from voice capture", async () => {
    const dependencies = createDependencies();
    const file = new File(["audio"], "voice.webm", { type: "audio/webm" });
    const result = await captureVoice(dependencies, auth, file, "audio/webm");

    expect(result.task.details).toBe("Audio follow up");
    expect(result.debug.provider).toBe("fallback");
    expect(dependencies.ai.parseVoice).toHaveBeenCalledTimes(1);
    expect(dependencies.ai.parseVoice).toHaveBeenCalledWith(file, {
      currentUserName: "Zac"
    }, "audio/webm");
  });
});
