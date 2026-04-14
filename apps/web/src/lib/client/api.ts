import type {
  ApiEnvelope,
  CreateTaskInput,
  ListTasksQuery,
  MeResponse,
  Task,
  UpdateTaskInput
} from "@todobile/contracts";

export type CaptureDebugInfo = {
  provider: "fallback" | "openai";
  request: unknown;
  rawResponse: unknown;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export function getMe(token: string) {
  return request<MeResponse>("/api/v1/me", {}, token);
}

export function getTasks(query: Partial<ListTasksQuery>, token: string) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });

  return request<{ items: Task[]; nextCursor: string | null }>(
    `/api/v1/tasks?${params.toString()}`,
    {},
    token
  );
}

export function createTask(input: CreateTaskInput, token: string) {
  return request<{ task: Task }>(
    "/api/v1/tasks",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    token
  );
}

export function updateTask(taskId: string, input: UpdateTaskInput, token: string) {
  return request<{ task: Task }>(
    `/api/v1/tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    },
    token
  );
}

export function captureText(input: string, token: string) {
  return request<{ task: Task; debug: CaptureDebugInfo }>(
    "/api/v1/captures/text",
    {
      method: "POST",
      body: JSON.stringify({
        input,
        source: "android_widget_text"
      })
    },
    token
  );
}

export async function captureVoice(audio: Blob, mimeType: string, token: string) {
  const formData = new FormData();
  formData.append("audio", audio, `capture.${mimeType.includes("webm") ? "webm" : "m4a"}`);
  formData.append("source", "android_widget_voice");
  formData.append("mimeType", mimeType);

  const response = await fetch("/api/v1/captures/voice", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const payload = (await response.json()) as ApiEnvelope<{ task: Task; debug: CaptureDebugInfo }>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "Voice capture failed");
  }

  return payload.data;
}
