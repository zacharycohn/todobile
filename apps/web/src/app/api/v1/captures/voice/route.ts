import { ok, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { createRuntimeDependencies } from "@/lib/server/supabase";
import { captureVoice } from "@/lib/server/services";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "video/webm"
]);

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const formData = await request.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      throw new AppError("validation_failed", "Audio file is required", 400);
    }

    const mimeType = formData.get("mimeType");
    const source = formData.get("source");
    const resolvedMimeType =
      typeof mimeType === "string" && mimeType.length > 0 ? mimeType : file.type;

    if (!resolvedMimeType || !ALLOWED_AUDIO_MIME_TYPES.has(resolvedMimeType)) {
      throw new AppError("validation_failed", "Unsupported audio type", 400, {
        mimeType: resolvedMimeType || null,
        allowedMimeTypes: [...ALLOWED_AUDIO_MIME_TYPES]
      });
    }

    if (file.size <= 0) {
      throw new AppError("validation_failed", "Audio file is empty", 400);
    }

    if (file.size > MAX_AUDIO_BYTES) {
      throw new AppError("validation_failed", "Audio file is too large", 413, {
        maxBytes: MAX_AUDIO_BYTES,
        receivedBytes: file.size
      });
    }

    try {
    return ok(
      await captureVoice(
        dependencies,
        auth,
        file,
        resolvedMimeType,
        typeof source === "string" ? source : undefined
      ),
      201
    );
    } catch (error) {
      console.error("voice_capture_failed", {
        userId: auth.userId,
        fileName: file.name,
        mimeType: resolvedMimeType,
        fileSize: file.size,
        source: typeof source === "string" ? source : null,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      throw error;
    }
  });
}
