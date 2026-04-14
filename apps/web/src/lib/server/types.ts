import type {
  AiTaskExtraction,
  CreateTaskInput,
  ListTasksQuery,
  MeResponse,
  Task,
  UpdateTaskInput
} from "@todobile/contracts";

export type Profile = MeResponse["user"];

export type AuthContext = {
  userId: string;
  email: string;
  familyId: string;
  displayName: string;
  assigneeKey: "Zac" | "Lauryl";
  bearerToken: string;
};

export type ListTasksResult = {
  items: Task[];
  nextCursor: string | null;
};

export type CaptureDebugInfo = {
  provider: "fallback" | "openai";
  request: unknown;
  rawResponse: unknown;
};

export type AiParseResult = {
  task: AiTaskExtraction;
  debug: CaptureDebugInfo;
};

export type AiParseContext = {
  currentUserName: "Zac" | "Lauryl";
};

export interface ProfileRepository {
  getByUserId(userId: string): Promise<Profile | null>;
}

export interface TaskRepository {
  listTasks(auth: AuthContext, query: ListTasksQuery): Promise<ListTasksResult>;
  createTask(auth: AuthContext, input: Omit<CreateTaskInput, "source">): Promise<Task>;
  updateTask(auth: AuthContext, taskId: string, input: UpdateTaskInput): Promise<Task | null>;
}

export interface AiTaskParser {
  parseText(input: string, context: AiParseContext): Promise<AiParseResult>;
  parseVoice(file: File, context: AiParseContext, mimeType?: string | null): Promise<AiParseResult>;
}

export type RuntimeDependencies = {
  profiles: ProfileRepository;
  tasks: TaskRepository;
  ai: AiTaskParser;
};
