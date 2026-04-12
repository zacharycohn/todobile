import { z } from "zod";

export const categoryValues = ["buy", "do", "remember", "blocker"] as const;
export const assigneeValues = ["Zac", "Lauryl", "Someone"] as const;
export const statusValues = ["active", "completed", "deleted"] as const;
export const captureSourceValues = [
  "android_widget_text",
  "android_widget_voice",
  "android_app_manual",
  "web_manual"
] as const;

export const categorySchema = z.enum(categoryValues);
export const assigneeSchema = z.enum(assigneeValues);
export const statusSchema = z.enum(statusValues);
export const captureSourceSchema = z.enum(captureSourceValues);
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

export const taskSchema = z.object({
  id: z.string().uuid(),
  familyId: z.string().uuid(),
  details: z.string().min(1),
  category: categorySchema,
  assignee: assigneeSchema,
  status: statusSchema,
  deadlineDate: isoDateSchema.nullable(),
  scheduledDate: isoDateSchema.nullable(),
  urls: z.array(z.string().url()),
  createdAt: z.string().datetime(),
  createdByUserId: z.string().uuid(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable()
});

export const createTaskInputSchema = z.object({
  details: z.string().trim().min(1),
  category: categorySchema,
  assignee: assigneeSchema,
  deadlineDate: isoDateSchema.nullable().optional(),
  scheduledDate: isoDateSchema.nullable().optional(),
  urls: z.array(z.string().url()).default([]),
  source: captureSourceSchema
});

export const updateTaskInputSchema = z.object({
  details: z.string().trim().min(1).optional(),
  category: categorySchema.optional(),
  assignee: assigneeSchema.optional(),
  status: statusSchema.optional(),
  deadlineDate: isoDateSchema.nullable().optional(),
  scheduledDate: isoDateSchema.nullable().optional(),
  urls: z.array(z.string().url()).optional()
});

export const listTasksQuerySchema = z.object({
  view: z.enum(["today", "backlog", "upcoming", "archived"]).default("today"),
  includePartner: z.coerce.boolean().default(false),
  archivedType: z.enum(["completed", "deleted", "all"]).optional(),
  category: categorySchema.optional(),
  assignee: z.string().optional(),
  hasDeadline: z.coerce.boolean().optional(),
  hasScheduledDate: z.coerce.boolean().optional(),
  status: statusSchema.optional(),
  sort: z.enum(["deadlineDate", "scheduledDate", "updatedAt", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  search: z.string().trim().min(1).optional()
});

export const pushTokenInputSchema = z.object({
  platform: z.enum(["android", "web"]),
  pushToken: z.string().min(1),
  deviceId: z.string().trim().min(1).optional(),
  deviceName: z.string().trim().min(1).optional(),
  appVersion: z.string().trim().min(1).optional()
});

export const textCaptureInputSchema = z.object({
  input: z.string().trim().min(1),
  source: captureSourceSchema
});

export const aiTaskExtractionSchema = z.object({
  details: z.string().trim().min(1),
  category: categorySchema,
  assignee: assigneeSchema,
  deadlineDate: isoDateSchema.nullable(),
  scheduledDate: isoDateSchema.nullable(),
  urls: z.array(z.string().url()).default([])
});

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    assigneeKey: z.enum(["Zac", "Lauryl"]),
    familyId: z.string().uuid(),
    familyName: z.string()
  })
});

export type Task = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type PushTokenInput = z.infer<typeof pushTokenInputSchema>;
export type TextCaptureInput = z.infer<typeof textCaptureInputSchema>;
export type AiTaskExtraction = z.infer<typeof aiTaskExtractionSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export type ApiSuccess<T> = {
  data: T;
  error: null;
};

export type ApiFailure = {
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
