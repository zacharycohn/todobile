import { createClient } from "@supabase/supabase-js";

import type { CreateTaskInput, ListTasksQuery, Task, UpdateTaskInput } from "@todobile/contracts";

import { config, hasSupabaseServiceConfig } from "./config";
import { AppError } from "./errors";
import type { AuthContext, Profile, ProfileRepository, RuntimeDependencies, TaskRepository } from "./types";
import { createAiParser } from "./task-capture";

type SupabaseTaskRow = {
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

function mapTask(row: SupabaseTaskRow): Task {
  return {
    id: row.id,
    familyId: row.family_id,
    details: row.details,
    category: row.category,
    assignee: row.assignee,
    status: row.status,
    deadlineDate: row.deadline_date,
    scheduledDate: row.scheduled_date,
    urls: row.urls ?? [],
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at
  };
}

function mapSortColumn(sort: ListTasksQuery["sort"]): keyof SupabaseTaskRow {
  switch (sort) {
    case "deadlineDate":
      return "deadline_date";
    case "scheduledDate":
      return "scheduled_date";
    case "createdAt":
      return "created_at";
    case "updatedAt":
    default:
      return "updated_at";
  }
}

function createSupabaseRepositories(): Pick<RuntimeDependencies, "profiles" | "tasks"> {
  if (!hasSupabaseServiceConfig()) {
    throw new AppError("supabase_not_configured", "Supabase service configuration is missing", 500);
  }

  const client = createClient(config.nextPublicSupabaseUrl!, config.supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const profiles: ProfileRepository = {
    async getByUserId(userId: string) {
      const { data, error } = await client
        .from("profiles")
        .select("id,email,display_name,assignee_key,family_id,families(name)")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw new AppError("profile_lookup_failed", "Failed to load profile", 500);
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        assigneeKey: data.assignee_key,
        familyId: data.family_id,
        familyName: Array.isArray(data.families) ? data.families[0]?.name ?? "Family" : (data.families as { name?: string } | null)?.name ?? "Family"
      } satisfies Profile;
    }
  };

  const tasks: TaskRepository = {
    async listTasks(auth: AuthContext, query: ListTasksQuery) {
      let request = client.from("tasks").select("*").eq("family_id", auth.familyId);

      if (query.view === "backlog") {
        request = request.eq("status", "active");
      } else if (query.archivedType === "completed") {
        request = request.eq("status", "completed");
      } else if (query.archivedType === "deleted") {
        request = request.eq("status", "deleted");
      } else {
        request = request.in("status", ["completed", "deleted"]);
      }

      if (query.status) {
        request = request.eq("status", query.status);
      }

      if (query.category) {
        request = request.eq("category", query.category);
      }

      if (query.assignee) {
        const assignees = query.assignee
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

        if (assignees.length === 1) {
          request = request.eq("assignee", assignees[0]);
        } else if (assignees.length > 1) {
          request = request.in("assignee", assignees);
        }
      }

      if (query.hasDeadline === true) {
        request = request.not("deadline_date", "is", null);
      } else if (query.hasDeadline === false) {
        request = request.is("deadline_date", null);
      }

      if (query.hasScheduledDate === true) {
        request = request.not("scheduled_date", "is", null);
      } else if (query.hasScheduledDate === false) {
        request = request.is("scheduled_date", null);
      }

      if (query.search) {
        request = request.ilike("details", `%${query.search}%`);
      }

      const { data, error } = await request
        .order(mapSortColumn(query.sort), { ascending: query.order === "asc" })
        .limit(Math.min(query.limit + 1, 101));

      if (error) {
        throw new AppError("task_list_failed", "Failed to load tasks", 500);
      }
      const supabaseItems = (data as SupabaseTaskRow[] | null)?.map(mapTask) ?? [];
      return {
        items: supabaseItems.slice(0, query.limit),
        nextCursor: supabaseItems.length > query.limit ? supabaseItems[query.limit].id : null
      };
    },

    async createTask(auth: AuthContext, input: Omit<CreateTaskInput, "source">) {
      const payload = {
        family_id: auth.familyId,
        details: input.details,
        category: input.category,
        assignee: input.assignee,
        status: "active",
        deadline_date: input.deadlineDate ?? null,
        scheduled_date: input.scheduledDate ?? null,
        urls: input.urls ?? [],
        created_by_user_id: auth.userId
      };

      const { data, error } = await client.from("tasks").insert(payload).select("*").single();
      if (error) {
        throw new AppError("task_creation_failed", "Failed to create task", 500, {
          reason: error.message
        });
      }
      return mapTask(data as SupabaseTaskRow);
    },

    async updateTask(auth: AuthContext, taskId: string, input: UpdateTaskInput) {
      const patch = {
        ...(input.details !== undefined ? { details: input.details } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
        ...(input.deadlineDate !== undefined ? { deadline_date: input.deadlineDate } : {}),
        ...(input.scheduledDate !== undefined ? { scheduled_date: input.scheduledDate } : {}),
        ...(input.urls !== undefined ? { urls: input.urls } : {})
      } as Record<string, unknown>;

      const nextStatus = input.status;
      if (nextStatus) {
        patch.status = nextStatus;
        patch.completed_at = nextStatus === "completed" ? new Date().toISOString() : null;
        patch.deleted_at = nextStatus === "deleted" ? new Date().toISOString() : null;
        if (nextStatus === "active") {
          patch.completed_at = null;
          patch.deleted_at = null;
        }
      }

      const { data, error } = await client
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("family_id", auth.familyId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new AppError("task_update_failed", "Failed to update task", 500, {
          reason: error.message
        });
      }

      return data ? mapTask(data as SupabaseTaskRow) : null;
    }
  };
  return { profiles, tasks };
}

export function createRuntimeDependencies(): RuntimeDependencies {
  const repositories = createSupabaseRepositories();
  return {
    ...repositories,
    ai: createAiParser()
  };
}
