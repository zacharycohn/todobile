import { createClient } from "@supabase/supabase-js";

import type { PushTokenInput, CreateTaskInput, ListTasksQuery, Task, UpdateTaskInput } from "@todobile/contracts";

import { config, hasSupabaseServiceConfig } from "./config";
import { AppError } from "./errors";
import { demoDeviceRepository, demoProfileRepository, demoTaskRepository } from "./demo-store";
import type { AuthContext, DeviceRepository, Profile, ProfileRepository, RuntimeDependencies, TaskRepository } from "./types";
import { createAiParser } from "./task-capture";
import { createNotificationService } from "./notifications";

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

function isDemoAuth(auth: AuthContext) {
  return (
    auth.bearerToken.startsWith("demo-user:") || auth.bearerToken.startsWith("test-user:")
  );
}

function createSupabaseRepositories(): Pick<RuntimeDependencies, "profiles" | "tasks" | "devices"> {
  if (!hasSupabaseServiceConfig()) {
    return {
      profiles: demoProfileRepository,
      tasks: demoTaskRepository,
      devices: demoDeviceRepository
    };
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
      if (isDemoAuth(auth)) {
        return demoTaskRepository.listTasks(auth, query);
      }

      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("family_id", auth.familyId)
        .limit(Math.min(query.limit + 1, 101))
        .order("updated_at", { ascending: query.order === "asc" });

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
      if (isDemoAuth(auth)) {
        return demoTaskRepository.createTask(auth, input);
      }

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
      if (isDemoAuth(auth)) {
        return demoTaskRepository.updateTask(auth, taskId, input);
      }

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

  const devices: DeviceRepository = {
    async registerPushToken(auth: AuthContext, input: PushTokenInput) {
      const matchField = input.deviceId ? "device_id" : "push_token";
      const matchValue = input.deviceId ?? input.pushToken;
      const { data: existing } = await client
        .from("devices")
        .select("id")
        .eq("user_id", auth.userId)
        .eq(matchField, matchValue)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await client
          .from("devices")
          .update({
            platform: input.platform,
            push_token: input.pushToken,
            device_id: input.deviceId ?? null,
            device_name: input.deviceName ?? null,
            app_version: input.appVersion ?? null,
            last_seen_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) {
          throw new AppError("device_registration_failed", "Failed to update push token", 500);
        }
      } else {
        const { error } = await client.from("devices").insert({
          user_id: auth.userId,
          platform: input.platform,
          push_token: input.pushToken,
          device_id: input.deviceId ?? null,
          device_name: input.deviceName ?? null,
          app_version: input.appVersion ?? null
        });

        if (error) {
          throw new AppError("device_registration_failed", "Failed to register push token", 500);
        }
      }

      return { registered: true as const };
    }
  };

  return { profiles, tasks, devices };
}

export function createRuntimeDependencies(): RuntimeDependencies {
  const repositories = createSupabaseRepositories();
  return {
    ...repositories,
    ai: createAiParser(),
    notifications: createNotificationService()
  };
}
