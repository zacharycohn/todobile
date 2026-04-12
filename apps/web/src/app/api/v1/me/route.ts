import { ok, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { getCurrentUser } from "@/lib/server/services";
import { createRuntimeDependencies } from "@/lib/server/supabase";

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    return ok(await getCurrentUser(dependencies, auth));
  });
}
