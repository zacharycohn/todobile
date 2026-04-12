import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "./errors";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without a bearer token", async () => {
    const { requireAuth } = await import("./auth");

    await expect(requireAuth(new Request("http://localhost:3000/api/v1/me"))).rejects.toMatchObject(
      {
        code: "unauthorized",
        status: 401
      } satisfies Partial<AppError>
    );
  });

  it("resolves demo tokens against the provided profile repository", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AUTH", "true");
    const { requireAuth } = await import("./auth");

    const auth = await requireAuth(
      new Request("http://localhost:3000/api/v1/me", {
        headers: {
          Authorization: "Bearer demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
        }
      }),
      {
        getByUserId: vi.fn(async () => ({
          id: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
          email: "zac@example.com",
          displayName: "Zac",
          assigneeKey: "Zac" as const,
          familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
          familyName: "Cohnobi"
        }))
      }
    );

    expect(auth).toEqual({
      userId: "4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4",
      email: "zac@example.com",
      displayName: "Zac",
      assigneeKey: "Zac",
      familyId: "8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e",
      bearerToken: "demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
    });
  });

  it("rejects demo tokens when demo auth is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AUTH", "false");
    const { requireAuth } = await import("./auth");

    await expect(
      requireAuth(
        new Request("http://localhost:3000/api/v1/me", {
          headers: {
            Authorization: "Bearer demo-user:4f8c55d4-6f4c-4db3-a0a7-4f0e8b86c1c4"
          }
        }),
        {
          getByUserId: vi.fn(async () => null)
        }
      )
    ).rejects.toMatchObject({
      code: "unauthorized",
      status: 401
    } satisfies Partial<AppError>);
  });

  it("returns profile_not_found when the token resolves but the profile does not exist", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AUTH", "true");
    const { requireAuth } = await import("./auth");

    await expect(
      requireAuth(
        new Request("http://localhost:3000/api/v1/me", {
          headers: {
            Authorization: "Bearer demo-user:missing-profile"
          }
        }),
        {
          getByUserId: vi.fn(async () => null)
        }
      )
    ).rejects.toMatchObject({
      code: "profile_not_found",
      status: 404
    } satisfies Partial<AppError>);
  });
});
