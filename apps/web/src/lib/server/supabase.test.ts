import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@todobile/contracts";

const { createClientMock, createAiParserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAiParserMock: vi.fn(() => ({
    parseText: vi.fn(),
    parseVoice: vi.fn()
  }))
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

vi.mock("./task-capture", () => ({
  createAiParser: createAiParserMock
}));

type TaskRow = {
  id: string;
  family_id: string;
  details: string;
  category: Task["category"];
  assignee: Task["assignee"];
  status: Task["status"];
  deadline_date: string | null;
  scheduled_date: string | null;
  urls: string[];
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

const auth = {
  userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
  email: "zac@example.com",
  familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
  displayName: "Zac",
  assigneeKey: "Zac" as const,
  bearerToken: "jwt-token"
};

const rows: TaskRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    family_id: auth.familyId,
    details: "Pick up medicine",
    category: "do",
    assignee: "Zac",
    status: "active",
    deadline_date: "2026-04-14",
    scheduled_date: "2026-04-14",
    urls: [],
    created_at: "2026-04-10T10:00:00.000Z",
    created_by_user_id: auth.userId,
    updated_at: "2026-04-14T08:00:00.000Z",
    completed_at: null,
    deleted_at: null
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    family_id: auth.familyId,
    details: "Buy bread at the store",
    category: "buy",
    assignee: "Lauryl",
    status: "active",
    deadline_date: null,
    scheduled_date: null,
    urls: ["https://store.example.com"],
    created_at: "2026-04-11T10:00:00.000Z",
    created_by_user_id: auth.userId,
    updated_at: "2026-04-13T08:00:00.000Z",
    completed_at: null,
    deleted_at: null
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    family_id: auth.familyId,
    details: "Renew tabs online",
    category: "do",
    assignee: "Zac",
    status: "completed",
    deadline_date: "2026-04-20",
    scheduled_date: null,
    urls: [],
    created_at: "2026-04-09T10:00:00.000Z",
    created_by_user_id: auth.userId,
    updated_at: "2026-04-12T08:00:00.000Z",
    completed_at: "2026-04-12T08:00:00.000Z",
    deleted_at: null
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    family_id: auth.familyId,
    details: "Book summer camp",
    category: "do",
    assignee: "Someone",
    status: "deleted",
    deadline_date: "2026-04-11",
    scheduled_date: null,
    urls: [],
    created_at: "2026-04-08T10:00:00.000Z",
    created_by_user_id: auth.userId,
    updated_at: "2026-04-11T09:00:00.000Z",
    completed_at: null,
    deleted_at: "2026-04-11T09:00:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    details: "Other family task",
    category: "do",
    assignee: "Someone",
    status: "active",
    deadline_date: null,
    scheduled_date: null,
    urls: [],
    created_at: "2026-04-08T10:00:00.000Z",
    created_by_user_id: auth.userId,
    updated_at: "2026-04-11T09:00:00.000Z",
    completed_at: null,
    deleted_at: null
  }
];

function createTaskQueryBuilder(taskRows: TaskRow[]) {
  const filters: Array<(row: TaskRow) => boolean> = [];
  let sortColumn: keyof TaskRow = "updated_at";
  let ascending = true;
  let limitCount = Number.POSITIVE_INFINITY;

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: keyof TaskRow, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    }),
    in: vi.fn((column: keyof TaskRow, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return builder;
    }),
    not: vi.fn((column: keyof TaskRow, operator: string, value: unknown) => {
      if (operator === "is" && value === null) {
        filters.push((row) => row[column] !== null);
      }
      return builder;
    }),
    is: vi.fn((column: keyof TaskRow, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    }),
    ilike: vi.fn((column: keyof TaskRow, pattern: string) => {
      const normalized = pattern.replaceAll("%", "").toLowerCase();
      filters.push((row) => String(row[column]).toLowerCase().includes(normalized));
      return builder;
    }),
    order: vi.fn((column: keyof TaskRow, options?: { ascending?: boolean }) => {
      sortColumn = column;
      ascending = options?.ascending ?? true;
      return builder;
    }),
    limit: vi.fn((count: number) => {
      limitCount = count;
      return builder;
    }),
    then: (resolve: (value: { data: TaskRow[]; error: null }) => unknown) => {
      const filtered = taskRows
        .filter((row) => filters.every((filter) => filter(row)))
        .sort((left, right) => {
          const leftValue = left[sortColumn] ?? "";
          const rightValue = right[sortColumn] ?? "";
          if (leftValue === rightValue) return 0;
          const comparison = leftValue > rightValue ? 1 : -1;
          return ascending ? comparison : -comparison;
        })
        .slice(0, limitCount);

      return Promise.resolve(resolve({ data: filtered, error: null }));
    }
  };

  return builder;
}

async function importSupabaseModule() {
  vi.resetModules();
  vi.doMock("./config", () => ({
    config: {
      nextPublicSupabaseUrl: "https://example.supabase.co",
      nextPublicSupabaseAnonKey: "anon-key",
      supabaseServiceRoleKey: "service-role-key",
      supabaseJwksUrl: "https://example.supabase.co/auth/v1/.well-known/jwks.json",
      openAiApiKey: undefined,
      nextPublicApiBaseUrl: "http://localhost:3000"
    },
    hasSupabaseServiceConfig: () => true
  }));

  return import("./supabase");
}

describe("supabase task repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockImplementation(() => ({
      from: vi.fn((table: string) => {
        if (table === "tasks") {
          return createTaskQueryBuilder(rows);
        }

        throw new Error(`Unexpected table ${table}`);
      })
    }));
  });

  afterEach(() => {
    vi.doUnmock("./config");
  });

  it("returns only active tasks for backlog view", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "backlog",
      includePartner: true,
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ]);
    expect(result.items.every((task) => task.status === "active")).toBe(true);
  });

  it("returns only completed tasks for archived completed view", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "archived",
      archivedType: "completed",
      includePartner: true,
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "33333333-3333-4333-8333-333333333333"
    ]);
  });

  it("returns only deleted tasks for archived deleted view", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "archived",
      archivedType: "deleted",
      includePartner: true,
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "44444444-4444-4444-8444-444444444444"
    ]);
  });

  it("keeps scheduled and overdue active tasks in backlog", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "backlog",
      includePartner: true,
      hasScheduledDate: true,
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "11111111-1111-4111-8111-111111111111"
    ]);
    expect(result.items[0]?.scheduledDate).toBe("2026-04-14");
  });

  it("filters by deadline and search within backlog", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "backlog",
      includePartner: true,
      hasDeadline: true,
      search: "medicine",
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "11111111-1111-4111-8111-111111111111"
    ]);
  });

  it("filters by assignee and category within backlog", async () => {
    const { createRuntimeDependencies } = await importSupabaseModule();
    const dependencies = createRuntimeDependencies();

    const result = await dependencies.tasks.listTasks(auth, {
      view: "backlog",
      includePartner: true,
      assignee: "Lauryl",
      category: "buy",
      order: "desc",
      limit: 25
    });

    expect(result.items.map((task) => task.id)).toEqual([
      "22222222-2222-4222-8222-222222222222"
    ]);
  });
});
