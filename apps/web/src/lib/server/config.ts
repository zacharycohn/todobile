import { z } from "zod";

function normalizeOptionalEnv(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBooleanEnv(value: string | undefined) {
  const normalized = normalizeOptionalEnv(value)?.toLowerCase();

  if (normalized === undefined) {
    return undefined;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

const configSchema = z.object({
  nextPublicSupabaseUrl: z.string().url().optional(),
  nextPublicSupabaseAnonKey: z.string().min(1).optional(),
  supabaseServiceRoleKey: z.string().min(1).optional(),
  supabaseJwksUrl: z.string().url().optional(),
  openAiApiKey: z.string().min(1).optional(),
  pushProviderApiKey: z.string().min(1).optional(),
  nextPublicApiBaseUrl: z.string().url().default("http://localhost:3000"),
  nextPublicEnableDemoAuth: z.boolean().default(true)
});

export const config = configSchema.parse({
  nextPublicSupabaseUrl: normalizeOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  nextPublicSupabaseAnonKey: normalizeOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: normalizeOptionalEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseJwksUrl: normalizeOptionalEnv(process.env.SUPABASE_JWKS_URL),
  openAiApiKey: normalizeOptionalEnv(process.env.OPENAI_API_KEY),
  pushProviderApiKey: normalizeOptionalEnv(process.env.PUSH_PROVIDER_API_KEY),
  nextPublicApiBaseUrl:
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_API_BASE_URL) ?? "http://localhost:3000",
  nextPublicEnableDemoAuth: normalizeBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH)
});

export function hasSupabaseServiceConfig() {
  return Boolean(config.nextPublicSupabaseUrl && config.supabaseServiceRoleKey);
}
