import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

describe("subscribeToTaskChanges", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("subscribes to family task changes and refreshes on insert/update/delete", async () => {
    const on = vi.fn().mockReturnThis();
    const realtimeChannel = { unsubscribe: vi.fn() };
    const subscribe = vi.fn().mockImplementation(() => realtimeChannel);
    const removeChannel = vi.fn();
    const setAuth = vi.fn();
    const channel = { on, subscribe };

    createClientMock.mockReturnValue({
      realtime: { setAuth },
      channel: vi.fn(() => channel),
      removeChannel
    });

    const { subscribeToTaskChanges } = await import("./realtime");
    const onChange = vi.fn();
    const unsubscribe = subscribeToTaskChanges({
      token: "jwt-token",
      familyId: "family-1",
      onChange
    });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key"
    );
    expect(setAuth).toHaveBeenCalledWith("jwt-token");
    expect(createClientMock.mock.results[0]?.value.channel).toHaveBeenCalledWith("family:family-1", {
      config: { private: true }
    });
    expect(on).toHaveBeenCalledWith(
      "broadcast",
      { event: "INSERT" },
      expect.any(Function)
    );
    expect(on).toHaveBeenNthCalledWith(2, "broadcast", { event: "UPDATE" }, expect.any(Function));
    expect(on).toHaveBeenNthCalledWith(3, "broadcast", { event: "DELETE" }, expect.any(Function));

    const handler = on.mock.calls[0]?.[2] as (() => void) | undefined;
    handler?.();
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(realtimeChannel);
  });

  it("skips realtime subscriptions when token or family id is missing", async () => {
    const { subscribeToTaskChanges } = await import("./realtime");
    const unsubscribe = subscribeToTaskChanges({ token: "", familyId: "", onChange: vi.fn() });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe("function");
  });

  it("throws when supabase client env is missing for a real token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const { subscribeToTaskChanges } = await import("./realtime");

    expect(() =>
      subscribeToTaskChanges({
        token: "real-jwt",
        familyId: "family-1",
        onChange: vi.fn()
      })
    ).toThrow("Supabase Realtime is not configured");
  });
});
