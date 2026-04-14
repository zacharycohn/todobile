import { createRemoteJWKSet, jwtVerify } from "jose";

import { AppError } from "./errors";
import { config } from "./config";
import type { AuthContext, ProfileRepository } from "./types";

function getJwksUrl() {
  if (config.supabaseJwksUrl) {
    return config.supabaseJwksUrl;
  }

  if (!config.nextPublicSupabaseUrl) {
    return null;
  }

  return `${config.nextPublicSupabaseUrl}/auth/v1/.well-known/jwks.json`;
}

export async function requireAuth(
  request: Request,
  profiles: ProfileRepository
): Promise<AuthContext> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("unauthorized", "Missing bearer token", 401);
  }

  const token = header.slice("Bearer ".length);
  const jwksUrl = getJwksUrl();
  if (!jwksUrl) {
    throw new AppError("unauthorized", "JWT verification is not configured", 401);
  }

  const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwksUrl)));
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : "";

  if (!userId) {
    throw new AppError("unauthorized", "Unable to resolve authenticated user", 401);
  }

  const profile = await profiles.getByUserId(userId);
  if (!profile) {
    throw new AppError("profile_not_found", "Profile not found", 404);
  }

  return {
    userId: profile.id,
    email: email || profile.email,
    familyId: profile.familyId,
    displayName: profile.displayName,
    assigneeKey: profile.assigneeKey,
    bearerToken: token
  };
}
