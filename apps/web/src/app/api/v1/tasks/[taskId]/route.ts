import { ok, parseJson, withRouteErrorHandling } from "@/lib/server/api";
import { requireAuth } from "@/lib/server/auth";
import { createRuntimeDependencies } from "@/lib/server/supabase";
import { updateTask } from "@/lib/server/services";
import { updateTaskInputSchema } from "@todobile/contracts";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  return withRouteErrorHandling(async () => {
    const dependencies = createRuntimeDependencies();
    const auth = await requireAuth(request, dependencies.profiles);
    const body = await parseJson(request, updateTaskInputSchema);
    const { taskId } = await context.params;
    return ok(await updateTask(dependencies, auth, taskId, body));
  });
}
