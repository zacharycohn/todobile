import { readFile, writeFile } from "node:fs/promises";

import type { Profile, TaskRepository, DeviceRepository } from "./types";
import type { PushTokenInput, Task, ListTasksQuery } from "@todobile/contracts";

const familyId = "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e";
const demoStorePath = "/tmp/todobile-demo-store.json";

type DemoStore = {
  profiles: Profile[];
  tasks: Task[];
  devices: Array<PushTokenInput & { userId: string; lastSeenAt: string }>;
};

const seedProfiles: Profile[] = [
  {
    id: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
    email: "zac@example.com",
    displayName: "Zac",
    assigneeKey: "Zac",
    familyId,
    familyName: "Cohnobi"
  },
  {
    id: "d9df8b67-c39e-4dcb-9110-662597724ee1",
    email: "lauryl@example.com",
    displayName: "Lauryl",
    assigneeKey: "Lauryl",
    familyId,
    familyName: "Cohnobi"
  }
];

const now = new Date().toISOString();

const seedTasks: Task[] = [
  {
    id: "ef8b69f8-c14d-4a90-bc83-cdb83edebd08",
    familyId,
    details: "Renew tabs",
    category: "do",
    assignee: "Zac",
    status: "active",
    deadlineDate: "2026-04-20",
    scheduledDate: null,
    urls: [],
    createdAt: now,
    createdByUserId: seedProfiles[1].id,
    updatedAt: now,
    completedAt: null,
    deletedAt: null
  },
  {
    id: "af8b69f8-c14d-4a90-bc83-cdb83edebd08",
    familyId,
    details: "Book summer camp",
    category: "do",
    assignee: "Someone",
    status: "active",
    deadlineDate: null,
    scheduledDate: null,
    urls: ["https://camp.example.com"],
    createdAt: now,
    createdByUserId: seedProfiles[0].id,
    updatedAt: now,
    completedAt: null,
    deletedAt: null
  }
];

function createDemoStore(): DemoStore {
  return {
    profiles: seedProfiles.map((profile) => ({ ...profile })),
    tasks: seedTasks.map((task) => ({ ...task, urls: [...task.urls] })),
    devices: []
  };
}

async function readDemoStore(): Promise<DemoStore> {
  try {
    const file = await readFile(demoStorePath, "utf8");
    return JSON.parse(file) as DemoStore;
  } catch {
    const store = createDemoStore();
    await writeDemoStore(store);
    return store;
  }
}

async function writeDemoStore(store: DemoStore) {
  await writeFile(demoStorePath, JSON.stringify(store, null, 2), "utf8");
}

function encodeCursor(task: Task) {
  return Buffer.from(JSON.stringify({ updatedAt: task.updatedAt, id: task.id })).toString(
    "base64url"
  );
}

function applyTaskFilters(
  allTasks: Task[],
  query: ListTasksQuery,
  currentAssignee: "Zac" | "Lauryl"
) {
  const today = new Date().toISOString().slice(0, 10);
  const allowedAssignees = query.assignee?.split(",").map((value) => value.trim()) ?? [];

  return allTasks
    .filter((task) => {
      if (task.status === "deleted" || task.status === "completed") {
        if (query.view !== "archived") {
          return false;
        }

        if (query.archivedType === "completed") {
          return task.status === "completed";
        }

        if (query.archivedType === "deleted") {
          return task.status === "deleted";
        }

        return true;
      }

      if (query.status && task.status !== query.status) {
        return false;
      }

      if (query.category && task.category !== query.category) {
        return false;
      }

      if (allowedAssignees.length > 0 && !allowedAssignees.includes(task.assignee)) {
        return false;
      }

      if (
        !query.includePartner &&
        task.assignee !== currentAssignee &&
        task.assignee !== "Someone"
      ) {
        return false;
      }

      if (query.hasDeadline !== undefined) {
        const hasDeadline = Boolean(task.deadlineDate);
        if (hasDeadline !== query.hasDeadline) {
          return false;
        }
      }

      if (query.hasScheduledDate !== undefined) {
        const hasScheduled = Boolean(task.scheduledDate);
        if (hasScheduled !== query.hasScheduledDate) {
          return false;
        }
      }

      if (query.search && !task.details.toLowerCase().includes(query.search.toLowerCase())) {
        return false;
      }

      if (query.view === "today") {
        return task.scheduledDate === today || (!!task.deadlineDate && task.deadlineDate <= today);
      }

      if (query.view === "backlog") {
        return !task.scheduledDate && !task.deadlineDate;
      }

      if (query.view === "upcoming") {
        return (
          (task.scheduledDate !== null && task.scheduledDate > today) ||
          (task.deadlineDate !== null && task.deadlineDate > today)
        );
      }

      return false;
    })
    .sort((left, right) => {
      const multiplier = query.order === "desc" ? -1 : 1;
      const leftValue = left.updatedAt.localeCompare(right.updatedAt);
      if (leftValue !== 0) {
        return leftValue * multiplier;
      }
      return left.id.localeCompare(right.id) * multiplier;
    });
}

