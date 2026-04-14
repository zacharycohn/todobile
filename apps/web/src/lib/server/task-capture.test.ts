import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "./errors";

type TestConfig = {
  nextPublicSupabaseUrl: string | undefined;
  nextPublicSupabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  supabaseJwksUrl: string | undefined;
  openAiApiKey: string | undefined;
  nextPublicApiBaseUrl: string;
};

const baseConfig: TestConfig = {
  nextPublicSupabaseUrl: undefined,
  nextPublicSupabaseAnonKey: undefined,
  supabaseServiceRoleKey: undefined,
  supabaseJwksUrl: undefined,
  openAiApiKey: undefined,
  nextPublicApiBaseUrl: "http://localhost:3000"
};

async function importTaskCapture(configOverrides: Partial<TestConfig> = {}) {
  vi.resetModules();
  vi.doMock("./config", () => ({
    config: {
      ...baseConfig,
      ...configOverrides
    }
  }));

  return import("./task-capture");
}

describe("task capture", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.doUnmock("./config");
  });

  it("uses the fallback parser when no OpenAI key is configured", async () => {
    const { createAiParser } = await importTaskCapture();
    const parser = createAiParser();

    const result = await parser.parseText(
      "buy printer paper by 2026-04-20 https://example.com",
      { currentUserName: "Zac" }
    );

    expect(result.debug.provider).toBe("fallback");
    expect(result.task).toEqual({
      details: "Buy printer paper by 2026-04-20 https://example.com",
      category: "buy",
      assignee: "Someone",
      deadlineDate: "2026-04-20",
      scheduledDate: null,
      urls: ["https://example.com"]
    });
  });

  it("sends current-user context in the OpenAI extraction prompt", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output_text:
            "{\"details\":\"Pick up medicine\",\"category\":\"do\",\"assignee\":\"Zac\",\"deadlineDate\":null,\"scheduledDate\":\"2026-04-14\",\"urls\":[]}"
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const { createAiParser } = await importTaskCapture({
      openAiApiKey: "test-key"
    });
    const parser = createAiParser();

    const result = await parser.parseText("Pick up my medicine next Tuesday", {
      currentUserName: "Zac"
    });

    expect(result.task.assignee).toBe("Zac");
    const request = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.input[0].content).toContain("The authenticated user for this request is Zac.");
    expect(body.input[0].content).toContain("first-person references");
    expect(body.input[0].content).not.toContain("remember for reminders");
  });

  it("maps reminder phrasing into the do category in the fallback parser", async () => {
    const { createAiParser } = await importTaskCapture();
    const parser = createAiParser();

    const result = await parser.parseText("remember dentist appointment tomorrow", {
      currentUserName: "Zac"
    });

    expect(result.task.category).toBe("do");
  });

  it("parses nested output_text content when output_text is omitted", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: "{\"details\":\"Buy bread\",\"category\":\"buy\",\"assignee\":\"Lauryl\",\"deadlineDate\":null,\"scheduledDate\":null,\"urls\":[]}"
                }
              ]
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const { createAiParser } = await importTaskCapture({
      openAiApiKey: "test-key"
    });
    const parser = createAiParser();

    const result = await parser.parseText("I need to buy bread", {
      currentUserName: "Lauryl"
    });

    expect(result.task).toMatchObject({
      details: "Buy bread",
      assignee: "Lauryl"
    });
  });

  it("throws an AppError when OpenAI responds without output text", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: "completed", output: [] }), { status: 200 })
    ) as typeof fetch;

    const { createAiParser } = await importTaskCapture({
      openAiApiKey: "test-key"
    });
    const parser = createAiParser();

    await expect(
      parser.parseText("Renew tabs", { currentUserName: "Zac" })
    ).rejects.toMatchObject({
      code: "task_creation_failed",
      details: {
        reason: "missing_openai_output_text"
      }
    } satisfies Partial<AppError>);
  });

  it("transcribes voice and then extracts a task with combined debug data", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: "Pick up my medicine next Tuesday" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text:
              "{\"details\":\"Pick up medicine\",\"category\":\"do\",\"assignee\":\"Zac\",\"deadlineDate\":null,\"scheduledDate\":\"2026-04-14\",\"urls\":[]}"
          }),
          { status: 200 }
        )
      ) as typeof fetch;

    const { createAiParser } = await importTaskCapture({
      openAiApiKey: "test-key"
    });
    const parser = createAiParser();
    const result = await parser.parseVoice(
      new File(["audio"], "capture.webm", { type: "audio/webm" }),
      { currentUserName: "Zac" },
      "audio/webm"
    );

    expect(result.task).toMatchObject({
      details: "Pick up medicine",
      scheduledDate: "2026-04-14"
    });
    expect(result.debug.rawResponse).toMatchObject({
      transcription: { text: "Pick up my medicine next Tuesday" }
    });
  });

  it("throws when transcription fails", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "bad audio" } }), { status: 500 })
    ) as typeof fetch;

    const { createAiParser } = await importTaskCapture({
      openAiApiKey: "test-key"
    });
    const parser = createAiParser();

    await expect(
      parser.parseVoice(
        new File(["audio"], "capture.webm", { type: "audio/webm" }),
        { currentUserName: "Zac" },
        "audio/webm"
      )
    ).rejects.toMatchObject({
      code: "task_creation_failed",
      details: {
        reason: "openai_transcription_failed"
      }
    } satisfies Partial<AppError>);
  });
});
