import {
  captureSourceSchema,
  aiTaskExtractionSchema,
  createTaskInputSchema
} from "@todobile/contracts";

import { config } from "./config";
import { AppError } from "./errors";
import type { AiParseContext, AiTaskParser, RuntimeDependencies } from "./types";

type OpenAiResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type OpenAiTranscriptionPayload = {
  text?: string;
  error?: unknown;
};

function getLosAngelesTodayIso() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date());
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekdayFrom(isoDate: string, weekday: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const currentWeekday = date.getUTCDay();
  let offset = (weekday - currentWeekday + 7) % 7;
  if (offset === 0) {
    offset = 7;
  }
  return addDays(isoDate, offset);
}

function nextDayOfMonthFrom(isoDate: string, dayOfMonth: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, dayOfMonth));

  if (dayOfMonth < day) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }

  return candidate.toISOString().slice(0, 10);
}

function buildTaskExtractionPrompt(currentUserName: "Zac" | "Lauryl") {
  const todayIso = getLosAngelesTodayIso();
  const nextTuesdayIso = nextWeekdayFrom(todayIso, 2);
  const twentiethIso = nextDayOfMonthFrom(todayIso, 20);

  return [
    "Extract exactly one household task as JSON with keys details, category, assignee, deadlineDate, scheduledDate, urls.",
    `Today is ${todayIso} in America/Los_Angeles.`,
    `The authenticated user for this request is ${currentUserName}.`,
    "details must be a short verb phrase that removes assignee names, possessives, and date phrases when those are represented in other fields.",
    "Keep the object of the task, and normalize wording into a concise task title.",
    "Good details examples: 'Pick up medicine', 'Buy bread', 'Take Shadow to daycare'.",
    "Use this assignee precedence order: explicit named person first, then clear first-person references from the authenticated user, otherwise Someone.",
    `If the user uses first-person references like 'I', 'I'll', 'I'd', 'me', 'my', 'mine', 'we', 'we'll', or 'our' and does not explicitly assign the task to someone else, assignee should be ${currentUserName}.`,
    `assignee should be Zac if the text explicitly mentions Zac or Zac's, Lauryl if the text explicitly mentions Lauryl or Lauryl's, ${currentUserName} for unambiguous first-person references from the authenticated user, otherwise Someone.`,
    "category should be buy for shopping or purchasing, do for errands/actions/appointments/transport/pickups/dropoffs, remember for reminders, blocker for blocked or waiting tasks.",
    `scheduledDate is the date to do the task on; resolve relative dates using today=${todayIso}. For example, 'next Tuesday' should become ${nextTuesdayIso}, and 'on the 20th' should become ${twentiethIso}.`,
    "deadlineDate is only for due/by/before/no-later-than phrasing, not simply when the task should happen.",
    "If no date is implied, return null dates.",
    "urls should contain only URLs found in the text.",
    `Example: if ${currentUserName} says 'I need to pick up my medicine next Tuesday', return assignee='${currentUserName}' and scheduledDate='${nextTuesdayIso}'.`
  ].join(" ");
}

function inferAssignee(input: string) {
  const normalized = input.toLowerCase();
  if (normalized.includes("lauryl")) return "Lauryl";
  if (normalized.includes("zac")) return "Zac";
  return "Someone";
}

function inferCategory(input: string) {
  const normalized = input.toLowerCase();
  if (normalized.includes("buy") || normalized.includes("purchase")) return "buy";
  if (normalized.includes("remember")) return "remember";
  if (normalized.includes("blocked") || normalized.includes("waiting")) return "blocker";
  return "do";
}

