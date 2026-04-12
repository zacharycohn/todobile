import { ok, parseJson, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { pushTokenInputSchema } from "@todobile/contracts";
import { registerPushToken } from "@/lib/server/services";
import { createRuntimeDependencies } from "@/lib/server/supabase";

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const body = await parseJson(request, pushTokenInputSchema);
    return ok(await registerPushToken(dependencies, auth, body));
  });
}
