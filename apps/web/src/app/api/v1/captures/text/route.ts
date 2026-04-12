import { ok, parseJson, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { createRuntimeDependencies } from "@/lib/server/supabase";
import { captureText } from "@/lib/server/services";
import { textCaptureInputSchema } from "@todobile/contracts";

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const body = await parseJson(request, textCaptureInputSchema);
    return ok(await captureText(dependencies, auth, body.input), 201);
  });
}
