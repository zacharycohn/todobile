import {
  createTaskInputSchema,
  listTasksQuerySchema,
  pushTokenInputSchema,
  updateTaskInputSchema
} from "@todobile/contracts";

import { AppError } from "./errors";
import { runTextCapture, runVoiceCapture } from "./task-capture";
import type { RuntimeDependencies } from "./types";

export async function getCurrentUser(dependencies: RuntimeDependencies, auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>) {
  const profile = await dependencies.profiles.getByUserId(auth.userId);
  if (!profile) {
    throw new AppError("profile_not_found", "Profile not found", 404);
  }
  return { user: profile };
}

export async function listTasks(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  rawQuery: URLSearchParams
) {
  const query = listTasksQuerySchema.parse(Object.fromEntries(rawQuery.entries()));
  return dependencies.tasks.listTasks(auth, query);
}

export async function createTask(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  input: unknown
) {
  const parsed = createTaskInputSchema.parse(input);
  const task = await dependencies.tasks.createTask(auth, parsed);
  await dependencies.notifications.notifyTaskCreated(task, auth);
  return { task };
}

export async function updateTask(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  taskId: string,
  input: unknown
) {
  const parsed = updateTaskInputSchema.parse(input);
  const task = await dependencies.tasks.updateTask(auth, taskId, parsed);
  if (!task) {
    throw new AppError("not_found", "Task not found", 404);
  }
  return { task };
}

export async function registerPushToken(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  input: unknown
) {
  return dependencies.devices.registerPushToken(auth, pushTokenInputSchema.parse(input));
}

export async function captureText(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  input: string
) {
  return await runTextCapture(dependencies, auth, input);
}

export async function captureVoice(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  file: File,
  mimeType?: string | null
) {
  return await runVoiceCapture(dependencies, auth, file, mimeType);
}
