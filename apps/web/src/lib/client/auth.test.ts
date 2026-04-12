import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

describe("client auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs in with email and password and returns the access token", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: {
        session: {
          access_token: "access-token-1"
        }
      },
      error: null
    }));

    createClientMock.mockReturnValue({
      auth: {
        signInWithPassword
      }
    });

    const { signInWithEmailPassword } = await import("./auth");
    const token = await signInWithEmailPassword("zaccohn@gmail.com", "todobile");

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "zaccohn@gmail.com",
      password: "todobile"
    });
    expect(token).toBe("access-token-1");
  });

  it("restores the stored access token from the current session", async () => {
    const getSession = vi.fn(async () => ({
      data: {
        session: {
          access_token: "stored-session-token"
        }
      },
      error: null
    }));

    createClientMock.mockReturnValue({
      auth: {
        getSession
      }
    });

    const { getAccessToken } = await import("./auth");
    await expect(getAccessToken()).resolves.toBe("stored-session-token");
  });
});
