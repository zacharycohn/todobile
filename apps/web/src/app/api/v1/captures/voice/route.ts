import { ok, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { createRuntimeDependencies } from "@/lib/server/supabase";
import { captureVoice } from "@/lib/server/services";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

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
    return ok(
      await captureVoice(
        dependencies,
        auth,
        file,
        typeof mimeType === "string" ? mimeType : undefined
      ),
      201
    );
  });
}
