import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestConfig = {
  nextPublicSupabaseUrl: string | undefined;
  nextPublicSupabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  supabaseJwksUrl: string | undefined;
  openAiApiKey: string | undefined;
  pushProviderApiKey: string | undefined;
  nextPublicApiBaseUrl: string;
  nextPublicEnableDemoAuth: boolean;
};

const baseConfig: TestConfig = {
  nextPublicSupabaseUrl: undefined,
  nextPublicSupabaseAnonKey: undefined,
  supabaseServiceRoleKey: undefined,
  supabaseJwksUrl: undefined,
  openAiApiKey: undefined,
  pushProviderApiKey: undefined,
  nextPublicApiBaseUrl: "http://localhost:3000",
  nextPublicEnableDemoAuth: true
};

async function importNotifications(pushProviderApiKey?: string) {
  vi.resetModules();
  vi.doMock("./config", () => ({
    config: {
      ...baseConfig,
      pushProviderApiKey
    }
  }));

  return import("./notifications");
}

const auth = {
  userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  email: "zac@example.com",
  familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
  displayName: "Zac",
  assigneeKey: "Zac" as const,
  bearerToken: "demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
};

const task = {
  id: "task-1",
  familyId: auth.familyId,
  details: "Book summer camp",
  category: "do" as const,
  assignee: "Someone" as const,
  status: "active" as const,
  deadlineDate: null,
  scheduledDate: null,
  urls: [],
  createdAt: "2026-04-11T17:00:00.000Z",
  createdByUserId: auth.userId,
  updatedAt: "2026-04-11T17:00:00.000Z",
  completedAt: null,
  deletedAt: null
};

describe("notification service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.doUnmock("./config");
  });

  it("logs skipped notifications when the push provider is not configured", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { createNotificationService } = await importNotifications();
    const service = createNotificationService();

    await service.notifyTaskCreated(task, auth);

    expect(infoSpy).toHaveBeenCalledWith("push.notification.skipped", {
      reason: "missing_provider_key",
      taskId: "task-1",
      assignee: "Someone",
      actor: auth.userId
    });
  });

  it("logs sent notifications when the push provider is configured", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { createNotificationService } = await importNotifications("push-key");
    const service = createNotificationService();

    await service.notifyTaskCreated(task, auth);

    expect(infoSpy).toHaveBeenCalledWith("push.notification.sent", {
      kind: "task_created",
      taskId: "task-1",
      assignee: "Someone"
    });
  });

  it("logs capture failures", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { createNotificationService } = await importNotifications();
    const service = createNotificationService();

    await service.notifyCaptureFailed(auth, "openai_request_failed");

    expect(warnSpy).toHaveBeenCalledWith("push.notification.capture_failed", {
      userId: auth.userId,
      reason: "openai_request_failed"
    });
  });
});