export const demoProfileRepository = {
  async getByUserId(userId: string) {
    const store = await readDemoStore();
    return store.profiles.find((profile) => profile.id === userId) ?? null;
  }
};

export const demoTaskRepository: TaskRepository = {
  async listTasks(auth, query) {
    const store = await readDemoStore();
    const filtered = applyTaskFilters(
      store.tasks.filter((task) => task.familyId === auth.familyId),
      query,
      auth.assigneeKey
    );
    const items = filtered.slice(0, query.limit);
    const nextCursor = filtered.length > query.limit ? encodeCursor(items[items.length - 1]) : null;
    return { items, nextCursor };
  },

  async createTask(auth, input) {
    const store = await readDemoStore();
    const timestamp = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      familyId: auth.familyId,
      details: input.details,
      category: input.category,
      assignee: input.assignee,
      status: "active",
      deadlineDate: input.deadlineDate ?? null,
      scheduledDate: input.scheduledDate ?? null,
      urls: input.urls ?? [],
      createdAt: timestamp,
      createdByUserId: auth.userId,
      updatedAt: timestamp,
      completedAt: null,
      deletedAt: null
    };

    store.tasks.unshift(task);
    await writeDemoStore(store);
    return task;
  },

  async updateTask(auth, taskId, input) {
    const store = await readDemoStore();
    const index = store.tasks.findIndex(
      (task) => task.id === taskId && task.familyId === auth.familyId
    );
    if (index < 0) {
      return null;
    }

    const current = store.tasks[index];
    const timestamp = new Date().toISOString();
    const nextStatus = input.status ?? current.status;

    const updated: Task = {
      ...current,
      ...input,
      deadlineDate:
        input.deadlineDate === undefined ? current.deadlineDate : input.deadlineDate,
      scheduledDate:
        input.scheduledDate === undefined ? current.scheduledDate : input.scheduledDate,
      updatedAt: timestamp,
      status: nextStatus,
      completedAt: nextStatus === "completed" ? timestamp : null,
      deletedAt: nextStatus === "deleted" ? timestamp : null
    };

    if (nextStatus === "active") {
      updated.completedAt = null;
      updated.deletedAt = null;
    }

    store.tasks[index] = updated;
    await writeDemoStore(store);
    return updated;
  }
};

export const demoDeviceRepository: DeviceRepository = {
  async registerPushToken(auth, input: PushTokenInput) {
    const store = await readDemoStore();
    const timestamp = new Date().toISOString();
    const existingIndex = store.devices.findIndex((device) =>
      input.deviceId
        ? device.userId === auth.userId && device.deviceId === input.deviceId
        : device.pushToken === input.pushToken
    );

    if (existingIndex >= 0) {
      store.devices[existingIndex] = {
        ...store.devices[existingIndex],
        ...input,
        userId: auth.userId,
        lastSeenAt: timestamp
      };
    } else {
      store.devices.push({ ...input, userId: auth.userId, lastSeenAt: timestamp });
    }

    await writeDemoStore(store);
    return { registered: true as const };
  }
};
