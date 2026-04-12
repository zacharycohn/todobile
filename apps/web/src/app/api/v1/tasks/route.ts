import { ok, parseJson, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { createTask, listTasks } from "@/lib/server/services";
import { createRuntimeDependencies } from "@/lib/server/supabase";
import { createTaskInputSchema } from "@todobile/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const url = new URL(request.url);
    return ok(await listTasks(dependencies, auth, url.searchParams));
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const body = await parseJson(request, createTaskInputSchema);
    return ok(await createTask(dependencies, auth, body), 201);
  });
}
