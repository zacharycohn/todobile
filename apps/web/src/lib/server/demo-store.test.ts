import { beforeEach, describe, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import type { PushTokenInput, Task } from "@todobile/contracts";

import {
  demoDeviceRepository,
  demoProfileRepository,
  demoTaskRepository
} from "./demo-store";

const demoStorePath = "/tmp/todobile-demo-store.json";
const familyId = "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e";

const auth = {
  userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  email: "zac@example.com",
  familyId,
  displayName: "Zac",
  assigneeKey: "Zac" as const,
  bearerToken: "demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
};

const baseProfiles = [
  {
    id: auth.userId,
    email: auth.email,
    displayName: auth.displayName,
    assigneeKey: "Zac" as const,
    familyId,
    familyName: "Cohnobi"
  },
  {
    id: "d9df8b67-c39e-4dcb-9110-662597724ee1",
    email: "lauryl@example.com",
    displayName: "Lauryl",
    assigneeKey: "Lauryl" as const,
    familyId,
    familyName: "Cohnobi"
  }
];

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    familyId,
    details: "Task",
    category: "do",
    assignee: "Zac",
    status: "active",
    deadlineDate: null,
    scheduledDate: null,
    urls: [],
    createdAt: "2026-04-11T17:00:00.000Z",
    createdByUserId: auth.userId,
    updatedAt: "2026-04-11T17:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    ...overrides
  };
}

async function seedStore(tasks: Task[], devices: Array<PushTokenInput & { userId: string; lastSeenAt: string }> = []) {
  await writeFile(
    demoStorePath,
    JSON.stringify(
      {
        profiles: baseProfiles,
        tasks,
        devices
      },
      null,
      2
    ),
    "utf8"
  );
}

async function readStore() {
  return JSON.parse(await readFile(demoStorePath, "utf8")) as {
    profiles: typeof baseProfiles;
    tasks: Task[];
    devices: Array<PushTokenInput & { userId: string; lastSeenAt: string }>;
  };
}

describe("demo store repositories", () => {
  beforeEach(async () => {
    await seedStore([
      makeTask("today-due", {
        details: "Renew tabs",
        assignee: "Zac",
        deadlineDate: "2026-04-11",
        updatedAt: "2026-04-11T09:00:00.000Z"
      }),
      makeTask("backlog-shared", {
        details: "Book summer camp",
        assignee: "Someone",
        updatedAt: "2026-04-11T10:00:00.000Z"
      }),
      makeTask("upcoming-lauryl", {
        details: "Take Shadow to daycare",
        assignee: "Lauryl",
        scheduledDate: "2026-04-14",
        updatedAt: "2026-04-11T11:00:00.000Z"
      }),
      makeTask("completed-task", {
        details: "Buy groceries",
        assignee: "Zac",
        status: "completed",
        completedAt: "2026-04-11T12:00:00.000Z",
        updatedAt: "2026-04-11T12:00:00.000Z"
      }),
      makeTask("deleted-task", {
        details: "Old reminder",
        assignee: "Someone",
        status: "deleted",
        deletedAt: "2026-04-11T13:00:00.000Z",
        updatedAt: "2026-04-11T13:00:00.000Z"
      })
    ]);
  });

  it("loads demo profiles by user id", async () => {
    await expect(demoProfileRepository.getByUserId(auth.userId)).resolves.toMatchObject({
      displayName: "Zac",
      assigneeKey: "Zac"
    });
  });

  it("filters today, backlog, upcoming, and archived views correctly", async () => {
    const today = await demoTaskRepository.listTasks(auth, {
      view: "today",
      includePartner: true,
      order: "asc",
      limit: 25
    });
    const backlog = await demoTaskRepository.listTasks(auth, {
      view: "backlog",
      includePartner: false,
      order: "asc",
      limit: 25
    });
    const upcoming = await demoTaskRepository.listTasks(auth, {
      view: "upcoming",
      includePartner: true,
      order: "asc",
      limit: 25
    });
    const archived = await demoTaskRepository.listTasks(auth, {
      view: "archived",
      includePartner: true,
      archivedType: "completed",
      order: "asc",
      limit: 25
    });

    expect(today.items.map((task) => task.id)).toEqual(["today-due"]);
    expect(backlog.items.map((task) => task.id)).toEqual(["backlog-shared"]);
    expect(upcoming.items.map((task) => task.id)).toEqual(["upcoming-lauryl"]);
    expect(archived.items.map((task) => task.id)).toEqual(["completed-task"]);
  });

  it("applies assignee, category, deadline, scheduled, search, and sort filters", async () => {
    await seedStore([
      makeTask("buy-zac", {
        details: "Buy bread",
        category: "buy",
        assignee: "Zac",
        deadlineDate: "2026-04-20",
        updatedAt: "2026-04-11T08:00:00.000Z"
      }),
      makeTask("buy-someone", {
        details: "Buy paper towels",
        category: "buy",
        assignee: "Someone",
        updatedAt: "2026-04-11T09:00:00.000Z"
      }),
      makeTask("do-zac", {
        details: "Take Shadow to daycare",
        category: "do",
        assignee: "Zac",
        scheduledDate: "2026-04-20",
        updatedAt: "2026-04-11T10:00:00.000Z"
      })
    ]);

    const filtered = await demoTaskRepository.listTasks(auth, {
      view: "upcoming",
      includePartner: true,
      assignee: "Zac",
      category: "do",
      hasScheduledDate: true,
      search: "shadow",
      order: "desc",
      limit: 25
    });

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.id).toBe("do-zac");
  });

  it("creates a task and persists it to the file-backed store", async () => {
    const created = await demoTaskRepository.createTask(auth, {
      details: "Schedule dentist",
      category: "do",
      assignee: "Zac",
      deadlineDate: null,
      scheduledDate: "2026-04-15",
      urls: ["https://calendar.example.com"]
    });

    expect(created.status).toBe("active");
    const store = await readStore();
    expect(store.tasks[0]?.details).toBe("Schedule dentist");
    expect(store.tasks[0]?.scheduledDate).toBe("2026-04-15");
  });

  it("updates tasks, including reopen semantics", async () => {
    const completed = await demoTaskRepository.updateTask(auth, "backlog-shared", {
      status: "completed"
    });
    const reopened = await demoTaskRepository.updateTask(auth, "backlog-shared", {
      status: "active"
    });

    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).not.toBeNull();
    expect(reopened?.status).toBe("active");
    expect(reopened?.completedAt).toBeNull();
    expect(reopened?.deletedAt).toBeNull();
  });

  it("registers and updates push tokens by device id", async () => {
    await demoDeviceRepository.registerPushToken(auth, {
      platform: "android",
      pushToken: "ExponentPushToken[first]",
      deviceId: "device-1",
      deviceName: "Pixel"
    });
    await demoDeviceRepository.registerPushToken(auth, {
      platform: "android",
      pushToken: "ExponentPushToken[updated]",
      deviceId: "device-1",
      appVersion: "1.2.3"
    });

    const store = await readStore();
    expect(store.devices).toHaveLength(1);
    expect(store.devices[0]).toMatchObject({
      pushToken: "ExponentPushToken[updated]",
      deviceId: "device-1",
      appVersion: "1.2.3"
    });
  });
});