function parseDate(input: string) {
  const match = input.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function createFallbackParser(): AiTaskParser {
  return {
    async parseText(input, context) {
      const parsed = aiTaskExtractionSchema.parse({
        details: input.trim().replace(/\s+/g, " ").replace(/^./, (value) => value.toUpperCase()),
        category: inferCategory(input),
        assignee: inferAssignee(input),
        deadlineDate: parseDate(input),
        scheduledDate: null,
        urls: [...input.matchAll(/https?:\/\/\S+/g)].map((match) => match[0])
      });

      return {
        task: parsed,
        debug: {
          provider: "fallback",
          request: {
            mode: "text",
            input,
            currentUserName: context.currentUserName
          },
          rawResponse: parsed
        }
      };
    },

    async parseVoice(file, context) {
      return this.parseText(`Follow up on audio capture: ${file.name}`, context);
    }
  };
}

function createOpenAiParser(): AiTaskParser {
  const fallback = createFallbackParser();
  const requestBodyFor = (input: string, context: AiParseContext) => ({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: buildTaskExtractionPrompt(context.currentUserName)
      },
      { role: "user", content: input }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "task_extraction",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "details",
            "category",
            "assignee",
            "deadlineDate",
            "scheduledDate",
            "urls"
          ],
          properties: {
            details: { type: "string" },
            category: { type: "string", enum: ["buy", "do", "remember", "blocker"] },
            assignee: { type: "string", enum: ["Zac", "Lauryl", "Someone"] },
            deadlineDate: { type: ["string", "null"] },
            scheduledDate: { type: ["string", "null"] },
            urls: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    }
  });

  function extractOutputText(payload: OpenAiResponsesApiPayload) {
    if (payload.output_text && payload.output_text.trim().length > 0) {
      return payload.output_text;
    }

    for (const item of payload.output ?? []) {
      for (const contentItem of item.content ?? []) {
        if (contentItem.type === "output_text" && contentItem.text) {
          return contentItem.text;
        }
      }
    }

    return null;
  }

  async function extractTaskFromText(input: string, context: AiParseContext) {
    const requestBody = requestBodyFor(input, context);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    const payload = (await response.json()) as OpenAiResponsesApiPayload & {
      error?: unknown;
      status?: string;
    };

    if (!response.ok) {
      throw new AppError("task_creation_failed", "Failed to create task", 500, {
        reason: "openai_request_failed",
        openai: payload.error ?? payload
      });
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      throw new AppError("task_creation_failed", "Failed to create task", 500, {
        reason: "missing_openai_output_text",
        openai: payload
      });
    }

    return {
      task: aiTaskExtractionSchema.parse(JSON.parse(outputText)),
      request: requestBody,
      response: payload
    };
  }

  return {
    async parseText(input: string, context: AiParseContext) {
      if (!config.openAiApiKey) {
        return fallback.parseText(input, context);
      }
      const extracted = await extractTaskFromText(input, context);

      return {
        task: extracted.task,
        debug: {
          provider: "openai",
          request: extracted.request,
          rawResponse: extracted.response
        }
      };
    },

    async parseVoice(file: File, context: AiParseContext, mimeType?: string | null) {
      if (!config.openAiApiKey) {
        return fallback.parseText(`${mimeType ?? "audio"} ${file.name}`, context);
      }

      const transcriptionForm = new FormData();
      transcriptionForm.append("file", file, file.name);
      transcriptionForm.append("model", "gpt-4o-mini-transcribe");

      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`
        },
        body: transcriptionForm
      });

      const transcriptionPayload =
        (await transcriptionResponse.json()) as OpenAiTranscriptionPayload;

      if (!transcriptionResponse.ok || !transcriptionPayload.text) {
        throw new AppError("task_creation_failed", "Failed to create task", 500, {
          reason: "openai_transcription_failed",
          openai: transcriptionPayload
        });
      }

      const extracted = await extractTaskFromText(transcriptionPayload.text, context);

      return {
        task: extracted.task,
        debug: {
          provider: "openai",
          request: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
              mimeType: mimeType ?? file.type,
              fileName: file.name
            },
            extraction: extracted.request
          },
          rawResponse: {
            transcription: transcriptionPayload,
            extraction: extracted.response
          }
        }
      };
    }
  };
}

export function createAiParser() {
  return createOpenAiParser();
}

export async function runTextCapture(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  input: string
) {
  const extracted = await dependencies.ai.parseText(input, {
    currentUserName: auth.assigneeKey
  });
  const taskInput = createTaskInputSchema.parse({
    ...extracted.task,
    source: "android_widget_text"
  });
  const task = await dependencies.tasks.createTask(auth, taskInput);
  return {
    task,
    debug: extracted.debug
  };
}

export async function runVoiceCapture(
  dependencies: RuntimeDependencies,
  auth: Awaited<ReturnType<typeof import("./auth").requireAuth>>,
  file: File,
  mimeType?: string | null,
  source = captureSourceSchema.parse("android_widget_voice")
) {
  const extracted = await dependencies.ai.parseVoice(
    file,
    {
      currentUserName: auth.assigneeKey
    },
    mimeType
  );
  const taskInput = createTaskInputSchema.parse({
    ...extracted.task,
    source
  });
  const task = await dependencies.tasks.createTask(auth, taskInput);
  return {
    task,
    debug: extracted.debug
  };
}
